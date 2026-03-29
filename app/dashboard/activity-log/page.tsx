'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { getStoredUser } from '@/lib/api-client';
import { toFrontendRole } from '@/lib/hr-utils';
import { type AuditLogFilters, type AuditLogItem, fetchAuditLogs } from '@/lib/audit-logs-api';
import { useRouter } from 'next/navigation';

const MODULE_LABELS: Record<string, string> = {
  LEAVE_REQUEST: 'Nghỉ phép',
  USER: 'Người dùng',
  OVERTIME: 'Tăng ca',
  COMP_OFF: 'Nghỉ bù',
  LEAVE_TYPE: 'Loại nghỉ phép',
  LEAVE_BALANCE: 'Số dư nghỉ phép',
  AUTH: 'Đăng nhập',
  SETTING: 'Cài đặt',
  SKILL: 'Kỹ năng',
  USER_SKILL: 'Kỹ năng NV',
  DEPARTMENT: 'Phòng ban',
  ATTENDANCE: 'Chấm công',
  HOLIDAY: 'Ngày lễ',
  DEVICE: 'Thiết bị',
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  APPROVE: 'Duyệt',
  REJECT: 'Từ chối',
  CANCEL: 'Hủy',
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  EXPORT: 'Xuất dữ liệu',
  UPLOAD: 'Tải lên',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const DURATION_LABELS: Record<string, string> = {
  FULL_DAY: 'Cả ngày',
  HALF_DAY_AM: 'Nửa ngày sáng',
  HALF_DAY_PM: 'Nửa ngày chiều',
};

const FIELD_LABELS: Record<string, string> = {
  userName: 'Người đăng ký',
  leaveType: 'Loại nghỉ',
  fromDate: 'Từ thời gian',
  toDate: 'Đến thời gian',
  durationMode: 'Hình thức nghỉ',
  totalDays: 'Số ngày nghỉ',
  reason: 'Lý do',
  handoverPerson: 'Người bàn giao',
  approver: 'Người duyệt',
  status: 'Trạng thái',
  approvedNote: 'Ghi chú duyệt',
  annualDays: 'Phép năm',
  carryOverDays: 'Phép chuyển năm',
  seniorityDays: 'Phép thâm niên',
  compOffDays: 'Nghỉ bù',
  wfhDays: 'WFH',
  usedCarryOverDays: 'Đã dùng phép chuyển năm',
  usedDays: 'Đã dùng phép năm',
  usedCompOffDays: 'Đã dùng nghỉ bù',
};

const CHANGE_FIELD_ORDER = [
  'status',
  'leaveType',
  'fromDate',
  'toDate',
  'durationMode',
  'totalDays',
  'reason',
  'approvedNote',
  'userName',
  'approver',
  'handoverPerson',
  'annualDays',
  'carryOverDays',
  'seniorityDays',
  'compOffDays',
  'wfhDays',
  'usedCarryOverDays',
  'usedDays',
  'usedCompOffDays',
] as const;

const MODULE_OPTIONS = Object.entries(MODULE_LABELS);
const ACTION_OPTIONS = Object.entries(ACTION_LABELS);

function normalizeDateTimeLikeValue(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    return formatDateTime(normalized.replace(' ', 'T'));
  }

  return null;
}

function formatNumberValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatChangeValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status' && typeof value === 'string') return STATUS_LABELS[value] ?? value;
  if (field === 'durationMode' && typeof value === 'string') return DURATION_LABELS[value] ?? value;
  if (typeof value === 'number') return formatNumberValue(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string') {
    const formattedDateTime = normalizeDateTimeLikeValue(value);
    if (formattedDateTime) return formattedDateTime;

    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== '') return formatNumberValue(asNumber);
    return value;
  }

  return JSON.stringify(value);
}

function getSortedChangeFields(log: AuditLogItem): string[] {
  const fields = Object.keys(log.changes ?? {});
  return fields.sort((left, right) => {
    const leftIndex = CHANGE_FIELD_ORDER.indexOf(left as (typeof CHANGE_FIELD_ORDER)[number]);
    const rightIndex = CHANGE_FIELD_ORDER.indexOf(right as (typeof CHANGE_FIELD_ORDER)[number]);
    const safeLeft = leftIndex === -1 ? CHANGE_FIELD_ORDER.length : leftIndex;
    const safeRight = rightIndex === -1 ? CHANGE_FIELD_ORDER.length : rightIndex;
    return safeLeft - safeRight || left.localeCompare(right);
  });
}

