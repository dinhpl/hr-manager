'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  RefreshCw,
  Search,
  Table2,
  Upload,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { buildQuery, getFullName } from '@/lib/hr-utils';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

type AttendanceDay = {
  date: string;
  day: number;
  weekday: number;
  isWeekend: boolean;
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: AttendanceStatus;
  workHours: number;
  checkIn: string | null;
  checkOut: string | null;
  note: string | null;
};

type AttendanceEmployee = {
  id: string;
  username?: string | null;
  employeeCode?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  position?: string | null;
  avatar?: string | null;
  recordsByDate: Record<string, AttendanceRecord>;
};

type MonthlyAttendanceResponse = {
  month: number;
  year: number;
  days: AttendanceDay[];
  employees: AttendanceEmployee[];
};

type ImportSummary = {
  totalRows: number;
  importedRows: number;
  created: number;
  updated: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
};

const STATUS_FILTERS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'present', label: 'Active' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0h';
  if (Number.isInteger(value)) return `${value} Hours`;

  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours} Hours`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function getAvatarUrl(avatar?: string | null) {
  if (!avatar) return null;
  if (avatar.startsWith('http') || avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return `${getApiBaseUrl()}${avatar}`;
  return null;
}

function getStatusStyle(status: AttendanceStatus) {
  switch (status) {
    case 'late':
      return {
        color: '#b45309',
        background: '#fff7ed',
        border: '#fed7aa',
        label: 'Late',
      };
    case 'absent':
      return {
        color: '#b42318',
        background: '#fff1f3',
        border: '#fecdd3',
        label: 'Absent',
      };
    case 'leave':
      return {
        color: '#6d28d9',
        background: '#f5f3ff',
        border: '#ddd6fe',
        label: 'Leave',
      };
    default:
      return {
        color: '#166534',
        background: '#ecfdf3',
        border: '#bbf7d0',
        label: 'Active',
      };
  }
}

function renderBadgeLabel(record: AttendanceRecord) {
  if (record.status === 'present' || record.status === 'late') {
    return record.workHours > 0
      ? formatHours(record.workHours)
      : getStatusStyle(record.status).label;
  }

  return getStatusStyle(record.status).label;
}

export default function AttendancePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [monthInput, setMonthInput] = useState(getMonthInputValue(new Date()));
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<AttendanceStatus[]>([]);
  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<{
    employee: AttendanceEmployee;
    record: AttendanceRecord;
  } | null>(null);

  const monthParts = useMemo(() => {
    const [year, month] = monthInput.split('-').map(Number);
    return { year, month };
  }, [monthInput]);

  const fetchAttendances = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setErrorMessage(null);

      try {
        const query = buildQuery({
          year: monthParts.year,
          month: monthParts.month,
          search: searchQuery || undefined,
          statuses: selectedStatuses.length ? selectedStatuses.join(',') : undefined,
          page: 1,
          limit: 100,
        });
        const url = query ? `/api/attendances/monthly?${query}` : '/api/attendances/monthly';
        const response = await apiClient.get<MonthlyAttendanceResponse>(url);
        setData(response.data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể tải dữ liệu chấm công theo tháng.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [monthParts.month, monthParts.year, searchQuery, selectedStatuses],
  );

  useEffect(() => {
    void fetchAttendances(true);
  }, [fetchAttendances]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const toggleStatus = (status: AttendanceStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    );
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsImporting(true);
    setImportSummary(null);

    try {
      const response = await apiClient.post<ImportSummary>('/api/attendances/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportSummary(response.data);
      toast.success(
        `Đã import ${response.data.importedRows} dòng chấm công. Tạo mới ${response.data.created}, cập nhật ${response.data.updated}.`,
      );
      await fetchAttendances();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể import file Excel.');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const stats = useMemo(() => {
    const employees = data?.employees ?? [];
    const totalEmployees = employees.length;
    let activeDays = 0;
    let lateDays = 0;
    let absentDays = 0;

    employees.forEach((employee) => {
      Object.values(employee.recordsByDate).forEach((record) => {
        if (record.status === 'present') activeDays += 1;
        if (record.status === 'late') lateDays += 1;
        if (record.status === 'absent') absentDays += 1;
      });
    });

    return { totalEmployees, activeDays, lateDays, absentDays };
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: '#D3F2E7' }}
          >
            <Table2 size={18} style={{ color: '#0E474E' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
              Attendance Monthly View
            </h1>
            <p className="text-xs" style={{ color: '#6b7f78' }}>
              Theo dõi chấm công toàn bộ nhân viên theo tháng và import dữ liệu Excel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            hidden
            onChange={handleImportFile}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchAttendances()}
            disabled={isRefreshing || isLoading || isImporting}
            className="gap-2"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Làm mới
          </Button>
          <Button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="gap-2 text-white"
            style={{ background: '#1DB87A' }}
          >
            <Upload size={14} />
            {isImporting ? 'Đang import...' : 'Import Excel'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Nhân viên hiển thị',
            value: stats.totalEmployees,
            icon: Users,
            color: '#3b82f6',
            bg: '#eff6ff',
          },
          {
            label: 'Ngày active',
            value: stats.activeDays,
            icon: CalendarDays,
            color: '#1DB87A',
            bg: '#ecfdf3',
          },
          {
            label: 'Ngày late',
            value: stats.lateDays,
            icon: Clock3,
            color: '#f59e0b',
            bg: '#fffbeb',
          },
          {
            label: 'Ngày absent',
            value: stats.absentDays,
            icon: AlertCircle,
            color: '#ef4444',
            bg: '#fef2f2',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-4 rounded-xl border bg-white p-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: item.bg }}
            >
              <item.icon size={22} style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#203430' }}>
                {item.value}
              </p>
              <p className="text-xs" style={{ color: '#6b7f78' }}>
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[180px] flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Tháng
            </label>
            <Input
              type="month"
              value={monthInput}
              onChange={(event) => setMonthInput(event.target.value)}
            />
          </div>

          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Tìm kiếm
            </label>
            <div className="flex gap-2">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
                placeholder="Tìm theo tên, username, mã nhân viên..."
              />
              <Button
                type="button"
                onClick={handleSearch}
                className="px-3 text-white"
                style={{ background: '#1DB87A' }}
              >
                <Search size={14} />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => {
            const active = selectedStatuses.includes(status.value);
            return (
              <button
                key={status.value}
                type="button"
                onClick={() => toggleStatus(status.value)}
                className="rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
                style={{
                  borderColor: active ? '#1DB87A' : '#e2ede9',
                  background: active ? '#ecfdf3' : '#fff',
                  color: active ? '#166534' : '#203430',
                }}
              >
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      {importSummary ? (
        <div
          className="rounded-xl border px-4 py-3"
          style={{
            borderColor: importSummary.failedRows ? '#fed7aa' : '#bbf7d0',
            background: importSummary.failedRows ? '#fff7ed' : '#ecfdf3',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#203430' }}>
            Kết quả import: {importSummary.importedRows}/{importSummary.totalRows} dòng hợp lệ, tạo
            mới {importSummary.created}, cập nhật {importSummary.updated}, lỗi{' '}
            {importSummary.failedRows}.
          </p>
          {importSummary.errors.length ? (
            <div className="mt-2 space-y-1 text-xs" style={{ color: '#9a3412' }}>
              {importSummary.errors.slice(0, 8).map((error) => (
                <p key={`${error.row}-${error.message}`}>
                  Dòng {error.row}: {error.message}
                </p>
              ))}
              {importSummary.errors.length > 8 ? (
                <p>... và {importSummary.errors.length - 8} lỗi khác.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm font-medium"
          style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: '#e2ede9' }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2">
            <CalendarDays size={15} style={{ color: '#1DB87A' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Bảng chấm công tháng {monthParts.month}/{monthParts.year}
            </h2>
          </div>
          <span className="text-xs" style={{ color: '#6b7f78' }}>
            {data?.employees.length ?? 0} nhân viên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 min-w-[260px] border-r px-4 py-3 text-left font-semibold"
                  style={{ background: '#f8faf9', borderColor: '#e2ede9', color: '#203430' }}
                >
                  Employee
                </th>
                {data?.days.map((day) => (
                  <th
                    key={day.date}
                    className="min-w-[110px] border-r px-3 py-3 text-left font-semibold"
                    style={{ background: '#f8faf9', borderColor: '#e2ede9', color: '#203430' }}
                  >
                    <div className="space-y-0.5">
                      <p>{WEEKDAY_LABELS[day.weekday]}</p>
                      <p className="text-sm font-bold">{day.day}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={(data?.days.length ?? 0) + 1}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Đang tải dữ liệu chấm công...
                  </td>
                </tr>
              ) : !data?.employees.length ? (
                <tr>
                  <td
                    colSpan={(data?.days.length ?? 0) + 1}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Không có dữ liệu chấm công phù hợp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                data.employees.map((employee) => {
                  const displayName = getFullName(employee);
                  const avatarUrl = getAvatarUrl(employee.avatar);

                  return (
                    <tr key={employee.id}>
                      <td
                        className="sticky left-0 z-10 border-r border-t px-4 py-3 align-top"
                        style={{ background: '#fff', borderColor: '#e2ede9' }}
                      >
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                              }}
                            >
                              {displayName
                                .split(' ')
                                .slice(0, 2)
                                .map((item) => item.charAt(0))
                                .join('')
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate text-base font-semibold"
                              style={{ color: '#203430' }}
                            >
                              {displayName}
                            </p>
                            <p className="truncate text-sm" style={{ color: '#6b7f78' }}>
                              {employee.position ||
                                employee.department ||
                                employee.employeeCode ||
                                employee.username ||
                                '-'}
                            </p>
                            {employee.employeeCode ? (
                              <p className="text-[11px] font-semibold" style={{ color: '#1DB87A' }}>
                                #{employee.employeeCode}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {data.days.map((day) => {
                        const record = employee.recordsByDate[day.date];
                        const statusStyle = record ? getStatusStyle(record.status) : null;

                        return (
                          <td
                            key={`${employee.id}-${day.date}`}
                            className="border-r border-t px-3 py-3 align-top"
                            style={{
                              borderColor: '#e2ede9',
                              background:
                                !record && day.isWeekend
                                  ? 'repeating-linear-gradient(135deg, #fbfbfb 0px, #fbfbfb 8px, #f4f4f5 8px, #f4f4f5 10px)'
                                  : '#fff',
                            }}
                          >
                            <div className="space-y-2">
                              <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                                {day.day}
                              </p>
                              {record ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord({ employee, record })}
                                  className="w-full rounded-xl border px-2 py-2 text-left transition-transform hover:-translate-y-0.5"
                                  style={{
                                    borderColor: statusStyle?.border,
                                    background: statusStyle?.background,
                                    color: statusStyle?.color,
                                  }}
                                >
                                  <p className="text-xs font-bold">{renderBadgeLabel(record)}</p>
                                  {record.checkIn || record.checkOut ? (
                                    <p className="mt-1 text-[11px] opacity-80">
                                      {formatTime(record.checkIn)} - {formatTime(record.checkOut)}
                                    </p>
                                  ) : null}
                                </button>
                              ) : (
                                <div
                                  className="rounded-xl border px-2 py-2 text-[11px]"
                                  style={{ borderColor: '#edf1ef', color: '#9ca3af' }}
                                >
                                  No data
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết attendance</DialogTitle>
            <DialogDescription>
              {selectedRecord
                ? `${getFullName(selectedRecord.employee)} - ${formatDisplayDate(selectedRecord.record.date)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord ? (
            <div className="space-y-3 text-sm">
              {[
                [
                  'Mã nhân viên',
                  selectedRecord.employee.employeeCode || selectedRecord.employee.username || '-',
                ],
                ['Trạng thái', getStatusStyle(selectedRecord.record.status).label],
                ['Tổng giờ', formatHours(selectedRecord.record.workHours)],
                ['Giờ vào', formatTime(selectedRecord.record.checkIn)],
                ['Giờ ra', formatTime(selectedRecord.record.checkOut)],
                ['Ghi chú', selectedRecord.record.note || '-'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2"
                  style={{ borderColor: '#e2ede9' }}
                >
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#6b7f78' }}
                  >
                    {label}
                  </span>
                  <span className="text-right font-medium" style={{ color: '#203430' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
