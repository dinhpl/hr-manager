'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BedDouble, CheckCircle2, Clock, Pencil, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient, getStoredUser } from '@/lib/api-client';
import { formatDateVN, getStatusLabel, toFrontendRole } from '@/lib/hr-utils';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CompensationType = 'COMP_OFF' | 'PAYMENT';

type OvertimeApiItem = {
  id: string | number;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  hours: number | string;
  status?: string | null;
  compensationType?: CompensationType | null;
  otType?: 'weekday' | 'weekend' | 'holiday' | null;
  compOffHours?: number | string | null;
  reason?: string | null;
  approver?: { id: string; fullName: string } | null;
  user?: { id: string; fullName: string } | null;
};

type ApproverOption = {
  id: string;
  fullName: string;
  role: string;
};

type CompOffApiItem = {
  id: string | number;
  toDate: string;
  totalHours?: number;
  expireDays?: number;
  derivedStatus?: string;
  overtime?: {
    date?: string;
    hours?: number | string;
  } | null;
};

type CompOffSummary = {
  totalHours: number;
  expiredHours: number;
  expiringHours: number;
  availableHours: number;
};

const STATUS_STYLE: Record<string, { badge: string; dot: string }> = {
  pending: {
    badge: 'bg-amber-50 text-amber-600 border border-amber-200',
    dot: 'bg-amber-400',
  },
  approved: {
    badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    badge: 'bg-red-50 text-red-500 border border-red-200',
    dot: 'bg-red-400',
  },
  available: {
    badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    dot: 'bg-emerald-500',
  },
  expiring: {
    badge: 'bg-amber-50 text-amber-600 border border-amber-200',
    dot: 'bg-amber-400',
  },
  expired: {
    badge: 'bg-red-50 text-red-500 border border-red-200',
    dot: 'bg-red-400',
  },
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  available: 'Có sẵn',
  expiring: 'Sắp hết hạn',
  expired: 'Đã hết hạn',
};

const RATE: Record<string, number> = { weekday: 1, weekend: 1.5, holiday: 2 };

const OT_TYPE_LABEL: Record<string, string> = {
  weekday: 'Ngày thường',
  weekend: 'Cuối tuần',
  holiday: 'Ngày lễ',
};