function getPrimaryChangeSummary(log: AuditLogItem): string | null {
  const changes = log.changes ?? {};

  if (log.module === 'LEAVE_REQUEST') {
    const leaveType = formatChangeValue('leaveType', changes.leaveType?.to);
    const fromDate = formatChangeValue('fromDate', changes.fromDate?.to);
    const toDate = formatChangeValue('toDate', changes.toDate?.to);
    const totalDays = formatChangeValue('totalDays', changes.totalDays?.to);
    const status = formatChangeValue('status', changes.status?.to);

    if (log.action === 'CREATE') {
      return `Tạo đơn ${leaveType}${fromDate !== '—' && toDate !== '—' ? `, ${fromDate} → ${toDate}` : ''}${totalDays !== '—' ? `, ${totalDays} ngày` : ''}.`;
    }

    if (log.action === 'APPROVE' || log.action === 'REJECT' || log.action === 'CANCEL') {
      return `Cập nhật trạng thái thành ${status}.`;
    }

    const pieces = [];
    if (changes.leaveType)
      pieces.push(
        `loại nghỉ: ${formatChangeValue('leaveType', changes.leaveType.from)} -> ${formatChangeValue('leaveType', changes.leaveType.to)}`,
      );
    if (changes.fromDate || changes.toDate) {
      const fromRange = `${formatChangeValue('fromDate', changes.fromDate?.from)} → ${formatChangeValue('toDate', changes.toDate?.from)}`;
      const toRange = `${formatChangeValue('fromDate', changes.fromDate?.to)} → ${formatChangeValue('toDate', changes.toDate?.to)}`;
      pieces.push(`thời gian: ${fromRange} -> ${toRange}`);
    }
    if (changes.totalDays)
      pieces.push(
        `số ngày: ${formatChangeValue('totalDays', changes.totalDays.from)} -> ${formatChangeValue('totalDays', changes.totalDays.to)}`,
      );
    if (changes.durationMode)
      pieces.push(
        `hình thức: ${formatChangeValue('durationMode', changes.durationMode.from)} -> ${formatChangeValue('durationMode', changes.durationMode.to)}`,
      );

    return pieces[0] ?? 'Đã cập nhật thông tin đơn nghỉ.';
  }

  if (log.module === 'LEAVE_BALANCE') {
    const fields = getSortedChangeFields(log)
      .slice(0, 2)
      .map((field) => {
        const change = changes[field];
        return `${FIELD_LABELS[field] ?? field}: ${formatChangeValue(field, change?.from)} -> ${formatChangeValue(field, change?.to)}`;
      });

    if (fields.length > 0) {
      return `Điều chỉnh ${fields.join(' · ')}.`;
    }

    return 'Đã điều chỉnh số dư nghỉ phép.';
  }

  const firstField = getSortedChangeFields(log)[0];
  if (!firstField) return null;

  const change = changes[firstField];
  return `${FIELD_LABELS[firstField] ?? firstField}: ${formatChangeValue(firstField, change?.from)} -> ${formatChangeValue(firstField, change?.to)}.`;
}

function getSecondaryChangeSummary(log: AuditLogItem): string | null {
  const changes = log.changes ?? {};

  if (log.module === 'LEAVE_REQUEST') {
    if (changes.reason) {
      return `Lý do: ${formatChangeValue('reason', changes.reason.to)}`;
    }

    if (changes.approvedNote) {
      return `Ghi chú: ${formatChangeValue('approvedNote', changes.approvedNote.to)}`;
    }

    if (changes.userName) {
      return `Người đăng ký: ${formatChangeValue('userName', changes.userName.to)}`;
    }
  }

  if (log.module === 'LEAVE_BALANCE') {
    const extraFields = getSortedChangeFields(log).slice(2, 4);
    if (extraFields.length > 0) {
      return extraFields
        .map((field) => {
          const change = changes[field];
          return `${FIELD_LABELS[field] ?? field}: ${formatChangeValue(field, change?.from)} -> ${formatChangeValue(field, change?.to)}`;
        })
        .join(' · ');
    }
  }

  return null;
}

