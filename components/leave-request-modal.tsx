'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Tag,
  CalendarDays,
  Clock,
  MessageSquare,
  Users2,
  Paperclip,
  CloudUpload,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  FileText,
  Info,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiRequest, apiClient, getStoredUser } from '@/lib/api-client';
import {
  addDaysToDateInput,
  buildLeavePolicyHints,
  countCalendarDays,
  getLeaveRequestPolicyValidation,
  getLeaveRequestApiPayload,
  getVietnamTodayDateInput,
  LEAVE_REQUEST_MODE_CONFIG,
  numberValue,
  shouldEnforceAdvanceRequestDays,
  toFrontendRole,
  type ApprovalFlowConfig,
  type LeavePolicyConfig,
  type LeaveRequestMode,
} from '@/lib/hr-utils';

interface LeaveTypeOption {
  id: string;
  code: string;
  name: string;
  maxConsecutiveDays?: number | null;
  usesAnnualBalance?: boolean;
}

interface LeaveBalanceRecord {
  id: string;
  annualDays: number | string;
  carryOverDays: number | string;
  seniorityDays: number | string;
  compOffDays: number | string;
  usedDays: number | string;
  usedCompOffDays: number | string;
  leaveType: {
    code: string;
    name: string;
    color?: string;
  };
}

interface UserDropdownItem {
  id: string;
  fullName: string;
  username: string;
  department?: string | null;
  role?: string | null;
}

interface UserInfo {
  id: string;
  role: string;
}

interface ApprovalFlowResponse extends ApprovalFlowConfig {}
interface LeavePolicyResponse extends LeavePolicyConfig {}

export interface LeaveRequestData {
  id?: string;
  requestForUserId?: string;
  typeCode?: string;
  fromDate?: string;
  toDate?: string;
  durationMode?: LeaveRequestMode;
  reason?: string;
  handoverPersonId?: string;
  approverId?: string;
}

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
  editData?: LeaveRequestData | null;
  defaultDate?: string;
}

function getInitialFormState(editData?: LeaveRequestData | null) {
  return {
    leaveType: editData?.typeCode || 'AL',
    fromDate: editData?.fromDate || '',
    toDate: editData?.toDate || '',
    durationMode: editData?.durationMode || 'FULL_DAY',
    reason: editData?.reason || '',
    handoverPerson: editData?.handoverPersonId || '',
    approverId: editData?.approverId || '',
    requestForUserId: editData?.requestForUserId || '',
  } as const;
}

const LEAVE_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const LEAVE_ATTACHMENT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
];

function isValidLeaveAttachment(file: File) {
  const lowerName = file.name.toLowerCase();
  return LEAVE_ATTACHMENT_ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}