function toMins(timeValue: string) {
  if (!timeValue) return 0;
  const [hours, minutes] = timeValue.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatHours(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(1)}h`;
}

function detectOtType(dateValue?: string | null) {
  if (!dateValue) return 'weekday';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'weekday';
  const day = date.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function getMonthRange(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return getMonthRange(now.toISOString().slice(0, 10));
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    fromDate: start.toISOString(),
    toDate: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).toISOString(),
  };
}

export default function OvertimePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Form state
  const [workDate, setWorkDate] = useState(today);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('');
  const [otType, setOtType] = useState('weekday');
  const [compensationType, setCompensationType] = useState<CompensationType>('COMP_OFF');
  const [reason, setReason] = useState('');
  const [approverId, setApproverId] = useState('');
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<OvertimeApiItem[]>([]);
  const [monthlyItems, setMonthlyItems] = useState<OvertimeApiItem[]>([]);
  const [compOffRows, setCompOffRows] = useState<CompOffApiItem[]>([]);
  const [compOffSummary, setCompOffSummary] = useState<CompOffSummary | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Role check
  const storedUser = getStoredUser<{ role?: string; id?: string | number }>();
  const currentRole = toFrontendRole(storedUser?.role);
  const canApprove = currentRole === 'manager' || currentRole === 'hr' || currentRole === 'admin';
  const currentUserId = String(storedUser?.id ?? '');

  // Action loading state per row
  const [actionLoading, setActionLoading] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string | number } | null>(null);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<OvertimeApiItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editCompType, setEditCompType] = useState<CompensationType>('COMP_OFF');
  const [editApproverId, setEditApproverId] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const calc = useMemo(() => {
    if (!startTime || !endTime) return null;
    const total = toMins(endTime) - toMins(startTime);
    if (total <= 0) return null;
    const otHours = total / 60;
    const compoff = compensationType === 'COMP_OFF' ? otHours * RATE[otType] : null;
    return { otHours, compoff };
  }, [compensationType, endTime, otType, startTime]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const monthRange = getMonthRange(workDate);
      const [historyResponse, monthlyResponse, compOffListResponse, compOffSummaryResponse] =
        await Promise.all([
          apiClient.get<OvertimeApiItem[]>('/api/overtime', { params: { page: 1, limit: 50 } }),
          apiClient.get<OvertimeApiItem[]>('/api/overtime', {
            params: { page: 1, limit: 100, fromDate: monthRange.fromDate, toDate: monthRange.toDate },
          }),
          apiClient.get<CompOffApiItem[]>('/api/comp-off', {
            params: { page: 1, limit: 5, sortBy: 'expiry_asc', status: 'APPROVED' },
          }),
          apiClient.get<CompOffSummary>('/api/comp-off/summary'),
        ]);
      setHistoryItems(historyResponse.data ?? []);
      setMonthlyItems(monthlyResponse.data ?? []);
      setCompOffRows(compOffListResponse.data ?? []);
      setCompOffSummary(compOffSummaryResponse.data ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu overtime.');
    } finally {
      setIsLoading(false);
    }
  }, [workDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!dialogOpen && !editDialogOpen) return;
    async function fetchApprovers() {
      try {
        const [managers, hrs] = await Promise.all([
          apiClient.get<ApproverOption[]>('/api/users', { params: { role: 'MANAGER', limit: 100 } }),
          apiClient.get<ApproverOption[]>('/api/users', { params: { role: 'HR', limit: 100 } }),
        ]);
        const all = [...(managers.data ?? []), ...(hrs.data ?? [])];
        const unique = all.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
        setApprovers(unique);
      } catch {
        // non-critical, approver list is optional
      }
    }
    void fetchApprovers();
  }, [dialogOpen, editDialogOpen]);

  // Monthly stats
  const monthlyPending = useMemo(
    () => monthlyItems.filter((i) => getStatusLabel(i.status) === 'pending'),
    [monthlyItems],
  );
  const monthlyApproved = useMemo(
    () => monthlyItems.filter((i) => getStatusLabel(i.status) === 'approved'),
    [monthlyItems],
  );
  const monthlyRejected = useMemo(
    () => monthlyItems.filter((i) => getStatusLabel(i.status) === 'rejected'),
    [monthlyItems],
  );
  const monthlyTotalHours = useMemo(
    () => monthlyItems.reduce((sum, i) => sum + Number(i.hours ?? 0), 0),
    [monthlyItems],
  );
  const monthlyPendingHours = useMemo(
    () => monthlyPending.reduce((sum, i) => sum + Number(i.hours ?? 0), 0),
    [monthlyPending],
  );

  // Filtered table data
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      const matchStatus = !statusFilter || getStatusLabel(item.status) === statusFilter;
      const matchSearch =
        !search ||
        formatDateVN(item.date).toLowerCase().includes(search.toLowerCase()) ||
        (item.reason ?? '').toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [historyItems, search, statusFilter]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!calc) {
      toast.error('Thời gian OT không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/api/overtime', {
        date: workDate,
        startTime,
        endTime,
        reason: reason.trim(),
        compensationType,
        ...(approverId ? { approverId } : {}),
      });
      toast.success('Đã gửi đăng ký OT thành công.');
      setEndTime('');
      setReason('');
      setCompensationType('COMP_OFF');
      setApproverId('');
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi đăng ký OT.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string | number) => {
    setActionLoading((prev) => ({ ...prev, [String(id)]: 'approve' }));
    try {
      await apiClient.patch(`/api/overtime/${id}/approve`);
      toast.success('Đã duyệt yêu cầu OT.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể duyệt yêu cầu.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [String(id)]: null }));
    }
  };

  const handleReject = async (id: string | number) => {
    setActionLoading((prev) => ({ ...prev, [String(id)]: 'reject' }));
    try {
      await apiClient.patch(`/api/overtime/${id}/reject`);
      toast.success('Đã từ chối yêu cầu OT.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể từ chối yêu cầu.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [String(id)]: null }));
    }
  };

  const openEditDialog = (row: OvertimeApiItem) => {
    setEditItem(row);
    setEditDate(row.date ? row.date.slice(0, 10) : '');
    setEditStartTime(row.startTime ?? '');
    setEditEndTime(row.endTime ?? '');
    setEditReason(row.reason ?? '');
    setEditCompType(row.compensationType ?? 'COMP_OFF');
    setEditApproverId(row.approver?.id ?? '');
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editItem) return;
    setIsEditSubmitting(true);
    try {
      await apiClient.patch(`/api/overtime/${editItem.id}`, {
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime,
        reason: editReason.trim(),
        compensationType: editCompType,
        ...(editApproverId ? { approverId: editApproverId } : {}),
      });
      toast.success('Đã cập nhật yêu cầu OT.');
      setEditDialogOpen(false);
      setEditItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật yêu cầu OT.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/overtime/${id}`);
      toast.success('Đã xóa yêu cầu OT.');
      setDeleteConfirmId(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa yêu cầu OT.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Quản lý Overtime
          </h1>
          {!isLoading && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: '#D3F2E7', color: '#0E474E' }}
            >
              {historyItems.length}
            </span>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#1DB87A' }}
            >
              <Plus size={15} />
              Đăng ký OT
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Đăng ký làm thêm giờ</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Ngày làm việc *
                </label>
                <DatePicker value={workDate} onChange={setWorkDate} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                    Giờ bắt đầu *
                  </label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                    Giờ kết thúc *
                  </label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Hình thức bù
                </label>
                <RadioGroup
                  value={compensationType}
                  onValueChange={(v) => setCompensationType(v as CompensationType)}
                  className="flex gap-4"
                >
                  {[
                    { val: 'COMP_OFF', label: 'Nghỉ bù (Comp-off)' },
                    { val: 'PAYMENT', label: 'Thanh toán tiền' },
                  ].map((option) => (
                    <label
                      key={option.val}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      style={{ color: '#203430' }}
                    >
                      <RadioGroupItem value={option.val} id={`comp-type-${option.val}`} />
                      {option.label}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Loại overtime
                </label>
                <RadioGroup value={otType} onValueChange={setOtType} className="flex flex-wrap gap-4">
                  {[
                    { val: 'weekday', label: 'Ngày thường' },
                    { val: 'weekend', label: 'Cuối tuần' },
                    { val: 'holiday', label: 'Ngày lễ' },
                  ].map((option) => (
                    <label
                      key={option.val}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                      style={{ color: '#203430' }}
                    >
                      <RadioGroupItem value={option.val} id={`ot-type-${option.val}`} />
                      {option.label}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {calc && (
                <div
                  className="rounded-lg border p-3"
                  style={{ background: '#f0fdf9', borderColor: '#D3F2E7' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: '#1DB87A' }}>
                        {calc.otHours.toFixed(1)}h
                      </p>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>Giờ OT</p>
                    </div>
                    {calc.compoff !== null ? (
                      <>
                        <p className="text-xs font-medium" style={{ color: '#0E474E' }}>
                          × {RATE[otType]}
                        </p>
                        <div className="text-center">
                          <p className="text-lg font-bold" style={{ color: '#0E474E' }}>
                            {calc.compoff.toFixed(1)}h
                          </p>
                          <p className="text-xs" style={{ color: '#6b7f78' }}>Comp-off</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-medium" style={{ color: '#6b7f78' }}>
                        Thanh toán tiền lương
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Lý do làm thêm giờ *
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do làm thêm giờ..."
                  className="resize-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Người duyệt
                </label>
                <Select value={approverId || 'auto'} onValueChange={(v) => setApproverId(v === 'auto' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tự động (theo cấu hình)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Tự động (theo cấu hình)</SelectItem>
                    {approvers.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#1DB87A' }}
                >
                  {isSubmitting ? 'Đang gửi...' : 'Gửi đăng ký'}
                </button>
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: '#e2ede9', color: '#203430' }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {errorMessage && (
        <div
          className="rounded-xl border p-3 text-sm font-medium"
          style={{ background: '#fff5f5', color: '#b91c1c', borderColor: '#fecaca' }}
        >
          {errorMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trạng thái duyệt */}
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7f78' }}>
            Trạng thái tháng này
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Chờ duyệt', value: monthlyPending.length, color: '#f59e0b' },
              { label: 'Đã duyệt', value: monthlyApproved.length, color: '#1DB87A' },
              { label: 'Từ chối', value: monthlyRejected.length, color: '#ef4444' },
              { label: 'Tổng', value: monthlyItems.length, color: '#203430' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>
                  {isLoading ? '—' : stat.value}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tổng quan giờ OT */}
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7f78' }}>
            Tổng quan giờ OT
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Tổng giờ OT', value: formatHours(monthlyTotalHours), color: '#3b82f6' },
              { label: 'Chờ duyệt', value: formatHours(monthlyPendingHours), color: '#f59e0b' },
              { label: 'Comp-off tích lũy', value: formatHours(compOffSummary?.totalHours), color: '#1DB87A' },
              { label: 'Comp-off KD', value: formatHours(compOffSummary?.availableHours), color: '#0E474E' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>
                  {isLoading ? '—' : stat.value}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="rounded-xl border bg-white" style={{ borderColor: '#e2ede9' }}>
        {/* Filter bar */}
        <div
          className="flex items-center gap-3 border-b px-5 py-3.5"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7f78' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              className="h-8 w-full rounded-lg border pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
              style={{ borderColor: '#d0e0db', color: '#203430' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X size={12} style={{ color: '#6b7f78' }} />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
            style={{ borderColor: '#d0e0db', color: '#203430' }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>

          <button
            type="button"
            onClick={() => void loadData()}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#f0fdf9]"
            style={{ color: '#0E474E' }}
          >
            <RefreshCw size={13} />
            Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f7f9f8' }}>
                {['Ngày OT', 'Giờ bắt đầu', 'Giờ kết thúc', 'Giờ OT', 'Loại', 'Hình thức', 'Lý do', 'Người tạo', 'Người duyệt', 'Trạng thái', 'Hành động'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold"
                    style={{ color: '#6b7f78' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((row) => {
                  const statusKey = getStatusLabel(row.status);
                  const style = STATUS_STYLE[statusKey] ?? STATUS_STYLE.pending;
                  const otTypeKey = row.otType ?? detectOtType(row.date);

                  return (
                    <tr
                      key={String(row.id)}
                      className="border-b last:border-0 hover:bg-[#fafdfb] transition-colors"
                      style={{ borderColor: '#f0f4f2' }}
                    >
                      <td className="px-5 py-3.5 text-xs font-medium" style={{ color: '#203430' }}>
                        {formatDateVN(row.date)}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#203430' }}>
                        {row.startTime ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#203430' }}>
                        {row.endTime ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-bold" style={{ color: '#203430' }}>
                        {formatHours(row.hours)}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#6b7f78' }}>
                        {OT_TYPE_LABEL[otTypeKey] ?? 'Ngày thường'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.compensationType === 'PAYMENT'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          }`}
                        >
                          {row.compensationType === 'PAYMENT' ? 'Thanh toán' : 'Nghỉ bù'}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3.5 text-xs max-w-[200px] truncate"
                        style={{ color: '#6b7f78' }}
                        title={row.reason ?? ''}
                      >
                        {row.reason || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#203430' }}>
                        {row.user?.fullName ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#6b7f78' }}>
                        {row.approver?.fullName ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {STATUS_LABEL[statusKey] ?? row.status ?? 'Chờ cập nhật'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {statusKey === 'pending' ? (
                          <div className="flex items-center gap-2">
                            {canApprove && (
                              <>
                                <button
                                  type="button"
                                  disabled={!!actionLoading[String(row.id)]}
                                  onClick={() => setConfirmAction({ type: 'approve', id: row.id })}
                                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                                  style={{ background: '#1DB87A' }}
                                >
                                  {actionLoading[String(row.id)] === 'approve' ? '...' : 'Duyệt'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!!actionLoading[String(row.id)]}
                                  onClick={() => setConfirmAction({ type: 'reject', id: row.id })}
                                  className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                                  style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                                >
                                  {actionLoading[String(row.id)] === 'reject' ? '...' : 'Từ chối'}
                                </button>
                              </>
                            )}
                            {currentUserId && String(row.user?.id) === currentUserId && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditDialog(row)}
                                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                                  style={{ borderColor: '#d0e0db', color: '#0E474E' }}
                                >
                                  <Pencil size={12} />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(row.id)}
                                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                                  style={{ borderColor: '#fecaca', color: '#b91c1c' }}
                                >
                                  <Trash2 size={12} />
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: '#6b7f78' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-sm" style={{ color: '#6b7f78' }}>
                    {isLoading ? 'Đang tải dữ liệu...' : 'Chưa có dữ liệu overtime.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comp-off section */}
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
        <div
          className="mb-4 flex items-center justify-between border-b pb-4"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2">
            <BedDouble size={16} style={{ color: '#1DB87A' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Tổng quan Comp-off
            </h2>
          </div>
          <Link
            href="/dashboard/compoff"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#D3F2E7', color: '#0E474E' }}
          >
            Quản lý chi tiết
          </Link>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Khả dụng', value: formatHours(compOffSummary?.availableHours), color: '#1DB87A' },
            { label: 'Sắp hết hạn', value: formatHours(compOffSummary?.expiringHours), color: '#f59e0b' },
            { label: 'Đã hết hạn', value: formatHours(compOffSummary?.expiredHours), color: '#ef4444' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border p-3"
              style={{ borderColor: '#e2ede9', background: '#fafdfb' }}
            >
              <p className="text-xl font-bold" style={{ color: item.color }}>
                {isLoading ? '—' : item.value}
              </p>
              <p className="text-xs" style={{ color: '#6b7f78' }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {compOffRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f7f9f8' }}>
                  {['Ngày OT', 'Giờ OT', 'Loại', 'Comp-off', 'Hạn sử dụng', 'Trạng thái'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold"
                      style={{ color: '#6b7f78' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compOffRows.map((row) => {
                  const otTypeKey = detectOtType(row.overtime?.date);
                  const statusKey = row.derivedStatus ?? 'available';
                  const style = STATUS_STYLE[statusKey] ?? STATUS_STYLE.available;
                  return (
                    <tr
                      key={String(row.id)}
                      className="border-b last:border-0"
                      style={{ borderColor: '#f0f4f2' }}
                    >
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: '#203430' }}>
                        {formatDateVN(row.overtime?.date)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                        {formatHours(row.overtime?.hours)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7f78' }}>
                        {OT_TYPE_LABEL[otTypeKey] ?? 'Ngày thường'}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: '#1DB87A' }}>
                        {formatHours(row.totalHours)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7f78' }}>
                        {formatDateVN(row.toDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {STATUS_LABEL[statusKey] ?? 'Có sẵn'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa yêu cầu OT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                Ngày làm việc *
              </label>
              <DatePicker value={editDate} onChange={setEditDate} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Giờ bắt đầu *
                </label>
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  required
                  className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                  Giờ kết thúc *
                </label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  required
                  className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold" style={{ color: '#203430' }}>
                Hình thức bù
              </label>
              <RadioGroup
                value={editCompType}
                onValueChange={(v) => setEditCompType(v as CompensationType)}
                className="flex gap-4"
              >
                {[
                  { val: 'COMP_OFF', label: 'Nghỉ bù (Comp-off)' },
                  { val: 'PAYMENT', label: 'Thanh toán tiền' },
                ].map((option) => (
                  <label key={option.val} className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: '#203430' }}>
                    <RadioGroupItem value={option.val} id={`edit-comp-${option.val}`} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                Lý do làm thêm giờ *
              </label>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={3}
                placeholder="Nhập lý do làm thêm giờ..."
                className="resize-none"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#203430' }}>
                Người duyệt
              </label>
              <Select value={editApproverId || 'auto'} onValueChange={(v) => setEditApproverId(v === 'auto' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tự động (theo cấu hình)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Tự động (theo cấu hình)</SelectItem>
                  {approvers.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isEditSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#1DB87A' }}
              >
                {isEditSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button
                type="button"
                onClick={() => setEditDialogOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: '#e2ede9', color: '#203430' }}
              >
                Hủy
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      {deleteConfirmId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,71,78,0.45)' }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: '#fee2e2' }}>
                <Trash2 size={20} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#203430' }}>Xác nhận xóa</h3>
                <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
                  Bạn có chắc muốn xóa yêu cầu OT này? Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
              >
                Hủy
              </button>
              <button
                disabled={isDeleting}
                onClick={() => void handleDelete(deleteConfirmId)}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#dc2626' }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,71,78,0.45)' }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: confirmAction.type === 'approve' ? '#d1fae5' : '#fee2e2' }}
              >
                {confirmAction.type === 'approve' ? (
                  <CheckCircle2 size={20} style={{ color: '#059669' }} />
                ) : (
                  <XCircle size={20} style={{ color: '#dc2626' }} />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#203430' }}>
                  {confirmAction.type === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
                  {confirmAction.type === 'approve'
                    ? 'Bạn có chắc muốn duyệt yêu cầu OT này?'
                    : 'Bạn có chắc muốn từ chối yêu cầu OT này?'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
              >
                Hủy
              </button>
              <button
                disabled={!!actionLoading[String(confirmAction.id)]}
                onClick={() => {
                  const { type, id } = confirmAction;
                  setConfirmAction(null);
                  void (type === 'approve' ? handleApprove(id) : handleReject(id));
                }}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: confirmAction.type === 'approve' ? '#059669' : '#dc2626' }}
              >
                {confirmAction.type === 'approve' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