function getActionBadgeClass(action: string): string {
  switch (action) {
    case 'CREATE':
      return 'bg-green-100 text-green-800';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    case 'APPROVE':
      return 'bg-emerald-100 text-emerald-800';
    case 'REJECT':
      return 'bg-red-100 text-red-800';
    case 'CANCEL':
      return 'bg-orange-100 text-orange-800';
    case 'LOGIN':
      return 'bg-gray-100 text-gray-700';
    case 'LOGOUT':
      return 'bg-gray-100 text-gray-700';
    case 'EXPORT':
      return 'bg-purple-100 text-purple-800';
    case 'UPLOAD':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'bg-red-100 text-red-700';
    case 'HR':
      return 'bg-purple-100 text-purple-700';
    case 'MANAGER':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const safeStart = Math.max(1, end - 4);
  return Array.from({ length: end - safeStart + 1 }, (_, index) => safeStart + index);
}

interface ChangesModalProps {
  log: AuditLogItem;
  onClose: () => void;
}

function ChangesModal({ log, onClose }: ChangesModalProps) {
  const changes = log.changes ?? {};
  const fields = getSortedChangeFields(log);
  const summary = getPrimaryChangeSummary(log);
  const secondarySummary = getSecondaryChangeSummary(log);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #e2ede9' }}
        >
          <div>
            <h2 className="text-base font-semibold text-[#203430]">Chi tiết thay đổi</h2>
            {log.entityName && <p className="text-xs text-[#6b7f78] mt-0.5">{log.entityName}</p>}
            {summary && <p className="text-xs text-[#203430] mt-1">{summary}</p>}
            {secondarySummary && (
              <p className="text-xs text-[#6b7f78] mt-0.5">{secondarySummary}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] hover:text-[#203430] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {fields.length === 0 ? (
            <p className="text-sm text-[#6b7f78] text-center py-8">Không có chi tiết thay đổi</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #e2ede9', background: '#f7f7f7' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide">
                    Trường
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide">
                    Giá trị cũ
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide">
                    Giá trị mới
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const change = changes[field];
                  const fromVal =
                    change.from === null || change.from === undefined ? '—' : String(change.from);
                  const toVal =
                    change.to === null || change.to === undefined ? '—' : String(change.to);
                  return (
                    <tr
                      key={field}
                      style={{
                        borderBottom: index < fields.length - 1 ? '1px solid #f0f0f0' : 'none',
                      }}
                    >
                      <td className="px-4 py-2.5 font-medium text-[#203430]">
                        {FIELD_LABELS[field] ?? field}
                      </td>
                      <td className="px-4 py-2.5 text-red-600">
                        {formatChangeValue(field, fromVal)}
                      </td>
                      <td className="px-4 py-2.5 text-green-600">
                        {formatChangeValue(field, toVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3" style={{ borderTop: '1px solid #e2ede9' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 20 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local filter inputs (applied on load)
  const [searchInput, setSearchInput] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actorIdInput, setActorIdInput] = useState('');

  const storedUser = getStoredUser<{ role?: string }>();
  const currentRole = toFrontendRole(storedUser?.role);
  const isHrOrAdmin = currentRole === 'hr' || currentRole === 'admin';

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAuditLogs(filters);
      setLogs(response.data ?? []);
      setMeta({
        total: response.meta?.total ?? 0,
        page: response.meta?.page ?? filters.page ?? 1,
        limit: response.meta?.limit ?? filters.limit ?? 20,
        totalPages: response.meta?.totalPages ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được nhật ký hoạt động.');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function applyFilters() {
    setFilters({
      page: 1,
      limit: 20,
      search: searchInput.trim() || undefined,
      module: moduleFilter || undefined,
      action: actionFilter || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      actorId: isHrOrAdmin && actorIdInput.trim() ? actorIdInput.trim() : undefined,
    });
  }

  function resetFilters() {
    setSearchInput('');
    setModuleFilter('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setActorIdInput('');
    setFilters({ page: 1, limit: 20 });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  const visiblePages = getVisiblePages(meta.page, meta.totalPages);

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-[#203430]">Nhật ký hoạt động</h1>
        <p className="text-sm text-[#6b7f78] mt-0.5">Lịch sử các thay đổi dữ liệu trong hệ thống</p>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e2ede9' }}>
        <button
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-[#203430] hover:bg-[#f7f7f7] transition-colors"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Filter size={15} className="text-[#6b7f78]" />
            Bộ lọc tìm kiếm
          </span>
          <span className="text-xs text-[#6b7f78]">{filtersOpen ? 'Ẩn' : 'Hiện'}</span>
        </button>

        {filtersOpen && (
          <div style={{ borderTop: '1px solid #e2ede9' }}>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#6b7f78]">Tìm kiếm</label>
                <input
                  type="text"
                  className="h-9 px-3 rounded-lg border text-sm text-[#203430] placeholder:text-[#a0b0aa] focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                  style={{ border: '1px solid #d0e0db' }}
                  placeholder="Tìm theo tên người dùng, đối tượng..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                />
              </div>

              {/* Module */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#6b7f78]">Module</label>
                <select
                  className="h-9 px-3 rounded-lg border text-sm text-[#203430] bg-white focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                  style={{ border: '1px solid #d0e0db' }}
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                >
                  <option value="">Tất cả module</option>
                  {MODULE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#6b7f78]">Hành động</label>
                <select
                  className="h-9 px-3 rounded-lg border text-sm text-[#203430] bg-white focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                  style={{ border: '1px solid #d0e0db' }}
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="">Tất cả hành động</option>
                  {ACTION_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#6b7f78]">Từ ngày</label>
                <input
                  type="date"
                  className="h-9 px-3 rounded-lg border text-sm text-[#203430] bg-white focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                  style={{ border: '1px solid #d0e0db' }}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#6b7f78]">Đến ngày</label>
                <input
                  type="date"
                  className="h-9 px-3 rounded-lg border text-sm text-[#203430] bg-white focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                  style={{ border: '1px solid #d0e0db' }}
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {/* Actor ID — HR/Admin only */}
              {isHrOrAdmin && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[#6b7f78]">ID người dùng</label>
                  <input
                    type="text"
                    className="h-9 px-3 rounded-lg border text-sm text-[#203430] placeholder:text-[#a0b0aa] focus:outline-none focus:ring-2 focus:ring-[#1DB87A]/30"
                    style={{ border: '1px solid #d0e0db' }}
                    placeholder="Nhập ID người dùng..."
                    value={actorIdInput}
                    onChange={(e) => setActorIdInput(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: '1px solid #f0f0f0' }}
            >
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm font-medium rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] transition-colors"
              >
                Đặt lại
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                Tìm kiếm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e2ede9' }}>
        {/* Table header bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid #e2ede9' }}
        >
          <span className="text-sm font-semibold text-[#203430]">
            {isLoading ? 'Đang tải...' : `Tổng ${meta.total} bản ghi`}
          </span>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex flex-col gap-3 px-5 py-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6b7f78]">
            <p className="text-sm">Chưa có nhật ký hoạt động nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f7f7f7', borderBottom: '1px solid #e2ede9' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Thời gian
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Người thực hiện
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Hành động
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Module
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Đối tượng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#6b7f78] uppercase tracking-wide whitespace-nowrap">
                    Chi tiết thay đổi
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: index < logs.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                    className="hover:bg-[#f7faf9] transition-colors"
                  >
                    {/* Thời gian */}
                    <td className="px-4 py-3 whitespace-nowrap text-[#203430]">
                      {formatDateTime(log.createdAt)}
                    </td>

                    {/* Người thực hiện */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[#203430]">{log.actorName}</span>
                        <span
                          className={`inline-flex w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold ${getRoleBadgeClass(log.actorRole)}`}
                        >
                          {log.actorRole}
                        </span>
                      </div>
                    </td>

                    {/* Hành động */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeClass(log.action)}`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {MODULE_LABELS[log.module] ?? log.module}
                      </span>
                    </td>

                    {/* Đối tượng */}
                    <td className="px-4 py-3 text-[#203430]">
                      {log.entityName ?? <span className="text-[#a0b0aa]">—</span>}
                    </td>

                    {/* Chi tiết thay đổi */}
                    <td className="px-4 py-3 min-w-[320px]">
                      {log.changes !== null ? (
                        <div className="flex flex-col items-start gap-2">
                          <div className="text-sm text-[#203430] leading-5">
                            {getPrimaryChangeSummary(log) ?? 'Có thay đổi dữ liệu.'}
                          </div>
                          {getSecondaryChangeSummary(log) && (
                            <div className="text-xs text-[#6b7f78] leading-5">
                              {getSecondaryChangeSummary(log)}
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg text-[#1DB87A] border transition-colors hover:bg-[#f0f9f5]"
                            style={{ border: '1px solid #1DB87A' }}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#a0b0aa]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && meta.totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ borderTop: '1px solid #e2ede9' }}
          >
            <span className="text-xs text-[#6b7f78]">
              Trang {meta.page} / {meta.totalPages} &nbsp;·&nbsp; {meta.total} bản ghi
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(meta.page - 1)}
                disabled={meta.page <= 1}
                className="p-1.5 rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              {visiblePages[0] > 1 && (
                <>
                  <button
                    onClick={() => goToPage(1)}
                    className="min-w-[28px] h-7 px-1.5 text-xs rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] transition-colors"
                  >
                    1
                  </button>
                  {visiblePages[0] > 2 && <span className="text-xs text-[#a0b0aa] px-1">…</span>}
                </>
              )}

              {visiblePages.map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`min-w-[28px] h-7 px-1.5 text-xs font-medium rounded-lg transition-colors ${
                    page === meta.page ? 'text-white' : 'text-[#6b7f78] hover:bg-[#f0f9f5]'
                  }`}
                  style={
                    page === meta.page
                      ? { background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }
                      : {}
                  }
                >
                  {page}
                </button>
              ))}

              {visiblePages[visiblePages.length - 1] < meta.totalPages && (
                <>
                  {visiblePages[visiblePages.length - 1] < meta.totalPages - 1 && (
                    <span className="text-xs text-[#a0b0aa] px-1">…</span>
                  )}
                  <button
                    onClick={() => goToPage(meta.totalPages)}
                    className="min-w-[28px] h-7 px-1.5 text-xs rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] transition-colors"
                  >
                    {meta.totalPages}
                  </button>
                </>
              )}

              <button
                onClick={() => goToPage(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="p-1.5 rounded-lg text-[#6b7f78] hover:bg-[#f0f9f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Changes Detail Modal */}
      {selectedLog && <ChangesModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
