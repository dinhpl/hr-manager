'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Info,
  Tag,
  CalendarDays,
  Clock,
  MessageSquare,
  Users2,
  Paperclip,
  CloudUpload,
  Save,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  FileText,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiRequest, apiClient } from '@/lib/api-client';
import {
  addDaysToDateInput,
  buildLeavePolicyHints,
  countCalendarDays,
  getVietnamTodayDateInput,
  getLeaveRequestPolicyValidation,
  getDateTimeValue,
  getLeaveRequestApiPayload,
  HOURLY_LEAVE_TIME_MAX,
  HOURLY_LEAVE_TIME_MIN,
  HOURLY_LEAVE_TIME_STEP_SECONDS,
  type ApprovalFlowConfig,
  type LeavePolicyConfig,
  LEAVE_REQUEST_MODE_CONFIG,
  numberValue,
  type LeaveRequestMode,
} from '@/lib/hr-utils';

interface LeaveTypeOption {
  id: string;
  code: string;
  name: string;
  color?: string;
}

interface LeaveBalanceRecord {
  id: string;
  totalDays: number | string;
  usedDays: number | string;
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
}

interface ApprovalFlowResponse extends ApprovalFlowConfig {}
interface LeavePolicyResponse extends LeavePolicyConfig {}

export default function LeaveRequestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [handoverPersons, setHandoverPersons] = useState<UserDropdownItem[]>([]);
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicyResponse | null>(null);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlowResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [leaveType, setLeaveType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [durationMode, setDurationMode] = useState<LeaveRequestMode>('FULL_DAY');
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('17:15');
  const [reason, setReason] = useState('');
  const [handoverPerson, setHandoverPerson] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'submitting' | 'success'>(
    'idle',
  );
  const [alert, setAlert] = useState<{
    type: 'warning' | 'info' | 'success';
    message: string;
  } | null>(null);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    Promise.all([
      apiClient.get<LeaveTypeOption[]>('/api/leave-types'),
      apiClient.get<LeaveBalanceRecord[]>('/api/leave-balances'),
      apiClient.get<UserDropdownItem[]>('/api/users/dropdown'),
      apiClient.get<LeavePolicyResponse>('/api/settings/leave-policy'),
      apiClient.get<ApprovalFlowResponse>('/api/settings/approval-flow'),
    ])
      .then(([leaveTypeRes, balanceRes, handoverRes, leavePolicyRes, approvalFlowRes]) => {
        setLeaveTypes(leaveTypeRes.data);
        setBalances(balanceRes.data);
        setHandoverPersons(handoverRes.data);
        setLeavePolicy(leavePolicyRes.data);
        setApprovalFlow(approvalFlowRes.data);
      })
      .catch((err) => {
        scrollToTop();
        setAlert({
          type: 'warning',
          message: err instanceof Error ? err.message : 'Không tải được dữ liệu biểu mẫu.',
        });
      })
      .finally(() => setLoadingOptions(false));
  }, [scrollToTop]);

  // Calculate days
  const calcDays = (): number => {
    if (!fromDate || !toDate) return 0;
    const base = countCalendarDays(fromDate, toDate);
    if (durationMode === 'MORNING_HALF_DAY' || durationMode === 'AFTERNOON_HALF_DAY') {
      return base * 0.5;
    }
    if (durationMode === 'HOURLY') {
      if (!fromTime || !toTime) return 0;
      const hours =
        (getDateTimeValue(`2000-01-01 ${toTime}`) - getDateTimeValue(`2000-01-01 ${fromTime}`)) /
        3600000;
      return Math.max(0, hours / 8);
    }
    return base;
  };

  const days = calcDays();
  const selectedLeaveType = leaveTypes.find((item) => item.code === leaveType);
  const isSelectedTypeBalanceExempt = selectedLeaveType?.code === 'WFH';
  const annualBalance = balances.find((item) => item.leaveType.code === 'AL');
  const compOffBalance = balances.find((item) => item.leaveType.code === 'CO');
  const leaveBalanceSummary = {
    granted: numberValue(annualBalance?.totalDays),
    used: numberValue(annualBalance?.usedDays),
    remaining: numberValue(annualBalance?.totalDays) - numberValue(annualBalance?.usedDays),
    compOffHours:
      (numberValue(compOffBalance?.totalDays) - numberValue(compOffBalance?.usedDays)) * 8,
  };

  const checkBalance = () => {
    if (!selectedLeaveType || days === 0) return null;
    if (selectedLeaveType.code === 'AL' && days > leaveBalanceSummary.remaining) {
      return `Cảnh báo: Bạn chỉ còn ${leaveBalanceSummary.remaining} ngày phép năm. Yêu cầu ${days} ngày sẽ vượt quá số phép hiện có.`;
    }
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

  useEffect(() => {
    if (durationMode === 'HOURLY') {
      setFromTime((current) => current || HOURLY_LEAVE_TIME_MIN);
      setToTime((current) => current || HOURLY_LEAVE_TIME_MAX);
      return;
    }

    setFromTime(LEAVE_REQUEST_MODE_CONFIG[durationMode].defaultFromTime);
    setToTime(LEAVE_REQUEST_MODE_CONFIG[durationMode].defaultToTime);
  }, [durationMode]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];
    if (!allowed.includes(file.type)) {
      setAlert({
        type: 'warning',
        message: 'Định dạng file không hỗ trợ. Vui lòng chọn PDF, DOC, DOCX, JPG hoặc PNG.',
      });
      return;
    }
    if (file.size > maxSize) {
      setAlert({ type: 'warning', message: 'File vượt quá 5MB. Vui lòng chọn file nhỏ hơn.' });
      return;
    }
    setAttachedFile(file);
    setAlert(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, []);

  const resetForm = () => {
    setLeaveType('');
    setFromDate('');
    setToDate('');
    setDurationMode('FULL_DAY');
    setFromTime('08:00');
    setToTime('17:15');
    setReason('');
    setHandoverPerson('');
    setAttachedFile(null);
    setDragging(false);
  };

  const handleSubmit = async () => {
    if (!selectedLeaveType || !fromDate || !toDate || !reason.trim()) {
      setAlert({
        type: 'warning',
        message: 'Vui lòng điền đầy đủ các trường bắt buộc (*).',
      });
      return;
    }

    if (toDate < fromDate) {
      setAlert({
        type: 'warning',
        message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.',
      });
      return;
    }

    if (
      durationMode === 'HOURLY' &&
      getDateTimeValue(`2000-01-01 ${toTime}`) <= getDateTimeValue(`2000-01-01 ${fromTime}`)
    ) {
      setAlert({
        type: 'warning',
        message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu.',
      });
      return;
    }

    if (days <= 0) {
      setAlert({
        type: 'warning',
        message: 'Số ngày nghỉ không hợp lệ. Vui lòng kiểm tra lại thời gian đăng ký.',
      });
      return;
    }

    if (policyValidationMessage) {
      setAlert({ type: 'warning', message: policyValidationMessage });
      return;
    }

    const handoverName = handoverPersons.find((item) => item.id === handoverPerson)?.fullName ?? '';

    const composedReason = [
      reason.trim(),
      durationMode !== 'FULL_DAY'
        ? `Hình thức nghỉ: ${LEAVE_REQUEST_MODE_CONFIG[durationMode].label}`
        : null,
      durationMode === 'HOURLY' ? `Khung giờ: ${fromTime} - ${toTime}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const leaveRequestPayload = getLeaveRequestApiPayload({
      date: fromDate,
      endDate: toDate,
      mode: durationMode,
      startTime: fromTime,
      endTime: toTime,
    });

    const formData = new FormData();
    formData.append('leaveTypeId', selectedLeaveType.id);
    formData.append('fromDate', leaveRequestPayload.fromDate);
    formData.append('toDate', leaveRequestPayload.toDate);
    formData.append('durationMode', leaveRequestPayload.durationMode);
    formData.append('fromTime', leaveRequestPayload.fromTime);
    formData.append('toTime', leaveRequestPayload.toTime);
    formData.append('totalDays', String(days));
    formData.append('reason', composedReason);
    if (handoverPerson) {
      formData.append('handoverPerson', handoverName);
    }
    if (attachedFile) {
      formData.append('attachment', attachedFile);
    }

    setAlert(null);
    setSubmitState('submitting');

    try {
      await apiRequest({
        url: '/api/leave-requests',
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSubmitState('success');
      toast.success('Yêu cầu nghỉ phép đã được gửi thành công! Đang chờ phê duyệt.');
      router.push('/dashboard/leave-history');
    } catch (err) {
      setSubmitState('idle');
      scrollToTop();
      setAlert({
        type: 'warning',
        message: err instanceof Error ? err.message : 'Không thể gửi yêu cầu nghỉ phép.',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: '#D3F2E7' }}
        >
          <PlusCircle size={20} style={{ color: '#1DB87A' }} />
        </div>
        <div>
          <h1 className="font-bold text-lg" style={{ color: '#203430' }}>
            Đăng ký nghỉ phép mới
          </h1>
          <p className="text-xs text-muted-foreground">Điền đầy đủ thông tin để gửi yêu cầu</p>
        </div>
      </div>

      {policyHints.length > 0 && (
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Info size={15} style={{ color: '#d97706' }} />
            <span className="text-sm font-semibold" style={{ color: '#92400e' }}>
              Quy định áp dụng cho yêu cầu nghỉ
            </span>
          </div>
          <div className="space-y-1 text-xs" style={{ color: '#92400e' }}>
            {policyHints.map((hint) => (
              <p key={hint}>- {hint}</p>
            ))}
            {typeof leavePolicy?.advanceRequestDays === 'number' ? (
              <p>
                - Nếu áp dụng ngay hôm nay, ngày bắt đầu sớm nhất nên từ{' '}
                {addDaysToDateInput(getVietnamTodayDateInput(), leavePolicy.advanceRequestDays) ||
                  'hom nay'}
                .
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* Leave balance info */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: '#f0f9f5', border: '1px solid #D3F2E7' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Info size={15} style={{ color: '#1DB87A' }} />
          <span className="text-sm font-semibold" style={{ color: '#0E474E' }}>
            Thông tin phép hiện tại
          </span>
        </div>
        {isSelectedTypeBalanceExempt ? (
          <p className="mb-3 text-xs" style={{ color: '#0E474E' }}>
            Loại nghỉ <strong>{selectedLeaveType?.name ?? 'WFH'}</strong> không kiểm tra số dư
            phép. Các số liệu bên dưới là quỹ phép năm hiện tại để tham khảo.
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

      {/* Alert */}
      {alert && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg mb-4 text-sm"
          style={
            alert.type === 'warning'
              ? { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }
              : { background: '#dbeafe', border: '1px solid #93c5fd', color: '#1e3a8a' }
          }
        >
          {alert.type === 'warning' ? (
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          )}
          {alert.message}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl shadow-sm p-6" style={{ border: '1px solid #e2ede9' }}>
        <div className="space-y-5">
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
              onValueChange={(value) => setLeaveType(value === 'placeholder' ? '' : value)}
              disabled={loadingOptions}
            >
              <SelectTrigger>
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
              <DatePicker value={fromDate} onChange={setFromDate} />
            </div>
            <div>
              <label
                className="flex items-center gap-2 text-sm font-semibold mb-2"
                style={{ color: '#203430' }}
              >
                <CalendarDays size={14} style={{ color: '#1DB87A' }} /> Đến ngày{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <DatePicker value={toDate} onChange={setToDate} />
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
              {(
                [
                  'FULL_DAY',
                  'MORNING_HALF_DAY',
                  'AFTERNOON_HALF_DAY',
                  'HOURLY',
                ] as LeaveRequestMode[]
              ).map((mode) => {
                const isSelected = durationMode === mode;
                return (
                  <label
                    key={mode}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all select-none"
                    style={
                      isSelected
                        ? { background: '#D3F2E7', color: '#0E474E', border: '2px solid #1DB87A' }
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
                        <span className="w-2 h-2 rounded-full" style={{ background: '#1DB87A' }} />
                      )}
                    </span>
                    {LEAVE_REQUEST_MODE_CONFIG[mode].label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Time fields (hourly) */}
          {durationMode === 'HOURLY' && (
            <div
              className="grid grid-cols-2 gap-4 p-4 rounded-lg"
              style={{ background: '#f7f7f7', border: '1px dashed #D3F2E7' }}
            >
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#203430' }}>
                  Từ giờ
                </label>
                <TimePicker
                  value={fromTime}
                  onChange={setFromTime}
                  min={HOURLY_LEAVE_TIME_MIN}
                  max={HOURLY_LEAVE_TIME_MAX}
                  step={HOURLY_LEAVE_TIME_STEP_SECONDS}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#203430' }}>
                  Đến giờ
                </label>
                <TimePicker
                  value={toTime}
                  onChange={setToTime}
                  min={HOURLY_LEAVE_TIME_MIN}
                  max={HOURLY_LEAVE_TIME_MAX}
                  step={HOURLY_LEAVE_TIME_STEP_SECONDS}
                />
              </div>
            </div>
          )}

          {/* Calculation */}
          {days > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
            >
              <Calculator size={16} style={{ color: '#d97706' }} />
              <span className="text-sm" style={{ color: '#92400e' }}>
                Số ngày nghỉ tính toán: <strong>{days}</strong> ngày
                {durationMode === 'HOURLY' && ` (${days * 8} giờ)`}
              </span>
            </div>
          )}

          {/* Balance warning */}
          {balanceWarning && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
              <span className="text-sm" style={{ color: '#dc2626' }}>
                {balanceWarning}
              </span>
            </div>
          )}

          {policyValidationMessage && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{ background: '#fff7ed', border: '1px solid #fdba74' }}
            >
              <AlertTriangle size={15} style={{ color: '#ea580c', flexShrink: 0, marginTop: 2 }} />
              <span className="text-sm" style={{ color: '#c2410c' }}>
                {policyValidationMessage}
              </span>
            </div>
          )}

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
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do nghỉ phép..."
              className="resize-none"
            />
          </div>

          {/* Handover person */}
          <div>
            <label
              className="flex items-center gap-2 text-sm font-semibold mb-2"
              style={{ color: '#203430' }}
            >
              <Users2 size={14} style={{ color: '#1DB87A' }} /> Người bàn giao/hỗ trợ khi cần
            </label>
            <Select
              value={handoverPerson || 'placeholder'}
              onValueChange={(value) => setHandoverPerson(value === 'placeholder' ? '' : value)}
              disabled={loadingOptions}
            >
              <SelectTrigger>
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

          {/* File attachment */}
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
                <span className="text-sm font-medium flex-1 truncate" style={{ color: '#203430' }}>
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
                  Hỗ trợ: PDF, DOC, DOCX, JPG, PNG (Tối đa 5MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e2ede9' }}>
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
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ml-auto"
              style={{ background: '#f7f7f7', color: '#6b7f78', border: '1px solid #e2ede9' }}
            >
              <X size={15} /> Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
