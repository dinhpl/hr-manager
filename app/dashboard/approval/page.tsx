'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import LeaveDetailModal, { LeaveDetailData } from '@/components/leave-detail-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { apiClient, getApiBaseUrl, getLeaveAttachmentUrl } from '@/lib/api-client';
import {
  buildQuery,
  formatDateTimeVN,
  formatDateVN,
  getDateTimeValue,
  numberValue,
} from '@/lib/hr-utils';

type DerivedStatus = 'pending' | 'overdue';

interface LeaveTypeOption {
  id: string;
  code: string;
  name: string;
  color?: string | null;
}

interface LeaveRequestItem {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  totalDays: number | string;
  reason?: string | null;
  durationMode?: string | null;
  fromTime?: string | null;
  toTime?: string | null;
  handoverPerson?: {
    id?: string;
    fullName?: string | null;
  } | null;
  attachmentUrl?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  user?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    avatar?: string | null;
    department?: string | null;
  };
  leaveType?: {
    id?: string;
    code?: string | null;
    name?: string | null;
    color?: string | null;
  };
  approver?: {
    id?: string;
    fullName?: string | null;
  } | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DashboardSummary {
  type: 'manager' | 'hr' | 'admin';
  stats: {
    totalEmployees: number;
    pendingRequests: number;
    todayRequests: number;
    weekApproved: number;
    overdueRequests: number;
  };
}

const PAGE_SIZE = 6;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function getEmployeeInitials(name?: string | null) {
  return (name || 'ND')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
  return null;
}

function getDisplayReason(reason?: string | null) {
  if (!reason) return '—';
  const normalized = reason.trim();
  return normalized || '—';
}

function isOverdue(request: LeaveRequestItem) {
  return Date.now() - getDateTimeValue(request.createdAt) > TWO_DAYS_MS;
}

function getDerivedStatus(request: LeaveRequestItem): DerivedStatus {
  return isOverdue(request) ? 'overdue' : 'pending';
}

function getOverdueDays(request: LeaveRequestItem) {
  const diff = Date.now() - getDateTimeValue(request.createdAt);
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)) - 1);
}

function toDetailData(request: LeaveRequestItem): LeaveDetailData {
  const department = request.user?.department?.trim();
  return {
    id: String(request.id),
    typeCode: request.leaveType?.code || '-',
    typeColor: request.leaveType?.color || undefined,
    fromDate: formatDateVN(request.fromDate),
    toDate: formatDateVN(request.toDate),
    days: numberValue(request.totalDays),
    reason: request.reason || '—',
    handover: request.handoverPerson?.fullName || '-',
    status: 'pending',
    submittedAt: formatDateTimeVN(request.createdAt),
    employeeName: request.user?.fullName || 'Nhân viên',
    employeeCode: request.user?.username || undefined,
    employeeTeam: department || 'Chưa có phòng ban',
    fileAttachment: request.attachmentUrl || undefined,
  };
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const safeStart = Math.max(1, end - 4);
  return Array.from({ length: end - safeStart + 1 }, (_, index) => safeStart + index);
}