export default function LeaveRequestModal({
  isOpen,
  onClose,
  onSubmitSuccess,
  editData,
  defaultDate,
}: LeaveRequestModalProps) {
  type LeaveRequestField =
    | 'requestForUserId'
    | 'leaveType'
    | 'fromDate'
    | 'toDate'
    | 'reason'
    | 'approverId'
    | 'handoverPerson';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [handoverPersons, setHandoverPersons] = useState<UserDropdownItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [requestForUserId, setRequestForUserId] = useState('');
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicyResponse | null>(null);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlowResponse | null>(null);

  const isEditMode = !!editData?.id;
  const initialFormState = getInitialFormState(editData);

  const [leaveType, setLeaveType] = useState(initialFormState.leaveType);
  const [fromDate, setFromDate] = useState(initialFormState.fromDate);
  const [toDate, setToDate] = useState(initialFormState.toDate);
  const [durationMode, setDurationMode] = useState<LeaveRequestMode>(initialFormState.durationMode);
  const [reason, setReason] = useState(initialFormState.reason);
  const [handoverPerson, setHandoverPerson] = useState(initialFormState.handoverPerson);
  const [approverId, setApproverId] = useState(initialFormState.approverId);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'submitting' | 'success'>(
    'idle',
  );
  const [errorFields, setErrorFields] = useState<Partial<Record<LeaveRequestField, true>>>({});
  const isAdmin = toFrontendRole(userInfo?.role) === 'admin';
  const effectiveUserId = requestForUserId || userInfo?.id || '';
  const requestForUser = handoverPersons.find((item) => item.id === effectiveUserId);
  const approverOptions = handoverPersons.filter((item) =>
    ['MANAGER', 'HR', 'ADMIN'].includes((item.role ?? '').toUpperCase()),
  );

  useEffect(() => {
    if (!isOpen) return;

    setLoadingOptions(true);

    const storedUser = getStoredUser<UserInfo>();
    if (storedUser) {
      setUserInfo(storedUser);
      setRequestForUserId(editData?.requestForUserId || storedUser.id);
    }

    Promise.all([
      apiClient.get<LeaveTypeOption[]>('/api/leave-types'),
      apiClient.get<UserDropdownItem[]>('/api/users/dropdown'),
      apiClient.get<UserInfo>('/api/auth/me'),
      apiClient.get<LeavePolicyResponse>('/api/settings/leave-policy'),
      apiClient.get<ApprovalFlowResponse>('/api/settings/approval-flow'),
    ])
      .then(async ([leaveTypeRes, handoverRes, meRes, leavePolicyRes, approvalFlowRes]) => {
        const currentUser = meRes.data;
        setLeaveTypes(leaveTypeRes.data);
        setHandoverPersons(handoverRes.data);
        setUserInfo(currentUser);
        setLeavePolicy(leavePolicyRes.data);
        setApprovalFlow(approvalFlowRes.data);
        setRequestForUserId(
          (currentValue) => currentValue || editData?.requestForUserId || currentUser.id,
        );

        const targetUserId = editData?.requestForUserId || storedUser?.id || currentUser.id;
        const balanceEndpoint =
          toFrontendRole(currentUser.role) === 'admin' && targetUserId
            ? `/api/leave-balances/${targetUserId}`
            : '/api/leave-balances';
        const balanceRes = await apiClient.get<LeaveBalanceRecord[]>(balanceEndpoint);
        setBalances(balanceRes.data);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Không tải được dữ liệu biểu mẫu.');
      })
      .finally(() => setLoadingOptions(false));
  }, [editData?.requestForUserId, isOpen]);

  useEffect(() => {
    if (!isOpen || !effectiveUserId) return;

    const balanceEndpoint =
      isAdmin && effectiveUserId ? `/api/leave-balances/${effectiveUserId}` : '/api/leave-balances';

    apiClient
      .get<LeaveBalanceRecord[]>(balanceEndpoint)
      .then((res) => {
        setBalances(res.data);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Không tải được số dư phép.');
      });
  }, [effectiveUserId, isAdmin, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const nextState = getInitialFormState(editData);
    setLeaveType(nextState.leaveType);
    setFromDate(!editData && defaultDate ? defaultDate : nextState.fromDate);
    setToDate(!editData && defaultDate ? defaultDate : nextState.toDate);
    setDurationMode(nextState.durationMode);
    setReason(nextState.reason);
    setHandoverPerson(nextState.handoverPerson);
    setApproverId(nextState.approverId);
    setRequestForUserId(nextState.requestForUserId || userInfo?.id || '');
    setAttachedFile(null);
    setDragging(false);
    setSubmitState('idle');
    setErrorFields({});
  }, [isOpen, editData, defaultDate, userInfo?.id]);

  useEffect(() => {
    if (!isOpen || !editData?.handoverPersonId || handoverPerson) return;
    setHandoverPerson(editData.handoverPersonId);
  }, [editData?.handoverPersonId, handoverPerson, isOpen]);

  const calcDays = (): number => {
    if (!fromDate || !toDate) return 0;
    const base = countCalendarDays(fromDate, toDate);
    if (durationMode === 'HALF_DAY_AM' || durationMode === 'HALF_DAY_PM') {
      return base * 0.5;
    }
    return base;
  };

  const days = calcDays();
  const selectedLeaveType = leaveTypes.find((item) => item.code === leaveType);
  // Uses annual balance: check AL balance (for AL, SL, BL, ML)
  // Not uses annual balance: exempt from balance check (WFH, CO, BT, UL)
  const usesAnnualBalance = selectedLeaveType?.usesAnnualBalance === true;
  const annualBalance = balances.find((item) => item.leaveType.code === 'AL');
  const compOffBalance = balances.find((item) => item.leaveType.code === 'CO');
  const leaveBalanceSummary = {
    granted:
      numberValue(annualBalance?.annualDays) +
      numberValue(annualBalance?.carryOverDays) +
      numberValue(annualBalance?.seniorityDays),
    used: numberValue(annualBalance?.usedDays),
    remaining:
      numberValue(annualBalance?.annualDays) +
      numberValue(annualBalance?.carryOverDays) +
      numberValue(annualBalance?.seniorityDays) -
      numberValue(annualBalance?.usedDays),
    compOffHours:
      (numberValue(compOffBalance?.compOffDays) - numberValue(compOffBalance?.usedCompOffDays)) * 8,
  };

  const checkBalance = () => {
    if (!selectedLeaveType || days === 0) return null;
    // If uses annual balance (AL, SL, BL, ML), check AL balance
    if (usesAnnualBalance && days > leaveBalanceSummary.remaining) {
      return `Cảnh báo: Bạn chỉ còn ${leaveBalanceSummary.remaining} ngày phép năm. Yêu cầu ${days} ngày sẽ vượt quá số phép hiện có.`;
    }
    // CO uses its own balance
    if (selectedLeaveType.code === 'CO' && days * 8 > leaveBalanceSummary.compOffHours) {
      return `Cảnh báo: Bạn chỉ còn ${leaveBalanceSummary.compOffHours} giờ comp-off. Yêu cầu ${days * 8} giờ sẽ vượt quá.`;
    }
    return null;
  };

  const balanceWarning = checkBalance();
  const policyHints = buildLeavePolicyHints(leavePolicy, approvalFlow);
  const policyValidationMessage = getLeaveRequestPolicyValidation({
    fromDate,
    toDate,
    days,
    leaveTypeCode: selectedLeaveType?.code,
    hasAttachment: Boolean(attachedFile),
    leavePolicy,
    approvalFlow,
  });

  const markFieldValid = useCallback((field: LeaveRequestField) => {
    setErrorFields((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const getFieldErrorClass = useCallback(
    (field: LeaveRequestField) =>
      errorFields[field]
        ? 'border-red-300 bg-red-50/40 focus-visible:border-red-400 focus-visible:ring-red-100'
        : '',
    [errorFields],
  );

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!isValidLeaveAttachment(file)) {
      toast.error(
        'Định dạng file không hỗ trợ. Vui lòng chọn PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG hoặc HEIC.',
      );
      return;
    }
    if (file.size > LEAVE_ATTACHMENT_MAX_SIZE) {
      toast.error('File vượt quá 10MB. Vui lòng chọn file nhỏ hơn.');
      return;
    }
    setAttachedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, []);

  const handleSubmit = async () => {
    const nextErrorFields: Partial<Record<LeaveRequestField, true>> = {};

    if (isAdmin && !requestForUserId) nextErrorFields.requestForUserId = true;
    if (!selectedLeaveType) nextErrorFields.leaveType = true;
    if (!fromDate) nextErrorFields.fromDate = true;
    if (!toDate) nextErrorFields.toDate = true;
    if (!reason.trim()) nextErrorFields.reason = true;
    if (!approverId) nextErrorFields.approverId = true;
    if (!handoverPerson) nextErrorFields.handoverPerson = true;

    if (Object.keys(nextErrorFields).length > 0) {
      setErrorFields(nextErrorFields);
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    if (toDate < fromDate) {
      setErrorFields({ fromDate: true, toDate: true });
      toast.error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
      return;
    }

    if (days <= 0) {
      setErrorFields({ fromDate: true, toDate: true });
      toast.error('Số ngày nghỉ không hợp lệ. Vui lòng kiểm tra lại thời gian đăng ký.');
      return;
    }

    if (policyValidationMessage) {
      toast.error(policyValidationMessage);
      return;
    }

    const validatedLeaveType = selectedLeaveType;
    if (!validatedLeaveType) {
      toast.error('Vui lòng chọn loại nghỉ phép.');
      setErrorFields({ leaveType: true });
      return;
    }

    const composedReason = reason.trim();

    const leaveRequestPayload = getLeaveRequestApiPayload({
      date: fromDate,
      endDate: toDate,
      mode: durationMode,
    });

    const formData = new FormData();
    formData.append('leaveTypeId', validatedLeaveType.id);
    if (isAdmin && effectiveUserId) {
      formData.append('userId', effectiveUserId);
    }
    if (approverId) {
      formData.append('approverId', approverId);
    }
    formData.append('fromDate', leaveRequestPayload.fromDate);
    formData.append('toDate', leaveRequestPayload.toDate);
    formData.append('durationMode', leaveRequestPayload.durationMode);
    formData.append('totalDays', String(days));
    formData.append('reason', composedReason);
    if (handoverPerson) {
      formData.append('handoverPersonId', handoverPerson);
    }
    if (attachedFile) {
      formData.append('attachment', attachedFile);
    }

    setErrorFields({});
    setSubmitState('submitting');

    try {
      await apiRequest({
        url: isEditMode ? `/api/leave-requests/${editData.id}` : '/api/leave-requests',
        method: isEditMode ? 'PATCH' : 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmitState('success');
      toast.success(
        isEditMode
          ? 'Yêu cầu nghỉ phép đã được cập nhật thành công.'
          : validatedLeaveType.code === 'WFH'
            ? 'Yêu cầu WFH đã được gửi thành công! Đang chờ phê duyệt.'
            : 'Yêu cầu nghỉ phép đã được gửi thành công! Đang chờ phê duyệt.',
      );

      resetForm();
      onClose();
      onSubmitSuccess?.();
    } catch (err) {
      setSubmitState('idle');
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu nghỉ phép.');
    }
  };

  const resetForm = () => {
    setLeaveType('AL');
    setFromDate('');
    setToDate('');
    setDurationMode('FULL_DAY');
    setReason('');
    setHandoverPerson('');
    setApproverId('');
    setRequestForUserId(editData?.requestForUserId || userInfo?.id || '');
    setAttachedFile(null);
    setDragging(false);
    setSubmitState('idle');
    setErrorFields({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {isEditMode ? 'Chỉnh sửa yêu cầu nghỉ phép' : 'Đăng ký nghỉ phép mới'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Cập nhật thông tin yêu cầu nghỉ phép của bạn'
              : 'Điền đầy đủ thông tin để gửi yêu cầu nghỉ phép'}
          </DialogDescription>
        </DialogHeader>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#D3F2E7' }}
            >
              <Tag size={20} style={{ color: '#1DB87A' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: '#203430' }}>
                {isEditMode ? 'Chỉnh sửa yêu cầu nghỉ phép' : 'Đăng ký nghỉ phép mới'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditMode
                  ? 'Cập nhật thông tin yêu cầu của bạn'
                  : 'Điền đầy đủ thông tin để gửi yêu cầu'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
            style={{ color: '#6b7f78' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5">
          {/* Leave balance info */}
          <div
            className="rounded-xl p-4"
            style={{ background: '#f0f9f5', border: '1px solid #D3F2E7' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Info size={15} style={{ color: '#1DB87A' }} />
              <span className="text-sm font-semibold" style={{ color: '#0E474E' }}>
                Thông tin phép hiện tại
              </span>
              {isAdmin && requestForUser ? (
                <span className="text-xs text-muted-foreground">{requestForUser.fullName}</span>
              ) : null}
            </div>
            {!usesAnnualBalance && selectedLeaveType?.code !== 'CO' ? (
              <p className="mb-3 text-xs" style={{ color: '#0E474E' }}>
                Loại nghỉ <strong>{selectedLeaveType?.name}</strong> không kiểm tra số dư phép. Các
                số liệu bên dưới là quỹ phép năm hiện tại để tham khảo.
              </p>
            ) : null}
            {usesAnnualBalance && selectedLeaveType?.code !== 'AL' ? (
              <p className="mb-3 text-xs" style={{ color: '#0E474E' }}>
                Loại nghỉ <strong>{selectedLeaveType?.name}</strong> sẽ trừ vào phép năm.
              </p>
            ) : null}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Phép năm được cấp', value: leaveBalanceSummary.granted },
                { label: 'Đã sử dụng', value: leaveBalanceSummary.used },
                { label: 'Còn lại', value: leaveBalanceSummary.remaining },
                { label: 'Comp-off (giờ)', value: leaveBalanceSummary.compOffHours },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-2xl font-bold" style={{ color: '#1DB87A' }}>
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {policyHints.length > 0 ? (
            <div
              className="rounded-xl p-4"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Info size={15} style={{ color: '#d97706' }} />
                <span className="text-sm font-semibold" style={{ color: '#92400e' }}>
                  Quy định áp dụng
                </span>
              </div>
              <div className="space-y-1 text-xs" style={{ color: '#92400e' }}>
                {policyHints.map((hint) => (
                  <p key={hint}>- {hint}</p>
                ))}
                {shouldEnforceAdvanceRequestDays(fromDate, leavePolicy?.advanceRequestDays) ? (
                  <p>
                    - Với đơn nghỉ tương lai, ngày bắt đầu sớm nhất từ{' '}
                    {addDaysToDateInput(
                      getVietnamTodayDateInput(),
                      leavePolicy?.advanceRequestDays ?? 0,
                    ) || 'hôm nay'}
                    .
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Form fields */}
          <div className="space-y-5">
            {isAdmin && (
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold mb-2"
                  style={{ color: '#203430' }}
                >
                  <Users2 size={14} style={{ color: '#1DB87A' }} /> Nhân viên đăng ký{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <Select
                  value={requestForUserId || 'placeholder'}
                  onValueChange={(value) => {
                    const nextValue = value === 'placeholder' ? '' : value;
                    setRequestForUserId(nextValue);
                    if (nextValue) markFieldValid('requestForUserId');
                  }}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className={getFieldErrorClass('requestForUserId')}>
                    <SelectValue placeholder="-- Chọn nhân viên --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder">-- Chọn nhân viên --</SelectItem>
                    {handoverPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Leave type */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <Tag size={14} style={{ color: '#1DB87A' }} /> Loại nghỉ phép{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <Select
                value={leaveType || 'placeholder'}
                onValueChange={(value) => {
                  const nextValue = value === 'placeholder' ? '' : value;
                  setLeaveType(nextValue);
                  if (nextValue) markFieldValid('leaveType');
                }}
                disabled={loadingOptions}
              >
                <SelectTrigger className={getFieldErrorClass('leaveType')}>
                  <SelectValue placeholder="-- Chọn loại nghỉ --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder">-- Chọn loại nghỉ --</SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {`${t.code} - ${t.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold mb-2"
                  style={{ color: '#203430' }}
                >
                  <CalendarDays size={14} style={{ color: '#1DB87A' }} /> Từ ngày{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <DatePicker
                  value={fromDate}
                  onChange={(value) => {
                    setFromDate(value);
                    if (value) markFieldValid('fromDate');
                  }}
                  className={getFieldErrorClass('fromDate')}
                />
              </div>
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold mb-2"
                  style={{ color: '#203430' }}
                >
                  <CalendarDays size={14} style={{ color: '#1DB87A' }} /> Đến ngày{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <DatePicker
                  value={toDate}
                  onChange={(value) => {
                    setToDate(value);
                    if (value) markFieldValid('toDate');
                  }}
                  className={getFieldErrorClass('toDate')}
                />
              </div>
            </div>

            {/* Duration mode */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <Clock size={14} style={{ color: '#1DB87A' }} /> Hình thức nghỉ{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="flex gap-3 flex-wrap">
                {(['FULL_DAY', 'HALF_DAY_AM', 'HALF_DAY_PM'] as LeaveRequestMode[]).map(
                  (mode) => {
                    const isSelected = durationMode === mode;
                    return (
                      <label
                        key={mode}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all select-none"
                        style={
                          isSelected
                            ? {
                                background: '#D3F2E7',
                                color: '#0E474E',
                                border: '2px solid #1DB87A',
                              }
                            : {
                                background: '#f7f7f7',
                                color: '#6b7f78',
                                border: '2px solid transparent',
                              }
                        }
                      >
                        <input
                          type="radio"
                          name="durationMode"
                          value={mode}
                          checked={isSelected}
                          onChange={() => setDurationMode(mode)}
                          className="hidden"
                        />
                        <span
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: isSelected ? '#1DB87A' : '#c4d4cf' }}
                        >
                          {isSelected && (
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: '#1DB87A' }}
                            />
                          )}
                        </span>
                        {LEAVE_REQUEST_MODE_CONFIG[mode].label}
                      </label>
                    );
                  },
                )}
              </div>
            </div>



            {/* Calculation */}
            {days > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
              >
                <Calculator size={16} style={{ color: '#d97706' }} />
                <span className="text-sm" style={{ color: '#92400e' }}>
                  Số ngày nghỉ tính toán: <strong>{days}</strong> ngày
                </span>
              </div>
            )}

            {/* Balance warning */}
            {balanceWarning && (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-lg"
                style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <AlertTriangle
                  size={15}
                  style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }}
                />
                <span className="text-sm" style={{ color: '#dc2626' }}>
                  {balanceWarning}
                </span>
              </div>
            )}

            {policyValidationMessage ? (
              <div
                className="flex items-start gap-3 px-4 py-3 rounded-lg"
                style={{ background: '#fff7ed', border: '1px solid #fdba74' }}
              >
                <AlertTriangle
                  size={15}
                  style={{ color: '#ea580c', flexShrink: 0, marginTop: 2 }}
                />
                <span className="text-sm" style={{ color: '#c2410c' }}>
                  {policyValidationMessage}
                </span>
              </div>
            ) : null}

            {/* Reason */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <MessageSquare size={14} style={{ color: '#1DB87A' }} /> Lý do nghỉ{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim()) markFieldValid('reason');
                }}
                rows={3}
                placeholder="Nhập lý do nghỉ phép..."
                className={`resize-none ${getFieldErrorClass('reason')}`}
              />
            </div>

            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <Users2 size={14} style={{ color: '#1DB87A' }} /> Người duyệt{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <Select
                value={approverId || 'placeholder'}
                onValueChange={(value) => {
                  const next = value === 'placeholder' ? '' : value;
                  setApproverId(next);
                  if (next) markFieldValid('approverId');
                }}
                disabled={loadingOptions}
              >
                <SelectTrigger className={getFieldErrorClass('approverId')}>
                  <SelectValue placeholder="-- Chọn người duyệt --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder">-- Chọn người duyệt --</SelectItem>
                  {approverOptions.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Handover person */}
            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <Users2 size={14} style={{ color: '#1DB87A' }} /> Người bàn giao/hỗ trợ khi cần{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <Select
                value={handoverPerson || 'placeholder'}
                onValueChange={(value) => {
                  const next = value === 'placeholder' ? '' : value;
                  setHandoverPerson(next);
                  if (next) markFieldValid('handoverPerson');
                }}
                disabled={loadingOptions}
              >
                <SelectTrigger className={getFieldErrorClass('handoverPerson')}>
                  <SelectValue placeholder="-- Chọn người bàn giao --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder">-- Chọn người bàn giao --</SelectItem>
                  {handoverPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <Paperclip size={14} style={{ color: '#1DB87A' }} /> File đính kèm (nếu có)
              </label>
              {attachedFile ? (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: '#f0f9f5', border: '1px solid #D3F2E7' }}
                >
                  <FileText size={16} style={{ color: '#1DB87A' }} />
                  <span
                    className="text-sm font-medium flex-1 truncate"
                    style={{ color: '#203430' }}
                  >
                    {attachedFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(attachedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-lg p-6 text-center cursor-pointer transition-all"
                  style={{
                    border: `2px dashed ${dragging ? '#1DB87A' : '#D3F2E7'}`,
                    background: dragging ? '#f0f9f5' : '#fafffe',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <CloudUpload size={28} className="mx-auto mb-2" style={{ color: '#1DB87A' }} />
                  <p className="text-sm font-medium" style={{ color: '#203430' }}>
                    Nhấp để chọn file hoặc kéo thả file vào đây
                  </p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Hỗ trợ: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, HEIC (Tối đa 10MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-t sticky bottom-0 bg-white z-10"
          style={{ borderColor: '#e2ede9' }}
        >
          <button
            type="button"
            onClick={resetForm}
            disabled={submitState === 'submitting' || submitState === 'success'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-70"
            style={{ background: '#f7f7f7', color: '#6b7f78', border: '1px solid #e2ede9' }}
          >
            <Save size={15} />
            Đặt lại
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitState !== 'idle' || loadingOptions}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
          >
            <Send size={15} />
            {submitState === 'submitting' ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ml-auto"
            style={{ background: '#f7f7f7', color: '#6b7f78', border: '1px solid #e2ede9' }}
          >
            <X size={15} /> Hủy
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
