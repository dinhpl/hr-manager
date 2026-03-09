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
} from 'lucide-react';
import { toast } from 'sonner';
import LeaveDetailModal, { LeaveDetailData } from '@/components/leave-detail-modal';
import ConfirmDialog from '@/components/confirm-dialog';
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
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
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
  handoverPerson?: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  user?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
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

const CARD_HEADER: Record<
  DerivedStatus,
  { bg: string; text: string; label: string; icon: React.ReactNode }
> = {
  overdue: {
    bg: '#dc2626',
    text: 'white',
    icon: <AlertTriangle size={14} />,
    label: 'Quá hạn duyệt',
  },
  pending: {
    bg: '#06b6d4',
    text: 'white',
    icon: <Clock size={14} />,
    label: 'Chờ duyệt',
  },
};

function getEmployeeInitials(name?: string | null) {
  return (name || 'ND')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getPrimaryReason(reason?: string | null) {
  if (!reason) return '—';
  const [firstLine] = reason
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return firstLine || '—';
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
    handover: request.handoverPerson || '-',
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
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
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

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [deptFilter, typeFilter]);

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

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  useEffect(() => {
    setSelectedIds([]);
  }, [requests]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map((request) => request.user?.department?.trim())
          .filter((department): department is string => Boolean(department)),
      ),
    );
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();

    return requests.filter((request) => {
      const derivedStatus = getDerivedStatus(request);
      const fullName = request.user?.fullName || '';

      if (statusFilter && derivedStatus !== statusFilter) return false;
      if (priorityFilter === 'high' && derivedStatus !== 'overdue') return false;
      if (priorityFilter === 'normal' && derivedStatus !== 'pending') return false;
      if (
        normalizedSearch &&
        !fullName.toLowerCase().includes(normalizedSearch) &&
        !String(request.id).toLowerCase().includes(normalizedSearch) &&
        !(request.user?.username || '').toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [priorityFilter, requests, searchInput, statusFilter]);

  const pendingCount = meta.total;
  const overduePageCount = requests.filter(isOverdue).length;
  const selectedAllOnPage =
    filteredRequests.length > 0 &&
    filteredRequests.every((request) => selectedIds.includes(String(request.id)));

  const toggleSelect = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const toggleAll = () => {
    const pageIds = filteredRequests.map((request) => String(request.id));
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : pageIds);
  };

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);

    try {
      const note = notes[id]?.trim();
      await apiClient.patch(`/api/leave-requests/${id}/approve`, note ? { note } : {});
      setNotes((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
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
      setNotes((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
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
      setBulkConfirmOpen(false);
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
    setBulkConfirmOpen(false);
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

  const visiblePages = getVisiblePages(meta.page, meta.totalPages);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: '#D3F2E7' }}
          >
            <CheckCircle2 size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Duyệt yêu cầu nghỉ phép
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => selectedIds.length > 0 && setBulkConfirmOpen(true)}
            disabled={selectedIds.length === 0 || actionLoadingId === 'bulk'}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: '#1DB87A', color: '#1DB87A' }}
          >
            <CheckCircle size={14} />
            Duyệt hàng loạt
            {selectedIds.length > 0 ? (
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                style={{ background: '#1DB87A' }}
              >
                {selectedIds.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>
      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: '#fecaca',
            background: '#fef2f2',
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Chờ duyệt',
            value: pendingCount,
            icon: Clock,
            color: '#f59e0b',
            bg: '#fffbeb',
          },
          {
            label: 'Quá hạn trên trang',
            value: overduePageCount,
            icon: AlertTriangle,
            color: '#ef4444',
            bg: '#fef2f2',
          },
          {
            label: 'Đã duyệt tuần này',
            value: summary?.weekApproved ?? 0,
            icon: CheckCircle,
            color: '#1DB87A',
            bg: '#f0fdf9',
          },
          {
            label: 'Luồng HR riêng',
            value: 0,
            icon: Users,
            color: '#3b82f6',
            bg: '#eff6ff',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: stat.bg }}
            >
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#203430' }}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="flex flex-wrap items-end gap-3">
          {[
            {
              id: 'status',
              label: 'Trạng thái',
              value: statusFilter,
              setter: setStatusFilter,
              options: [
                ['', 'Tất cả'],
                ['pending', 'Chờ duyệt'],
                ['overdue', 'Quá hạn'],
              ],
            },
            {
              id: 'dept',
              label: 'Phòng ban',
              value: deptFilter,
              setter: setDeptFilter,
              options: [
                ['', 'Tất cả phòng ban'],
                ...departmentOptions.map((department) => [department, department]),
              ],
            },
            {
              id: 'type',
              label: 'Loại nghỉ',
              value: typeFilter,
              setter: setTypeFilter,
              options: [
                ['', 'Tất cả loại'],
                ...leaveTypes.map((type) => [type.code, `${type.code} - ${type.name}`]),
              ],
            },
            {
              id: 'priority',
              label: 'Độ ưu tiên',
              value: priorityFilter,
              setter: setPriorityFilter,
              options: [
                ['', 'Tất cả'],
                ['high', 'Ưu tiên cao'],
                ['normal', 'Bình thường'],
              ],
            },
          ].map((filter) => (
            <div key={filter.id} className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                {filter.label}
              </label>
              <Select
                value={filter.value || `all-${filter.id}`}
                onValueChange={(value) => filter.setter(value.startsWith('all-') ? '' : value)}
              >
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map(([value, label]) => {
                    const itemValue = value === '' ? `all-${filter.id}` : value;
                    return (
                      <SelectItem key={`${filter.id}-${itemValue}`} value={itemValue}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex min-w-[220px] flex-1 items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Tìm nhân viên
              </label>
              <Input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên hoặc mã nhân viên..."
              />
            </div>
            <button
              className="flex items-center h-[36px] gap-1.5 rounded-lg px-4 py-2 font-semibold text-white"
              style={{ background: '#1DB87A' }}
            >
              <Search size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {loading ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground lg:col-span-2">
            Đang tải yêu cầu chờ duyệt từ API...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-muted-foreground lg:col-span-2">
            Không có yêu cầu chờ duyệt phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredRequests.map((request) => {
            const derivedStatus = getDerivedStatus(request);
            const header = CARD_HEADER[derivedStatus];
            const requestId = String(request.id);
            const fullName = request.user?.fullName || 'Nhân viên';
            const code = request.user?.username || 'N/A';
            const department = request.user?.department || 'Chưa có phòng ban';
            const noteValue = notes[requestId] || '';
            const overdueDays = getOverdueDays(request);

            return (
              <div
                key={requestId}
                className="overflow-hidden rounded-xl border bg-white transition-all hover:shadow-md"
                style={{
                  borderColor: '#e2ede9',
                  borderLeft: `4px solid ${header.bg}`,
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: header.bg, color: header.text }}
                >
                  <div className="flex items-center gap-2">
                    {header.icon}
                    <span className="text-sm font-semibold">
                      {header.label} - ID: #{requestId}
                    </span>
                    {derivedStatus === 'overdue' && overdueDays > 0 ? (
                      <span
                        className="animate-pulse rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ background: 'rgba(255,255,255,0.25)' }}
                      >
                        Quá hạn {overdueDays} ngày
                      </span>
                    ) : null}
                  </div>
                  <Checkbox
                    checked={selectedIds.includes(requestId)}
                    onCheckedChange={() => toggleSelect(requestId)}
                    className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0E474E]"
                  />
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                      }}
                    >
                      {getEmployeeInitials(fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                        {fullName} ({code})
                      </p>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        {department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-2 py-0.5 text-xs font-bold text-white"
                          style={{ background: request.leaveType?.color || '#6b7280' }}
                        >
                          {request.leaveType?.code || '-'}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: '#203430' }}>
                          {formatDateVN(request.fromDate)}
                          {numberValue(request.totalDays) > 1
                            ? ` - ${formatDateVN(request.toDate)}`
                            : ''}
                          {` (${numberValue(request.totalDays)} ngày)`}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        <strong style={{ color: '#203430' }}>Lý do:</strong>{' '}
                        {getPrimaryReason(request.reason)}
                      </p>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        <strong style={{ color: '#203430' }}>Người bàn giao:</strong>{' '}
                        {request.handoverPerson || '-'}
                      </p>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        Gửi: {formatDateTimeVN(request.createdAt)}
                      </p>
                      {request.attachmentUrl ? (
                        <div
                          className="flex items-center gap-1 text-xs"
                          style={{ color: '#3b82f6' }}
                        >
                          <Download size={11} />
                          <span>File đính kèm: {request.attachmentUrl}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {derivedStatus === 'overdue' ? (
                    <div
                      className="rounded-lg p-2.5 text-xs"
                      style={{
                        background: '#fef2f2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                      }}
                    >
                      Yêu cầu này đang chờ xử lý quá 2 ngày nên được gắn mức ưu tiên cao.
                    </div>
                  ) : null}

                  <div>
                    <label
                      className="mb-1 block text-xs font-semibold"
                      style={{ color: '#6b7f78' }}
                    >
                      Ghi chú duyệt
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Nhập ghi chú (tùy chọn)..."
                      value={noteValue}
                      onChange={(event) =>
                        setNotes((previous) => ({
                          ...previous,
                          [requestId]: event.target.value,
                        }))
                      }
                      className="resize-none text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleApprove(requestId)}
                      disabled={!!actionLoadingId}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: '#1DB87A' }}
                    >
                      <CheckCircle size={14} /> Duyệt
                    </button>
                    <button
                      onClick={() => void handleReject(requestId)}
                      disabled={!!actionLoadingId}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ background: '#ef4444' }}
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => void handleView(requestId)}
                      disabled={detailLoadingId === requestId}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-blue-50 disabled:opacity-50"
                      style={{ borderColor: '#e2ede9' }}
                      title="Xem chi tiết"
                    >
                      <Eye size={15} style={{ color: '#3b82f6' }} />
                    </button>
                    {request.attachmentUrl ? (
                      <button
                        onClick={() =>
                          window.open(
                            `${getApiBaseUrl()}/uploads/${request.attachmentUrl}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-emerald-50"
                        style={{ borderColor: '#e2ede9' }}
                        title="Tải file đính kèm"
                      >
                        <Download size={15} style={{ color: '#1DB87A' }} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Duyệt hàng loạt"
        message={`Bạn có chắc muốn duyệt ${selectedIds.length} yêu cầu đã chọn?`}
        confirmLabel="Duyệt tất cả"
        onConfirm={executeBulkApprove}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={meta.page === 1}
          className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
        >
          <ChevronLeft size={14} /> Trước
        </button>
        {visiblePages.map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors"
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
          onClick={() => setCurrentPage((page) => Math.min(meta.totalPages, page + 1))}
          disabled={meta.page === meta.totalPages}
          className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
        >
          Sau <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
