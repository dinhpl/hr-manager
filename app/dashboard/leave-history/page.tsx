'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileDown,
  Filter,
  History,
  List,
  Pencil,
  PlusCircle,
  Printer,
  X,
  XCircle,
} from 'lucide-react';
import LeaveDetailModal, { LeaveDetailData } from '@/components/leave-detail-modal';
import LeaveRequestModal, { type LeaveRequestData } from '@/components/leave-request-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { apiClient, getApiBaseUrl, getStoredUser } from '@/lib/api-client';
import {
  buildApiDateTime,
  buildQuery,
  formatDateTimeVN,
  formatDateVN,
  getDateTimeValue,
  getLeaveRequestReasonInput,
  inferLeaveRequestModeFromDbValue,
  numberValue,
  toDateInputValue,
  toFrontendRole,
} from '@/lib/hr-utils';

type StatusKey = 'pending' | 'approved' | 'rejected' | 'cancelled';

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
  durationMode?: string | null;
  totalDays: number | string;
  reason?: string | null;
  handoverPerson?: { id?: string; fullName?: string | null } | null;
  attachmentUrl?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  approvedNote?: string | null;
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

interface LeaveRecord {
  id: string;
  userName: string;
  type: { code: string; label: string; color: string };
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  handover: string;
  status: StatusKey;
  submittedAt: string;
  submittedAtValue: number;
  approver: string;
  approverRole: string;
  approvedAt: string;
  attachmentUrl?: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TYPE_COLORS: Record<string, string> = {
  AL: '#3b82f6',
  SL: '#10b981',
  ML: '#f97316',
  WFH: '#8b5cf6',
  CO: '#1DB87A',
  PL: '#6b7280',
  CSL: '#ec4899',
  UL: '#f59e0b',
  BT: '#0ea5e9',
};

const STATUS_CONFIG: Record<StatusKey, { label: string; badge: string }> = {
  pending: {
    label: 'Chờ duyệt',
    badge: 'bg-amber-50 text-amber-600 border border-amber-200',
  },
  approved: {
    label: 'Đã duyệt',
    badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  },
  rejected: {
    label: 'Từ chối',
    badge: 'bg-red-50 text-red-500 border border-red-200',
  },
  cancelled: {
    label: 'Đã hủy',
    badge: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
};

const ROW_BG: Record<StatusKey, string> = {
  pending: '#fffbf0',
  approved: '#f0fdf9',
  rejected: '#fff5f5',
  cancelled: '#f8fafc',
};

function normalizeStatus(status?: string | null): StatusKey {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function getPeriodRange(period: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'thisWeek') {
    const offset = now.getDay() === 0 ? 6 : now.getDay() - 1;
    start.setDate(now.getDate() - offset);
    end.setDate(start.getDate() + 6);
  } else if (period === 'lastMonth') {
    start.setMonth(now.getMonth() - 1, 1);
    end.setMonth(now.getMonth(), 0);
  } else if (period === 'thisYear') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  } else {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
  }

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
}

function getPrimaryReason(reason?: string | null) {
  if (!reason) return '—';
  const [firstLine] = reason
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return firstLine || '—';
}

function mapToRecord(item: LeaveRequestItem): LeaveRecord {
  const code = item.leaveType?.code || '-';
  const label = item.leaveType?.name ? `${code} - ${item.leaveType.name}` : code;

  return {
    id: String(item.id),
    userName: item.user?.fullName || item.user?.username || '-',
    type: {
      code,
      label,
      color: item.leaveType?.color || TYPE_COLORS[code] || '#6b7280',
    },
    fromDate: formatDateVN(item.fromDate),
    toDate: formatDateVN(item.toDate),
    days: numberValue(item.totalDays),
    reason: getPrimaryReason(item.reason),
    handover: item.handoverPerson?.fullName || '-',
    status: normalizeStatus(item.status),
    submittedAt: formatDateTimeVN(item.createdAt),
    submittedAtValue: getDateTimeValue(item.createdAt),
    approver: item.approver?.fullName || '-',
    approverRole: item.approver?.fullName ? 'Người duyệt' : '',
    approvedAt: item.approvedAt ? formatDateTimeVN(item.approvedAt) : '-',
    attachmentUrl: item.attachmentUrl,
  };
}

function toDetailData(item: LeaveRequestItem): LeaveDetailData {
  return {
    id: String(item.id),
    typeCode: item.leaveType?.code || '-',
    typeColor: item.leaveType?.color || TYPE_COLORS[item.leaveType?.code || ''] || '#6b7280',
    fromDate: formatDateVN(item.fromDate),
    toDate: formatDateVN(item.toDate),
    days: numberValue(item.totalDays),
    reason: item.reason || '—',
    handover: item.handoverPerson?.fullName || '-',
    status: normalizeStatus(item.status),
    submittedAt: formatDateTimeVN(item.createdAt),
    approver: item.approver?.fullName || undefined,
    approverRole: item.approver?.fullName ? 'Người duyệt' : undefined,
    approvedAt: item.approvedAt ? formatDateTimeVN(item.approvedAt) : undefined,
    approvedNote: item.approvedNote || undefined,
    fileAttachment: item.attachmentUrl || undefined,
  };
}

function toEditData(item: LeaveRequestItem): LeaveRequestData {
  return {
    id: String(item.id),
    typeCode: item.leaveType?.code || undefined,
    requestForUserId: item.user?.id || undefined,
    fromDate: toDateInputValue(item.fromDate),
    toDate: toDateInputValue(item.toDate),
    durationMode: inferLeaveRequestModeFromDbValue(item.durationMode),
    reason: getLeaveRequestReasonInput(item.reason),
    handoverPersonId: item.handoverPerson?.id || '',
    approverId: item.approver?.id || '',
  };
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const safeStart = Math.max(1, end - 4);
  return Array.from({ length: end - safeStart + 1 }, (_, index) => safeStart + index);
}

export default function LeaveHistoryPage() {
  const initialRange = useMemo(() => getPeriodRange('thisMonth'), []);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [editingRequest, setEditingRequest] = useState<ReturnType<typeof toEditData> | null>(null);
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('thisMonth');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [dayRangeFilter, setDayRangeFilter] = useState('all-days');
  const [searchInput, setSearchInput] = useState('');
  const [approverFilter, setApproverFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [pageSize, setPageSize] = useState('25');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });
  const [counts, setCounts] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { openConfirm, confirmDialog } = useConfirmDialog();