export default function ApprovalPage() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [summary, setSummary] = useState<DashboardSummary['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string; name: string } | null>(null);
  const { openConfirm, closeConfirm, confirmDialog } = useConfirmDialog();

  const typeIdByCode = useMemo(
    () => Object.fromEntries(leaveTypes.map((type) => [type.code, type.id])),
    [leaveTypes],
  );

  useEffect(() => {
    let mounted = true;
    apiClient
      .get<LeaveTypeOption[]>('/api/leave-types')
      .then((response) => {
        if (!mounted) return;
        setLeaveTypes(response.data || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Không tải được loại nghỉ.');
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => { setCurrentPage(1); }, [deptFilter, typeFilter]);

  const buildPendingQuery = useCallback(() => {
    return buildQuery({
      status: 'PENDING',
      department: deptFilter || undefined,
      leaveTypeId: typeFilter ? typeIdByCode[typeFilter] : undefined,
      page: currentPage,
      limit: PAGE_SIZE,
    });
  }, [currentPage, deptFilter, typeFilter, typeIdByCode]);

  const loadPendingRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestResponse, summaryResponse] = await Promise.all([
        apiClient.get<LeaveRequestItem[]>(`/api/leave-requests?${buildPendingQuery()}`),
        apiClient.get<DashboardSummary>('/api/dashboard/summary'),
      ]);
      setRequests(requestResponse.data || []);
      setMeta({
        total: requestResponse.meta?.total || 0,
        page: requestResponse.meta?.page || currentPage,
        limit: requestResponse.meta?.limit || PAGE_SIZE,
        totalPages: Math.max(1, requestResponse.meta?.totalPages || 1),
      });
      setSummary(summaryResponse.data?.stats || null);
      if (
        requestResponse.meta?.totalPages &&
        currentPage > requestResponse.meta.totalPages &&
        requestResponse.meta.totalPages > 0
      ) {
        setCurrentPage(requestResponse.meta.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách yêu cầu chờ duyệt.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [buildPendingQuery, currentPage]);

  useEffect(() => { void loadPendingRequests(); }, [loadPendingRequests]);
  useEffect(() => { setSelectedIds([]); }, [requests]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map((r) => r.user?.department?.trim())
          .filter((d): d is string => Boolean(d)),
      ),
    );
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();
    return requests.filter((r) => {
      const derivedStatus = getDerivedStatus(r);
      const fullName = r.user?.fullName || '';
      if (statusFilter && derivedStatus !== statusFilter) return false;
      if (priorityFilter === 'high' && derivedStatus !== 'overdue') return false;
      if (priorityFilter === 'normal' && derivedStatus !== 'pending') return false;
      if (
        normalizedSearch &&
        !fullName.toLowerCase().includes(normalizedSearch) &&
        !String(r.id).toLowerCase().includes(normalizedSearch) &&
        !(r.user?.username || '').toLowerCase().includes(normalizedSearch)
      ) return false;
      return true;
    });
  }, [priorityFilter, requests, searchInput, statusFilter]);

  const pendingCount = meta.total;
  const overduePageCount = requests.filter(isOverdue).length;
  const selectedAllOnPage =
    filteredRequests.length > 0 &&
    filteredRequests.every((r) => selectedIds.includes(String(r.id)));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const pageIds = filteredRequests.map((r) => String(r.id));
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : pageIds);
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      const note = notes[id]?.trim();
      await apiClient.patch(`/api/leave-requests/${id}/approve`, note ? { note } : {});
      setNotes((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast.success(`Đã duyệt yêu cầu #${id}`);
      await loadPendingRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể duyệt yêu cầu.';
      setError(message);
      toast.error(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      const note = notes[id]?.trim();
      await apiClient.patch(`/api/leave-requests/${id}/reject`, note ? { note } : {});
      setNotes((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast.success(`Đã từ chối yêu cầu #${id}`);
      await loadPendingRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể từ chối yêu cầu.';
      setError(message);
      toast.error(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const executeBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setActionLoadingId('bulk');
    try {
      await apiClient.post('/api/leave-requests/bulk-approve', { ids: selectedIds });
      setSelectedIds([]);
      toast.success(`Đã duyệt ${selectedIds.length} yêu cầu`);
      await loadPendingRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể duyệt hàng loạt.';
      setError(message);
      toast.error(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRefresh = () => {
    setNotes({});
    setSelectedIds([]);
    setStatusFilter('');
    setDeptFilter('');
    setTypeFilter('');
    setPriorityFilter('');
    setSearchInput('');
    setCurrentPage(1);
    setSelectedDetail(null);
    closeConfirm();
    void loadPendingRequests();
  };

  const handleView = async (id: string) => {
    setDetailLoadingId(id);
    try {
      const response = await apiClient.get<LeaveRequestItem>(`/api/leave-requests/${id}`);
      setSelectedDetail(toDetailData(response.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết yêu cầu.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const hasActiveFilters = !!(statusFilter || deptFilter || typeFilter || priorityFilter || searchInput);
  const visiblePages = getVisiblePages(meta.page, meta.totalPages);

  return (
    <div className="space-y-5">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: '#D3F2E7' }}
            >
              <CheckCircle2 size={16} style={{ color: '#0E474E' }} />
            </div>
            <h1 className="text-lg font-bold" style={{ color: '#0f2420' }}>
              Duyệt yêu cầu nghỉ phép
            </h1>
            {pendingCount > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ background: '#1DB87A' }}
              >
                {pendingCount}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: '#9eb5ae' }}>
            Xem xét và xử lý các yêu cầu nghỉ phép đang chờ duyệt
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() =>
                openConfirm({
                  title: 'Duyệt hàng loạt',
                  message: `Bạn có chắc muốn duyệt ${selectedIds.length} yêu cầu đã chọn?`,
                  confirmLabel: 'Duyệt tất cả',
                  onConfirm: executeBulkApprove,
                })
              }
              disabled={actionLoadingId === 'bulk'}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#1DB87A' }}
            >
              <CheckCircle size={14} />
              Duyệt hàng loạt
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-xs font-bold">
                {selectedIds.length}
              </span>
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-[#f0f7f4]"
            style={{ borderColor: '#d4e8de', color: '#2a7a5a' }}
          >
            <RefreshCw size={14} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Đang chờ duyệt',
            value: pendingCount,
            icon: Clock,
            color: '#d97706',
            bg: '#fef9ec',
            border: '#fde68a',
          },
          {
            label: 'Quá hạn xử lý',
            value: overduePageCount,
            icon: AlertTriangle,
            color: '#dc2626',
            bg: '#fef2f2',
            border: '#fecaca',
          },
          {
            label: 'Đã duyệt tuần này',
            value: summary?.weekApproved ?? 0,
            icon: CheckCircle,
            color: '#059669',
            bg: '#f0fdf4',
            border: '#bbf7d0',
          },
          {
            label: 'Luồng HR riêng',
            value: 0,
            icon: Users,
            color: '#2563eb',
            bg: '#eff6ff',
            border: '#bfdbfe',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
              >
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{ color: '#0f2420' }}>
                {stat.value}
              </span>
            </div>
            <p className="mt-3 text-xs font-medium" style={{ color: '#6b7f78' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR: Filters + Search + Select All ── */}
      <div
        className="rounded-xl border bg-white px-4 py-3"
        style={{ borderColor: '#e2ede9' }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 self-end pb-0.5">
            <SlidersHorizontal size={14} style={{ color: '#9eb5ae' }} />
            <span className="text-xs font-semibold" style={{ color: '#9eb5ae' }}>Lọc</span>
          </div>

          {[
            {
              id: 'status',
              label: 'Trạng thái',
              value: statusFilter,
              setter: setStatusFilter,
              options: [['', 'Tất cả'], ['pending', 'Chờ duyệt'], ['overdue', 'Quá hạn']],
            },
            {
              id: 'dept',
              label: 'Phòng ban',
              value: deptFilter,
              setter: setDeptFilter,
              options: [['', 'Tất cả phòng ban'], ...departmentOptions.map((d) => [d, d])],
            },
            {
              id: 'type',
              label: 'Loại nghỉ',
              value: typeFilter,
              setter: setTypeFilter,
              options: [['', 'Tất cả loại'], ...leaveTypes.map((t) => [t.code, `${t.code} – ${t.name}`])],
            },
            {
              id: 'priority',
              label: 'Ưu tiên',
              value: priorityFilter,
              setter: setPriorityFilter,
              options: [['', 'Tất cả'], ['high', 'Ưu tiên cao'], ['normal', 'Bình thường']],
            },
          ].map((filter) => (
            <div key={filter.id} className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>
                {filter.label}
              </label>
              <Select
                value={filter.value || `all-${filter.id}`}
                onValueChange={(v) => filter.setter(v.startsWith('all-') ? '' : v)}
              >
                <SelectTrigger className="h-8 min-w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map(([value, label]) => {
                    const itemValue = value === '' ? `all-${filter.id}` : value;
                    return (
                      <SelectItem key={`${filter.id}-${itemValue}`} value={itemValue} className="text-xs">
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}

          <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 200 }}>
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>
              Tìm kiếm
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#9eb5ae' }} />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tên hoặc mã nhân viên..."
                className="h-8 pl-8 text-xs"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer opacity-40 hover:opacity-70"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter(''); setDeptFilter(''); setTypeFilter(''); setPriorityFilter(''); setSearchInput(''); }}
              className="inline-flex cursor-pointer items-center gap-1 self-end rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-red-50"
              style={{ borderColor: '#fecaca', color: '#dc2626' }}
            >
              <X size={11} /> Xóa lọc
            </button>
          )}
        </div>

        {/* Select-all row */}
        {filteredRequests.length > 0 && (
          <div className="mt-3 flex items-center gap-3 border-t pt-3" style={{ borderColor: '#f0f7f4' }}>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium" style={{ color: '#6b7f78' }}>
              <Checkbox
                checked={selectedAllOnPage}
                onCheckedChange={toggleAll}
                className="data-[state=checked]:border-[#1DB87A] data-[state=checked]:bg-[#1DB87A]"
              />
              Chọn tất cả trang này ({filteredRequests.length})
            </label>
            {selectedIds.length > 0 && (
              <span className="text-xs" style={{ color: '#9eb5ae' }}>
                Đã chọn {selectedIds.length} yêu cầu
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── REQUEST LIST ── */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-100" />
                  <div className="h-2.5 w-20 rounded bg-gray-100" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 w-full rounded bg-gray-100" />
                <div className="h-2.5 w-3/4 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16" style={{ borderColor: '#e2ede9' }}>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#f0f7f4' }}>
            <CheckCircle2 size={22} style={{ color: '#b8d4ca' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#6b7f78' }}>Không có yêu cầu nào</p>
          <p className="mt-1 text-xs" style={{ color: '#9eb5ae' }}>
            {hasActiveFilters ? 'Không tìm thấy kết quả với bộ lọc hiện tại.' : 'Tất cả yêu cầu đã được xử lý.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter(''); setDeptFilter(''); setTypeFilter(''); setPriorityFilter(''); setSearchInput(''); }}
              className="mt-4 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#f0f7f4]"
              style={{ borderColor: '#d4e8de', color: '#2a7a5a' }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredRequests.map((request) => {
            const derivedStatus = getDerivedStatus(request);
            const requestId = String(request.id);
            const fullName = request.user?.fullName || 'Nhân viên';
            const code = request.user?.username || 'N/A';
            const department = request.user?.department || 'Chưa có phòng ban';
            const noteValue = notes[requestId] || '';
            const overdueDays = getOverdueDays(request);
            const isSelected = selectedIds.includes(requestId);
            const isLoading = actionLoadingId === requestId;
            const isViewLoading = detailLoadingId === requestId;
            const accentColor = derivedStatus === 'overdue' ? '#dc2626' : '#1DB87A';
            const avatarUrl = getAvatarUrl(request.user?.avatar);
            const leaveTypeCode = request.leaveType?.code || '—';
            const leaveTypeName = request.leaveType?.name || 'Chưa xác định';
            const leaveTypeLabel =
              leaveTypeCode !== '—' && leaveTypeName !== 'Chưa xác định'
                ? `${leaveTypeCode} · ${leaveTypeName}`
                : leaveTypeCode !== '—'
                  ? leaveTypeCode
                  : leaveTypeName;

            return (
              <div
                key={requestId}
                className="overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
                style={{
                  borderColor: isSelected ? accentColor : '#e2ede9',
                  borderLeftWidth: 3,
                  borderLeftColor: accentColor,
                }}
              >
                {/* Card top: Employee info + status */}
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={fullName}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                        >
                          {getEmployeeInitials(fullName)}
                        </div>
                      )}
                      {derivedStatus === 'overdue' && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: '#0f2420' }}>
                        {fullName}
                        <span className="ml-1.5 font-mono text-xs font-normal" style={{ color: '#9eb5ae' }}>
                          {code}
                        </span>
                      </p>
                      <p className="text-xs" style={{ color: '#8ba89f' }}>{department}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: derivedStatus === 'overdue' ? '#fef2f2' : '#f0f7f4',
                        color: derivedStatus === 'overdue' ? '#dc2626' : '#059669',
                        border: `1px solid ${derivedStatus === 'overdue' ? '#fecaca' : '#bbf7d0'}`,
                      }}
                    >
                      {derivedStatus === 'overdue'
                        ? <><AlertTriangle size={10} /> Quá hạn {overdueDays > 0 ? `${overdueDays}n` : ''}</>
                        : <><Clock size={10} /> Chờ duyệt</>
                      }
                    </span>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(requestId)}
                      className="data-[state=checked]:border-[#1DB87A] data-[state=checked]:bg-[#1DB87A]"
                    />
                  </div>
                </div>

                {/* Leave info */}
                <div className="px-4 pt-3 pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-lg border-2 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white shadow-sm"
                      style={{
                        background: request.leaveType?.color || '#6b7280',
                        borderColor: request.leaveType?.color || '#6b7280',
                      }}
                    >
                      Loại nghỉ: {leaveTypeLabel}
                    </span>
                    <span className="text-sm font-semibold" style={{ color: '#203430' }}>
                      {formatDateVN(request.fromDate)}
                      {numberValue(request.totalDays) > 1 ? ` – ${formatDateVN(request.toDate)}` : ''}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: '#f0f7f4', color: '#2a7a5a' }}
                    >
                      {numberValue(request.totalDays)} ngày
                    </span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 rounded-lg px-3 py-2.5" style={{ background: '#f8faf9' }}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Lý do</span>
                        <p className="mt-0.5 text-xs font-medium leading-relaxed whitespace-pre-line" style={{ color: '#48635b' }}>
                          {getDisplayReason(request.reason)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Bàn giao</span>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: '#48635b' }}>
                          {request.handoverPerson?.fullName || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Người duyệt</span>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: '#48635b' }}>
                          {request.approver?.fullName || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Gửi lúc</span>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: '#48635b' }}>
                          {formatDateTimeVN(request.createdAt)}
                        </p>
                      </div>
                    </div>

                    {request.attachmentUrl && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <FileText size={11} style={{ color: '#3b82f6' }} />
                        <span className="truncate text-[11px]" style={{ color: '#3b82f6' }}>
                          {request.attachmentUrl}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Overdue alert */}
                {derivedStatus === 'overdue' && (
                  <div className="mx-4 mt-2.5 flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                    <AlertTriangle size={12} style={{ color: '#dc2626' }} className="shrink-0" />
                    <p className="text-[11px]" style={{ color: '#991b1b' }}>
                      Yêu cầu đã chờ xử lý quá 2 ngày — được gắn ưu tiên cao.
                    </p>
                  </div>
                )}

                {/* Note + Actions */}
                <div className="space-y-3 px-4 pb-4 pt-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>
                      Ghi chú duyệt
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Nhập ghi chú (tùy chọn)..."
                      value={noteValue}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [requestId]: e.target.value }))}
                      className="resize-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmAction({ type: 'approve', id: requestId, name: fullName })}
                      disabled={!!actionLoadingId}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: '#1DB87A' }}
                    >
                      {isLoading ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      Duyệt
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'reject', id: requestId, name: fullName })}
                      disabled={!!actionLoadingId}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: '#fecaca', color: '#dc2626' }}
                    >
                      <X size={14} />
                      Từ chối
                    </button>
                    <button
                      onClick={() => void handleView(requestId)}
                      disabled={isViewLoading}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-blue-50 disabled:opacity-50"
                      style={{ borderColor: '#e2ede9' }}
                      title="Xem chi tiết"
                    >
                      {isViewLoading
                        ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        : <Eye size={14} style={{ color: '#3b82f6' }} />
                      }
                    </button>
                    {request.attachmentUrl && (
                      <button
                        onClick={() => {
                          const attachmentHref = getLeaveAttachmentUrl(request.attachmentUrl);
                          if (attachmentHref) {
                            window.open(attachmentHref, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-emerald-50"
                        style={{ borderColor: '#e2ede9' }}
                        title="Tải file đính kèm"
                      >
                        <Download size={14} style={{ color: '#1DB87A' }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Request ID strip */}
                <div className="border-t px-4 py-2" style={{ borderColor: '#f0f7f4' }}>
                  <span className="font-mono text-[10px]" style={{ color: '#c4d6d0' }}>#{requestId}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />
      {confirmDialog}

      {/* ── CONFIRM DIALOG ── */}
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
                    ? `Bạn có chắc muốn duyệt yêu cầu của ${confirmAction.name}?`
                    : `Bạn có chắc muốn từ chối yêu cầu của ${confirmAction.name}?`}
                </p>
                {notes[confirmAction.id]?.trim() && (
                  <p
                    className="mt-1 text-xs italic"
                    style={{ color: confirmAction.type === 'approve' ? '#6b7f78' : '#dc2626' }}
                  >
                    Ghi chú: {notes[confirmAction.id]}
                  </p>
                )}
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
                onClick={() => {
                  const { type, id } = confirmAction;
                  setConfirmAction(null);
                  void (type === 'approve' ? handleApprove(id) : handleReject(id));
                }}
                disabled={actionLoadingId === confirmAction.id}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: confirmAction.type === 'approve' ? '#059669' : '#dc2626' }}
              >
                {confirmAction.type === 'approve' ? 'Duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGINATION ── */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: '#9eb5ae' }}>
            Trang {meta.page}/{meta.totalPages} · {meta.total} yêu cầu
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={meta.page === 1}
              className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-[#f0f7f4] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
            >
              <ChevronLeft size={13} /> Trước
            </button>
            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-medium transition-colors"
                style={{
                  borderColor: page === meta.page ? '#1DB87A' : '#e2ede9',
                  background: page === meta.page ? '#1DB87A' : undefined,
                  color: page === meta.page ? 'white' : '#6b7f78',
                }}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page === meta.totalPages}
              className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-[#f0f7f4] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
            >
              Sau <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