  const storedUser = getStoredUser<{ role?: string }>();
  const isEmployee = toFrontendRole(storedUser?.role) === 'employee';

  const pageSizeNum = Number(pageSize);
  const typeIdByCode = useMemo(
    () => Object.fromEntries(leaveTypes.map((type) => [type.code, type.id])),
    [leaveTypes],
  );

  useEffect(() => {
    if (periodFilter === 'custom') return;
    const range = getPeriodRange(periodFilter);
    setFromDate(range.from);
    setToDate(range.to);
  }, [periodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, fromDate, toDate, pageSize]);

  useEffect(() => {
    setSelectedIds([]);
  }, [records]);

  useEffect(() => {
    let mounted = true;

    apiClient
      .get<LeaveTypeOption[]>('/api/leave-types')
      .then((leaveTypeResponse) => {
        if (!mounted) return;
        setLeaveTypes(leaveTypeResponse.data || []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu bộ lọc.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const buildServerQuery = useCallback(
    (overrides?: Record<string, string | number | undefined>) => {
      const leaveTypeId = typeFilter ? typeIdByCode[typeFilter] : undefined;
      return buildQuery({
        scope: 'global',
        page: currentPage,
        limit: pageSizeNum,
        status: statusFilter || undefined,
        leaveTypeId,
        fromDate: fromDate ? buildApiDateTime(fromDate, '00:00') : undefined,
        toDate: toDate ? buildApiDateTime(toDate, '23:59') : undefined,
        ...overrides,
      });
    },
    [currentPage, fromDate, pageSizeNum, statusFilter, toDate, typeFilter, typeIdByCode],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [listResponse, totalResponse, approvedResponse, pendingResponse, rejectedResponse] =
        await Promise.all([
          apiClient.get<LeaveRequestItem[]>(`/api/leave-requests?${buildServerQuery()}`),
          apiClient.get<LeaveRequestItem[]>(
            `/api/leave-requests?${buildServerQuery({ page: 1, limit: 1, status: undefined })}`,
          ),
          apiClient.get<LeaveRequestItem[]>(
            `/api/leave-requests?${buildServerQuery({ page: 1, limit: 1, status: 'APPROVED' })}`,
          ),
          apiClient.get<LeaveRequestItem[]>(
            `/api/leave-requests?${buildServerQuery({ page: 1, limit: 1, status: 'PENDING' })}`,
          ),
          apiClient.get<LeaveRequestItem[]>(
            `/api/leave-requests?${buildServerQuery({ page: 1, limit: 1, status: 'REJECTED' })}`,
          ),
        ]);

      setRecords((listResponse.data || []).map(mapToRecord));
      setMeta({
        total: listResponse.meta?.total || 0,
        page: listResponse.meta?.page || currentPage,
        limit: listResponse.meta?.limit || pageSizeNum,
        totalPages: Math.max(1, listResponse.meta?.totalPages || 1),
      });
      setCounts({
        total: totalResponse.meta?.total || 0,
        approved: approvedResponse.meta?.total || 0,
        pending: pendingResponse.meta?.total || 0,
        rejected: rejectedResponse.meta?.total || 0,
      });

      if (
        listResponse.meta?.totalPages &&
        currentPage > listResponse.meta.totalPages &&
        listResponse.meta.totalPages > 0
      ) {
        setCurrentPage(listResponse.meta.totalPages);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được lịch sử nghỉ phép từ API.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [buildServerQuery, currentPage, pageSizeNum]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const approverOptions = useMemo(() => {
    return Array.from(
      new Set(
        records.map((record) => record.approver).filter((approver) => approver && approver !== '-'),
      ),
    );
  }, [records]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();

    const rows = records.filter((record) => {
      if (approverFilter && record.approver !== approverFilter) return false;

      if (dayRangeFilter === '1' && record.days !== 1) return false;
      if (dayRangeFilter === '2-3' && (record.days < 2 || record.days > 3)) return false;
      if (dayRangeFilter === '4-7' && (record.days < 4 || record.days > 7)) return false;
      if (dayRangeFilter === '8+' && record.days < 8) return false;

      if (
        normalizedSearch &&
        !record.id.toLowerCase().includes(normalizedSearch) &&
        !record.reason.toLowerCase().includes(normalizedSearch) &&
        !record.approver.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });

    return rows.sort((left, right) => {
      if (sortBy === 'status') return left.status.localeCompare(right.status);
      return sortBy === 'date_asc'
        ? left.submittedAtValue - right.submittedAtValue
        : right.submittedAtValue - left.submittedAtValue;
    });
  }, [approverFilter, dayRangeFilter, records, searchInput, sortBy]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.includes(row.id)),
    [filteredRows, selectedIds],
  );

  const handleView = async (id: string) => {
    setDetailLoadingId(id);

    try {
      const response = await apiClient.get<LeaveRequestItem>(`/api/leave-requests/${id}`);
      setSelectedDetail(toDetailData(response.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết yêu cầu nghỉ phép.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const handleEdit = async (id: string) => {
    setDetailLoadingId(id);

    try {
      const response = await apiClient.get<LeaveRequestItem>(`/api/leave-requests/${id}`);
      setEditingRequest(toEditData(response.data));
      setIsLeaveRequestModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu để chỉnh sửa.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const executeCancel = async (requestId: string) => {
    setActionLoadingId(requestId);

    try {
      await apiClient.patch(`/api/leave-requests/${requestId}/cancel`, {});
      setSelectedIds((previous) => previous.filter((id) => id !== requestId));
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể hủy yêu cầu nghỉ phép.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const exportCsv = (rows: LeaveRecord[]) => {
    const csvEscape = (value: string | number) => {
      const escaped = String(value ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const headers = [
      'ID',
      'Loai',
      'Tu ngay',
      'Den ngay',
      'So ngay',
      'Ly do',
      'Ban giao',
      'Trang thai',
      'Ngay gui',
      'Nguoi duyet',
      'Vai tro',
      'Ngay duyet',
    ];

    const lines = rows.map((row) =>
      [
        row.id,
        row.type.code,
        row.fromDate,
        row.toDate,
        row.days,
        row.reason,
        row.handover,
        STATUS_CONFIG[row.status].label,
        row.submittedAt,
        row.approver,
        row.approverRole,
        row.approvedAt,
      ]
        .map(csvEscape)
        .join(','),
    );

    const content = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leave-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  const toggleAll = () => {
    const pageIds = filteredRows.map((row) => row.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : pageIds);
  };

  const visiblePages = getVisiblePages(meta.page, meta.totalPages);
  const selectedAllOnPage =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: '#D3F2E7' }}
          >
            <History size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Lịch sử nghỉ phép
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsLeaveRequestModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: '#1DB87A' }}
          >
            <PlusCircle size={14} /> Đăng ký mới
          </button>
          <button
            onClick={() => exportCsv(filteredRows)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <FileDown size={14} /> Export Excel
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

      {!isEmployee && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Tổng yêu cầu',
            value: counts.total,
            icon: List,
            color: '#3b82f6',
            bg: '#eff6ff',
          },
          {
            label: 'Đã duyệt',
            value: counts.approved,
            icon: CheckCircle,
            color: '#1DB87A',
            bg: '#f0fdf9',
          },
          {
            label: 'Chờ duyệt',
            value: counts.pending,
            icon: Clock,
            color: '#f59e0b',
            bg: '#fffbeb',
          },
          {
            label: 'Từ chối',
            value: counts.rejected,
            icon: XCircle,
            color: '#ef4444',
            bg: '#fef2f2',
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
      </div>}

      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: '#e2ede9' }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2">
            <Filter size={15} style={{ color: '#1DB87A' }} />
            <span className="text-sm font-semibold" style={{ color: '#203430' }}>
              Bộ lọc nâng cao
            </span>
          </div>
          <button
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            {filtersOpen ? (
              <>
                <ChevronUp size={13} /> Thu gọn
              </>
            ) : (
              <>
                <ChevronDown size={13} /> Mở rộng
              </>
            )}
          </button>
        </div>
        {filtersOpen ? (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Trạng thái
                </label>
                <Select
                  value={statusFilter || 'all-status'}
                  onValueChange={(value) => setStatusFilter(value === 'all-status' ? '' : value)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-status">Tất cả</SelectItem>
                    <SelectItem value="pending">Chờ duyệt</SelectItem>
                    <SelectItem value="approved">Đã duyệt</SelectItem>
                    <SelectItem value="rejected">Từ chối</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Loại nghỉ
                </label>
                <Select
                  value={typeFilter || 'all-type'}
                  onValueChange={(value) => setTypeFilter(value === 'all-type' ? '' : value)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Loại nghỉ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-type">Tất cả</SelectItem>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.code}>
                        {`${type.code} - ${type.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Thời gian
                </label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Thời gian" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisWeek">Tuần này</SelectItem>
                    <SelectItem value="thisMonth">Tháng này</SelectItem>
                    <SelectItem value="lastMonth">Tháng trước</SelectItem>
                    <SelectItem value="thisYear">Năm nay</SelectItem>
                    <SelectItem value="custom">Tùy chọn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Từ ngày
                </label>
                <DatePicker
                  value={fromDate}
                  onChange={(value) => {
                    setPeriodFilter('custom');
                    setFromDate(value);
                  }}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Đến ngày
                </label>
                <DatePicker
                  value={toDate}
                  onChange={(value) => {
                    setPeriodFilter('custom');
                    setToDate(value);
                  }}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Số ngày
                </label>
                <Select value={dayRangeFilter} onValueChange={setDayRangeFilter}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Số ngày" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-days">Tất cả</SelectItem>
                    <SelectItem value="1">1 ngày</SelectItem>
                    <SelectItem value="2-3">2-3 ngày</SelectItem>
                    <SelectItem value="4-7">4-7 ngày</SelectItem>
                    <SelectItem value="8+">8+ ngày</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Tìm kiếm
                </label>
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Tìm theo ID, lý do, người duyệt..."
                  className="text-xs"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Người duyệt
                </label>
                <Select
                  value={approverFilter || 'all-approver'}
                  onValueChange={(value) =>
                    setApproverFilter(value === 'all-approver' ? '' : value)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Người duyệt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-approver">Tất cả</SelectItem>
                    {approverOptions.map((approver) => (
                      <SelectItem key={approver} value={approver}>
                        {approver}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Sắp xếp
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Sắp xếp" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Ngày gửi (mới nhất)</SelectItem>
                    <SelectItem value="date_asc">Ngày gửi (cũ nhất)</SelectItem>
                    <SelectItem value="status">Trạng thái</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                  Hiển thị
                </label>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="w-[100px] text-xs">
                    <SelectValue placeholder="Số dòng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 dòng</SelectItem>
                    <SelectItem value="25">25 dòng</SelectItem>
                    <SelectItem value="50">50 dòng</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs" style={{ color: '#6b7f78' }}>
                Filter chính đang gọi API thật, tìm kiếm và sắp xếp áp dụng trên dữ liệu đã tải.
              </span>
              <button
                onClick={() => {
                  const range = getPeriodRange('thisMonth');
                  setStatusFilter('');
                  setTypeFilter('');
                  setPeriodFilter('thisMonth');
                  setFromDate(range.from);
                  setToDate(range.to);
                  setDayRangeFilter('all-days');
                  setApproverFilter('');
                  setSearchInput('');
                  setSortBy('date_desc');
                  setCurrentPage(1);
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
              >
                <X size={13} /> Xóa lọc
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
          style={{ background: '#f0fdf9', borderColor: '#D3F2E7' }}
        >
          <span className="text-sm font-medium" style={{ color: '#0E474E' }}>
            Đã chọn {selectedIds.length} yêu cầu
          </span>
          <button
            onClick={() => exportCsv(selectedRows)}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: '#1DB87A' }}
          >
            Export đã chọn
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            Bỏ chọn
          </button>
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: '#e2ede9' }}
      >
        <div
          className="flex items-center gap-2 border-b px-5 py-3"
          style={{ borderColor: '#e2ede9' }}
        >
          <List size={15} style={{ color: '#1DB87A' }} />
          <h2 className="text-sm font-semibold" style={{ color: '#203430' }}>
            Danh sách yêu cầu nghỉ phép
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#203430' }}>
                <th className="px-3 py-3 text-left">
                  <Checkbox
                    checked={selectedAllOnPage}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả yêu cầu"
                  />
                </th>
                {[
                  'ID',
                  'Tên NV',
                  'Loại',
                  'Từ ngày',
                  'Đến ngày',
                  'Số ngày',
                  'Lý do',
                  'Người bàn giao',
                  'Trạng thái',
                  'Ngày gửi',
                  'Người duyệt',
                  'Ngày duyệt',
                  'Thao tác',
                ].map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-3 py-3 text-left font-semibold text-white"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Đang tải dữ liệu từ API...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Không có yêu cầu nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ background: ROW_BG[row.status] }}
                    className="border-b transition-all last:border-0 hover:brightness-95"
                    onClick={() => toggleSelect(row.id)}
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={() => toggleSelect(row.id)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Chọn yêu cầu ${row.id}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-bold" style={{ color: '#203430' }}>
                      #{row.id}
                    </td>
                    <td
                      className="max-w-[160px] truncate px-3 py-3 font-medium"
                      style={{ color: '#203430' }}
                    >
                      {row.userName}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{ background: row.type.color }}
                      >
                        {row.type.code}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3" style={{ color: '#203430' }}>
                      {row.fromDate}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3" style={{ color: '#203430' }}>
                      {row.toDate}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg font-bold text-white"
                        style={{
                          background:
                            row.days >= 30 ? '#f97316' : row.days >= 2 ? '#3b82f6' : '#1DB87A',
                        }}
                      >
                        {row.days}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-3" style={{ color: '#6b7f78' }}>
                      {row.reason}
                    </td>
                    <td className="px-3 py-3" style={{ color: '#6b7f78' }}>
                      {row.handover}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 font-medium ${STATUS_CONFIG[row.status].badge}`}
                      >
                        {STATUS_CONFIG[row.status].label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3" style={{ color: '#6b7f78' }}>
                      {row.submittedAt}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="font-medium" style={{ color: '#203430' }}>
                        {row.approver}
                      </div>
                      {row.approverRole ? (
                        <div style={{ color: '#6b7f78' }}>{row.approverRole}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3" style={{ color: '#6b7f78' }}>
                      {row.approvedAt}
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className="flex items-center gap-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          onClick={() => void handleView(row.id)}
                          disabled={detailLoadingId === row.id}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-blue-50 disabled:opacity-50"
                          title="Xem"
                        >
                          <Eye size={13} style={{ color: '#3b82f6' }} />
                        </button>
                        {row.status === 'pending' ? (
                          <button
                            onClick={() => void handleEdit(row.id)}
                            disabled={detailLoadingId === row.id || actionLoadingId === row.id}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-amber-50 disabled:opacity-50"
                            title="Chỉnh sửa"
                          >
                            <Pencil size={13} style={{ color: '#f59e0b' }} />
                          </button>
                        ) : null}
                        {row.status === 'pending' ? (
                          <button
                            onClick={() =>
                              openConfirm({
                                title: 'Xác nhận hủy yêu cầu',
                                message:
                                  'Bạn có chắc muốn hủy yêu cầu nghỉ phép này? Chỉ yêu cầu đang chờ duyệt mới có thể hủy.',
                                danger: true,
                                confirmLabel: 'Hủy yêu cầu',
                                onConfirm: () => executeCancel(row.id),
                              })
                            }
                            disabled={actionLoadingId === row.id}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50 disabled:opacity-50"
                            title="Hủy"
                          >
                            <X size={13} style={{ color: '#ef4444' }} />
                          </button>
                        ) : null}
                        {row.attachmentUrl ? (
                          <button
                            onClick={() =>
                              window.open(
                                `${getApiBaseUrl()}/uploads/${row.attachmentUrl}`,
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-emerald-50"
                            title="Tải file đính kèm"
                          >
                            <Download size={13} style={{ color: '#1DB87A' }} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          className="flex items-center justify-between border-t px-5 py-3"
          style={{ borderColor: '#e2ede9' }}
        >
          <p className="text-xs" style={{ color: '#6b7f78' }}>
            Hiển thị <strong>{filteredRows.length}</strong> kết quả trên trang {meta.page}/
            {meta.totalPages}, tổng server-side là <strong>{meta.total}</strong> yêu cầu
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={meta.page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#e2ede9' }}
            >
              <ChevronLeft size={14} style={{ color: '#6b7f78' }} />
            </button>
            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                  page === meta.page ? 'text-white' : 'hover:bg-gray-50'
                }`}
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#e2ede9' }}
            >
              <ChevronRight size={14} style={{ color: '#6b7f78' }} />
            </button>
          </div>
        </div>
      </div>

      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      <LeaveRequestModal
        isOpen={isLeaveRequestModalOpen}
        onClose={() => {
          setIsLeaveRequestModalOpen(false);
          setEditingRequest(null);
        }}
        onSubmitSuccess={() => {
          setCurrentPage(1);
          setEditingRequest(null);
          void loadRecords();
        }}
        editData={editingRequest}
      />

      {confirmDialog}
    </div>
  );
}
