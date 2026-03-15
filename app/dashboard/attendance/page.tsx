'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  RefreshCw,
  Search,
  Settings2,
  Star,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, getApiBaseUrl, getStoredUser } from '@/lib/api-client';
import { buildQuery, getFullName } from '@/lib/hr-utils';
import { cn } from '@/lib/utils';

type RawAttendanceStatus = 'present' | 'late' | 'absent' | 'leave';
type AttendanceDisplayStatus = RawAttendanceStatus | 'insufficient';
type AttendanceFulfillmentCase = 'case_1' | 'case_2' | 'case_3';
type AttendanceHoursDisplayCase = 'case_1' | 'case_2';

type AttendanceDay = {
  date: string;
  day: number;
  weekday: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayNames: string[];
};

type AttendanceRecord = {
  id: string;
  date: string;
  status: RawAttendanceStatus;
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
  isCountable?: boolean;
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

type AttendanceSettings = {
  fulfillmentCase: AttendanceFulfillmentCase;
  hoursDisplayCase: AttendanceHoursDisplayCase;
  showRanking?: boolean;
};

type ViewerUser = {
  id?: string;
  role?: string;
  systemRole?: string | null;
};

type AttendanceEditorState = {
  status: RawAttendanceStatus;
  checkIn: string;
  checkOut: string;
  note: string;
};

type AttendanceComputedView = {
  status: AttendanceDisplayStatus;
  label: string;
  displayHours: number;
  actualHours: number;
};

const ATTENDANCE_SETTINGS_STORAGE_KEY = 'attendanceSettings.v1';
const LUNCH_BREAK_MINUTES = 75;
const LUNCH_START_MINUTES = 11 * 60 + 45; // 11:45
const LUNCH_END_MINUTES = 13 * 60; // 13:00
const FULL_WORKDAY_MINUTES = 8 * 60;
const FIXED_START_MINUTES = 8 * 60;
const CASE_1_END_MINUTES = 17 * 60 + 15;
const CASE_2_START_MINUTES = 8 * 60 + 15; // 8:15
const CASE_2_END_MINUTES = 17 * 60 + 30;

const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  fulfillmentCase: 'case_1',
  hoursDisplayCase: 'case_1',
  showRanking: true,
};

const STATUS_FILTERS: Array<{ value: AttendanceDisplayStatus; label: string }> = [
  { value: 'present', label: 'Active' },
  { value: 'insufficient', label: 'Thiếu' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
];

const WEEKDAY_LABELS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'T7'];

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return getMonthInputValue(now);
}

function formatMonthDisplay(monthInput: string) {
  const [year, month] = monthInput.split('-');
  return `Tháng ${parseInt(month)}/${year}`;
}

function getAvailableMonths() {
  const months: Array<{ value: string; label: string }> = [];
  const now = new Date();

  // Tạo danh sách 24 tháng (12 tháng trước + tháng hiện tại + 11 tháng sau)
  for (let i = -12; i <= 11; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = getMonthInputValue(date);
    const label = formatMonthDisplay(value);
    months.push({ value, label });
  }

  return months;
}

function getDefaultAvailableMonths() {
  return getAvailableMonths();
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

function formatTimeInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatHours(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0h';
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!minutes) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

function getDayHeaderStyles(day: AttendanceDay) {
  if (day.isHoliday) {
    return {
      background: '#fff7ed',
      color: '#c2410c',
      widthClass: 'min-w-[140px]',
    };
  }

  if (day.isWeekend) {
    return {
      background: '#fafafa',
      color: '#9ca3af',
      widthClass: 'min-w-[40px]',
    };
  }

  return {
    background: '#f8faf9',
    color: '#203430',
    widthClass: 'min-w-[110px]',
  };
}

function getAttendanceCellBackground(day: AttendanceDay) {
  if (day.isHoliday) return '#fffaf5';
  if (day.isWeekend) return '#fafafa';
  return '#fff';
}

function getAvatarUrl(avatar?: string | null) {
  if (!avatar) return null;
  if (avatar.startsWith('http') || avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return `${getApiBaseUrl()}${avatar}`;
  return null;
}

function parseTimeToMinutes(value?: string | null) {
  if (!value) return null;

  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function computeWorkedMinutes(checkIn?: string | null, checkOut?: string | null) {
  const checkInMinutes = parseTimeToMinutes(checkIn);
  const checkOutMinutes = parseTimeToMinutes(checkOut);

  if (checkInMinutes === null || checkOutMinutes === null || checkOutMinutes < checkInMinutes) {
    return null;
  }

  const totalMinutes = checkOutMinutes - checkInMinutes;

  // Kiểm tra xem có bao trọn khung giờ nghỉ trưa không
  // Chỉ trừ giờ nghỉ trưa nếu checkIn <= 11:45 và checkOut >= 13:00
  const coversLunchBreak =
    checkInMinutes <= LUNCH_START_MINUTES && checkOutMinutes >= LUNCH_END_MINUTES;

  if (coversLunchBreak) {
    return Math.max(0, totalMinutes - LUNCH_BREAK_MINUTES);
  }

  return Math.max(0, totalMinutes);
}

function normalizeHours(minutes: number | null, mode: AttendanceHoursDisplayCase) {
  if (minutes === null) return 0;
  const normalizedMinutes = mode === 'case_1' ? Math.min(minutes, FULL_WORKDAY_MINUTES) : minutes;
  return normalizedMinutes / 60;
}

function getExpectedEndMinutes(mode: AttendanceFulfillmentCase) {
  if (mode === 'case_2') return CASE_2_END_MINUTES;
  return CASE_1_END_MINUTES;
}

function computeAttendanceView(
  record: Pick<AttendanceRecord, 'status' | 'checkIn' | 'checkOut' | 'workHours'>,
  settings: AttendanceSettings,
): AttendanceComputedView {
  if (record.status === 'leave') {
    return { status: 'leave', label: 'Leave', displayHours: 0, actualHours: 0 };
  }

  if (record.status === 'absent') {
    return { status: 'absent', label: 'Absent', displayHours: 0, actualHours: 0 };
  }

  const workedMinutes = computeWorkedMinutes(record.checkIn, record.checkOut);
  const actualHours = workedMinutes === null ? Math.max(record.workHours, 0) : workedMinutes / 60;
  const displayHours = normalizeHours(
    workedMinutes === null ? Math.round(actualHours * 60) : workedMinutes,
    settings.hoursDisplayCase,
  );

  if (settings.fulfillmentCase === 'case_3') {
    const isActive = workedMinutes !== null && workedMinutes >= FULL_WORKDAY_MINUTES;
    return {
      status: isActive ? 'present' : 'insufficient',
      label: isActive ? 'Active' : 'Thiếu',
      displayHours,
      actualHours,
    };
  }

  const checkInMinutes = parseTimeToMinutes(record.checkIn);
  const checkOutMinutes = parseTimeToMinutes(record.checkOut);

  if (settings.fulfillmentCase === 'case_2') {
    // CASE 2: checkIn <= 8:15 và đủ 8h workHours
    const isActive =
      checkInMinutes !== null &&
      checkOutMinutes !== null &&
      checkInMinutes <= CASE_2_START_MINUTES &&
      checkOutMinutes >= CASE_2_END_MINUTES;

    return {
      status: isActive ? 'present' : 'insufficient',
      label: isActive ? 'Active' : 'Thiếu',
      displayHours,
      actualHours,
    };
  }

  // CASE 1: checkIn <= 8:00 và checkOut >= 17:15
  const isActive =
    checkInMinutes !== null &&
    checkOutMinutes !== null &&
    checkInMinutes <= FIXED_START_MINUTES &&
    checkOutMinutes >= CASE_1_END_MINUTES;

  return {
    status: isActive ? 'present' : 'insufficient',
    label: isActive ? 'Active' : 'Thiếu',
    displayHours,
    actualHours,
  };
}

function shouldHideHolidayAbsentRecord(
  day: AttendanceDay | undefined,
  record: Pick<AttendanceRecord, 'status' | 'checkIn' | 'checkOut'> | undefined | null,
) {
  return Boolean(
    day?.isHoliday &&
      record &&
      record.status === 'absent' &&
      !record.checkIn &&
      !record.checkOut,
  );
}

function getStatusStyle(status: AttendanceDisplayStatus) {
  switch (status) {
    case 'insufficient':
      return {
        color: '#b45309',
        background: '#fff7ed',
        border: '#fed7aa',
        label: 'Thiếu',
      };
    case 'absent':
      return {
        color: '#b42318',
        background: '#fff1f3',
        border: '#fecdd3',
        label: 'Vắng',
      };
    case 'leave':
      return {
        color: '#6d28d9',
        background: '#f5f3ff',
        border: '#ddd6fe',
        label: 'Nghỉ',
      };
    default:
      return {
        color: '#166534',
        background: '#ecfdf3',
        border: '#bbf7d0',
        label: 'Có mặt',
      };
  }
}

function renderBadgeLabel(view: AttendanceComputedView) {
  if (view.status === 'present') return formatHours(view.displayHours);
  if (view.status === 'insufficient' && view.displayHours > 0) {
    return `${formatHours(view.displayHours)}`;
  }
  return getStatusStyle(view.status).label;
}

function isAttendanceEditor(user: ViewerUser | null) {
  const role = user?.role?.toUpperCase();
  const systemRole = user?.systemRole?.toUpperCase();
  return role === 'HR' || role === 'ADMIN' || systemRole === 'ADMIN';
}

export default function AttendancePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [monthInput, setMonthInput] = useState(getPreviousMonth());
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState<AttendanceDisplayStatus[]>([]);
  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Array<{ value: string; label: string }>>(
    [],
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [viewer, setViewer] = useState<ViewerUser | null>(() => getStoredUser<ViewerUser>());
  const [settings, setSettings] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<{
    employee: AttendanceEmployee;
    record: AttendanceRecord;
  } | null>(null);
  const [editorState, setEditorState] = useState<AttendanceEditorState>({
    status: 'present',
    checkIn: '',
    checkOut: '',
    note: '',
  });

  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<AttendanceSettings>('/api/settings/attendance')
      .then(({ data }) => {
        setSettings({ ...DEFAULT_ATTENDANCE_SETTINGS, ...(data || {}) });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiClient
      .get<{ data: ViewerUser }>('/api/auth/me')
      .then(({ data: responseData }) => setViewer(responseData?.data || responseData))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiClient
      .get<Array<{ value: string; label: string }>>('/api/attendances/available-months')
      .then(({ data: months }) => {
        setAvailableMonths(months);
        // Nếu tháng hiện tại không có trong danh sách, chọn tháng đầu tiên
        if (months.length > 0 && !months.some((m) => m.value === monthInput)) {
          setMonthInput(months[0].value);
        }
      })
      .catch(() => {
        // Nếu API lỗi, fallback về danh sách mặc định
        setAvailableMonths(getDefaultAvailableMonths());
      });
  }, [monthInput]);

  useEffect(() => {
    if (!selectedRecord) return;

    setEditorState({
      status: selectedRecord.record.status,
      checkIn: formatTimeInputValue(selectedRecord.record.checkIn),
      checkOut: formatTimeInputValue(selectedRecord.record.checkOut),
      note: selectedRecord.record.note || '',
    });
  }, [selectedRecord]);

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
    [monthParts.month, monthParts.year, searchQuery],
  );

  useEffect(() => {
    void fetchAttendances(true);
  }, [fetchAttendances]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const toggleStatus = (status: AttendanceDisplayStatus) => {
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

  const availableDepartments = useMemo(() => {
    if (!data?.employees) return [];
    const depts = new Set<string>();
    data.employees.forEach((emp) => {
      if (emp.department) depts.add(emp.department);
    });
    return Array.from(depts).sort();
  }, [data]);

  const attendanceDayMap = useMemo(
    () => Object.fromEntries((data?.days ?? []).map((day) => [day.date, day])),
    [data],
  );

  const filteredEmployees = useMemo(() => {
    // Only keep employees that are countable (true) or don't have this property defined
    const employees = data?.employees?.filter((emp) => emp.isCountable !== false) ?? [];
    let filtered = employees;

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter((emp) => emp.department === selectedDepartment);
    }

    if (!selectedStatuses.length) return filtered;

    return filtered.filter((employee) =>
      Object.values(employee.recordsByDate).some((record) => {
        const day = attendanceDayMap[record.date];
        if (shouldHideHolidayAbsentRecord(day, record)) return false;
        return selectedStatuses.includes(computeAttendanceView(record, settings).status);
      }),
    );
  }, [attendanceDayMap, data, selectedStatuses, settings, selectedDepartment]);

  const handleSaveSettings = async () => {
    setIsSettingsSaving(true);
    try {
      await apiClient.patch('/api/settings/attendance', settings);
      toast.success('Lưu thiết lập thành công');
      setIsSettingsOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi lưu thiết lập');
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const sortedEmployees = useMemo(() => {
    if (!sortOrder) return filteredEmployees;

    return [...filteredEmployees].sort((a, b) => {
      const totalA = Object.values(a.recordsByDate).reduce((sum, record) => {
        const day = attendanceDayMap[record.date];
        if (shouldHideHolidayAbsentRecord(day, record)) return sum;
        const view = computeAttendanceView(record, settings);
        return sum + view.displayHours;
      }, 0);

      const totalB = Object.values(b.recordsByDate).reduce((sum, record) => {
        const day = attendanceDayMap[record.date];
        if (shouldHideHolidayAbsentRecord(day, record)) return sum;
        const view = computeAttendanceView(record, settings);
        return sum + view.displayHours;
      }, 0);

      return sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
    });
  }, [attendanceDayMap, filteredEmployees, sortOrder, settings]);

  const topEmployees = useMemo(() => {
    const employees = data?.employees?.filter((emp) => emp.isCountable !== false) ?? [];
    const mapped = employees.map((emp) => {
      const totalMonthHours = Object.values(emp.recordsByDate).reduce((sum, record) => {
        const day = attendanceDayMap[record.date];
        if (shouldHideHolidayAbsentRecord(day, record)) return sum;
        const view = computeAttendanceView(record, settings);
        return sum + view.displayHours;
      }, 0);
      return { ...emp, totalMonthHours };
    });

    return mapped
      .filter((emp) => emp.totalMonthHours > 0)
      .sort((a, b) => b.totalMonthHours - a.totalMonthHours)
      .slice(0, 3);
  }, [attendanceDayMap, data, settings]);

  const stats = useMemo(() => {
    let activeDays = 0;
    let insufficientDays = 0;
    let absentDays = 0;

    sortedEmployees.forEach((employee) => {
      Object.values(employee.recordsByDate).forEach((record) => {
        const day = attendanceDayMap[record.date];
        if (shouldHideHolidayAbsentRecord(day, record)) return;
        const view = computeAttendanceView(record, settings);
        if (view.status === 'present') activeDays += 1;
        if (view.status === 'insufficient') insufficientDays += 1;
        if (view.status === 'absent') absentDays += 1;
      });
    });

    return {
      totalEmployees: sortedEmployees.length,
      activeDays,
      insufficientDays,
      absentDays,
    };
  }, [attendanceDayMap, sortedEmployees, settings]);

  const canEdit = isAttendanceEditor(viewer);

  const handleToggleSort = () => {
    if (sortOrder === null) {
      setSortOrder('desc'); // Giảm dần (nhiều giờ nhất trước)
    } else if (sortOrder === 'desc') {
      setSortOrder('asc'); // Tăng dần (ít giờ nhất trước)
    } else {
      setSortOrder(null); // Không sắp xếp
    }
  };

  const handlePreviousMonth = () => {
    const [year, month] = monthInput.split('-').map(Number);
    const date = new Date(year, month - 2, 1); // month - 2 vì getMonth() trả về 0-11
    const newValue = getMonthInputValue(date);

    // Kiểm tra xem tháng mới có trong danh sách không
    if (availableMonths.some((m) => m.value === newValue)) {
      setMonthInput(newValue);
    }
  };

  const handleNextMonth = () => {
    const [year, month] = monthInput.split('-').map(Number);
    const date = new Date(year, month, 1); // month vì getMonth() trả về 0-11
    const newValue = getMonthInputValue(date);

    // Kiểm tra xem tháng mới có trong danh sách không
    if (availableMonths.some((m) => m.value === newValue)) {
      setMonthInput(newValue);
    }
  };

  const currentMonthIndex = availableMonths.findIndex((m) => m.value === monthInput);
  const canGoPrevious = currentMonthIndex < availableMonths.length - 1;
  const canGoNext = currentMonthIndex > 0;

  const renderPodiumAvatar = (employee: any, index: number) => {
    const isFirst = index === 0;
    const isSecond = index === 1;

    const displayName = getFullName(employee);
    const avatarUrl = getAvatarUrl(employee.avatar);

    const ringColor = isFirst
      ? 'border-yellow-400'
      : isSecond
        ? 'border-[#38bdf8]'
        : 'border-[#c084fc]';
    const badgeColor = isFirst ? 'bg-yellow-400' : isSecond ? 'bg-[#38bdf8]' : 'bg-[#c084fc]';
    const sizeClass = isFirst ? 'w-24 h-24 sm:w-[110px] sm:h-[110px]' : 'w-20 h-20 sm:w-24 sm:h-24';
    const badgeSize = isFirst ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs';

    return (
      <div className={`flex flex-col items-center ${isFirst ? 'pb-4 sm:pb-6' : ''}`}>
        {isFirst ? (
          <Crown className="text-yellow-400 mb-2 fill-yellow-400" size={28} />
        ) : (
          <div className="h-9 mb-2" />
        )}
        <div className="relative mb-3">
          <div
            className={`${sizeClass} rounded-full p-1 bg-white border-[3px] shadow-sm ${ringColor}`}
          >
            <div className="w-full h-full rounded-full overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #1DB87A 100%)' }}
                >
                  {displayName
                    .split(' ')
                    .slice(0, 2)
                    .map((i) => i.charAt(0))
                    .join('')
                    .toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div
            className={`absolute -bottom-2 sm:-bottom-3 left-1/2 -translate-x-1/2 ${badgeSize} ${badgeColor} text-white rounded-full flex items-center justify-center font-bold shadow-md`}
          >
            {index + 1}
          </div>
        </div>
        <p
          className={`font-bold mt-2 line-clamp-2 w-full max-w-[120px] sm:max-w-[160px] leading-tight text-center ${isFirst ? 'text-base sm:text-lg text-gray-800' : 'text-sm sm:text-base text-gray-700'}`}
          title={displayName}
        >
          {displayName}
        </p>
        <div className="flex items-center gap-1 text-sm text-yellow-600 mt-0.5 font-semibold">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
          {formatHours(employee.totalMonthHours)}
        </div>
      </div>
    );
  };

  const previewRecord = useMemo(() => {
    if (!selectedRecord) return null;

    return computeAttendanceView(
      {
        ...selectedRecord.record,
        status: editorState.status,
        checkIn: editorState.checkIn || null,
        checkOut: editorState.checkOut || null,
      },
      settings,
    );
  }, [editorState, selectedRecord, settings]);

  const handleSaveAttendance = async () => {
    if (!selectedRecord) return;
    if (!canEdit) {
      toast.error('Bạn không có quyền chỉnh sửa attendance.');
      return;
    }

    if (
      (editorState.checkIn && !editorState.checkOut) ||
      (!editorState.checkIn && editorState.checkOut)
    ) {
      toast.error('Cần nhập đủ cả giờ vào và giờ ra, hoặc để trống cả hai.');
      return;
    }

    const workHours =
      editorState.status === 'absent' || editorState.status === 'leave'
        ? 0
        : (previewRecord?.actualHours ?? 0);

    try {
      setIsSavingAttendance(true);
      await apiClient.patch(`/api/attendances/${selectedRecord.record.id}`, {
        status: editorState.status,
        checkIn: editorState.checkIn || null,
        checkOut: editorState.checkOut || null,
        workHours,
        note: editorState.note.trim() || null,
      });
      toast.success('Đã cập nhật attendance.');
      setSelectedRecord(null);
      await fetchAttendances();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật attendance.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const canEditSettings = viewer?.role === 'HR' || viewer?.systemRole === 'ADMIN';

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
              Chấm công
            </h1>
            <p className="text-xs" style={{ color: '#6b7f78' }}>
              Theo dõi chấm công theo tháng.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
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
                onClick={() => setIsSettingsOpen(true)}
                className="gap-2"
              >
                <Settings2 size={14} />
                Setting
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
            </>
          )}
        </div>
      </div>

      {settings.showRanking !== false && topEmployees.length > 0 && (
        <div className="py-6 bg-[#fffdf5] rounded-xl border border-yellow-100 relative overflow-hidden hidden sm:block">
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{ background: 'radial-gradient(circle at center, #fbbf24 0%, transparent 70%)' }}
          />
          <div className="flex justify-center items-end gap-x-6 sm:gap-x-16 relative z-10 px-4">
            {topEmployees[1] && renderPodiumAvatar(topEmployees[1], 1)}
            {topEmployees[0] && renderPodiumAvatar(topEmployees[0], 0)}
            {topEmployees[2] && renderPodiumAvatar(topEmployees[2], 2)}
          </div>
        </div>
      )}

      {/* <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            label: 'Ngày thiếu',
            value: stats.insufficientDays,
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
      </div> */}

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="flex flex-wrap items-end gap-3">
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
                className="px-3 text-white shrink-0"
                style={{ background: '#1DB87A' }}
              >
                <Search size={14} />
              </Button>
            </div>
          </div>
          <div className="w-full sm:w-[200px]">
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Phòng ban
            </label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-full h-[36px]">
                <SelectValue placeholder="Tất cả phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phòng ban</SelectItem>
                {availableDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* <div className="mt-4 flex flex-wrap gap-2">
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
        </div> */}
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
          <div className="flex items-center gap-3">
            <CalendarDays size={15} style={{ color: '#1DB87A' }} />
            <div>
              <h2 className="text-sm font-semibold" style={{ color: '#203430' }}>
                Bảng chấm công {formatMonthDisplay(monthInput)}
              </h2>
              <p className="text-[11px]" style={{ color: '#6b7f78' }}>
                Rule đủ công:{' '}
                {settings.fulfillmentCase === 'case_1'
                  ? '08:00 - 17:15'
                  : settings.fulfillmentCase === 'case_2'
                    ? '08:15 - 17:30'
                    : 'Linh hoạt đủ 8h'}{' '}
                | Nghỉ trưa: 11:45-13:00 (1h15) | Tổng giờ:{' '}
                {settings.hoursDisplayCase === 'case_1' ? 'Tối đa 8h' : 'Thực tế'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#6b7f78' }}>
              {filteredEmployees.length} nhân viên
            </span>
            <div className="flex items-center gap-2">
              <Select value={monthInput} onValueChange={setMonthInput}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePreviousMonth}
                disabled={!canGoPrevious}
                className="h-9 w-9"
                title="Tháng trước"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                disabled={!canGoNext}
                className="h-9 w-9"
                title="Tháng sau"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
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
                <th
                  className="sticky left-[260px] z-20 min-w-[100px] border-r px-3 py-3 text-center font-semibold"
                  style={{ background: '#f8faf9', borderColor: '#e2ede9', color: '#203430' }}
                >
                  <button
                    type="button"
                    onClick={handleToggleSort}
                    className="flex w-full items-center justify-center gap-1 hover:opacity-70 transition-opacity"
                  >
                    <div className="space-y-0.5">
                      <p>Tổng giờ</p>
                      <p className="text-[10px] font-normal" style={{ color: '#6b7f78' }}>
                        tháng {monthParts.month}
                      </p>
                    </div>
                    {sortOrder === null ? (
                      <ArrowUpDown size={14} style={{ color: '#9ca3af' }} />
                    ) : sortOrder === 'desc' ? (
                      <ArrowDown size={14} style={{ color: '#1DB87A' }} />
                    ) : (
                      <ArrowUp size={14} style={{ color: '#1DB87A' }} />
                    )}
                  </button>
                </th>
                {data?.days.map((day) => (
                  <th
                    key={day.date}
                    className={`border-r px-3 py-3 font-semibold text-center ${getDayHeaderStyles(day).widthClass}`}
                    style={{
                      background: getDayHeaderStyles(day).background,
                      borderColor: '#e2ede9',
                      color: getDayHeaderStyles(day).color,
                    }}
                    title={day.holidayNames.join(', ') || undefined}
                  >
                    <div className="space-y-0.5">
                      <p className={day.isWeekend && !day.isHoliday ? 'text-[10px]' : ''}>
                        {WEEKDAY_LABELS[day.weekday]}
                      </p>
                      <p
                        className={`font-bold ${
                          day.isWeekend && !day.isHoliday ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        {day.day}
                      </p>
                      {day.isHoliday && day.holidayNames.length > 0 && (
                        <div className="space-y-0.5 pt-1">
                          {day.holidayNames.slice(0, 2).map((name) => (
                            <p key={name} className="line-clamp-2 text-[10px] font-semibold leading-relaxed">
                              {name}
                            </p>
                          ))}
                          {day.holidayNames.length > 2 && (
                            <p className="text-[10px] font-medium">+{day.holidayNames.length - 2}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={(data?.days.length ?? 0) + 2}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Đang tải dữ liệu chấm công...
                  </td>
                </tr>
              ) : !filteredEmployees.length ? (
                <tr>
                  <td
                    colSpan={(data?.days.length ?? 0) + 2}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Không có dữ liệu chấm công phù hợp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((employee) => {
                  const displayName = getFullName(employee);
                  const avatarUrl = getAvatarUrl(employee.avatar);

                  // Tính tổng giờ trong tháng
                  const totalMonthHours = Object.values(employee.recordsByDate).reduce(
                    (sum, record) => {
                      const view = computeAttendanceView(record, settings);
                      return sum + view.displayHours;
                    },
                    0,
                  );

                  return (
                    <tr key={employee.id}>
                      <td
                        className="sticky left-0 z-10 border-r border-t px-4 py-3 align-center"
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
                            {employee.department && (
                              <p
                                className="truncate text-xs font-medium mt-0.5"
                                style={{ color: '#6b7f78' }}
                              >
                                {employee.department}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td
                        className="sticky left-[260px] z-10 border-r border-t px-3 py-3 align-middle text-center"
                        style={{ background: '#fff', borderColor: '#e2ede9' }}
                      >
                        <div className="space-y-0.5">
                          <p className="text-md font-bold" style={{ color: '#1DB87A' }}>
                            {formatHours(totalMonthHours)}
                          </p>
                          <p className="text-[10px]" style={{ color: '#6b7f78' }}>
                            {
                              Object.values(employee.recordsByDate).filter(
                                (r) => r.checkIn || r.checkOut,
                              ).length
                            }{' '}
                            ngày
                          </p>
                        </div>
                      </td>

                      {data?.days.map((day) => {
                        const record = employee.recordsByDate[day.date];
                        const hiddenHolidayAbsent = shouldHideHolidayAbsentRecord(day, record);
                        const view =
                          record && !hiddenHolidayAbsent ? computeAttendanceView(record, settings) : null;
                        const statusStyle = view ? getStatusStyle(view.status) : null;

                        return (
                          <td
                            key={`${employee.id}-${day.date}`}
                            className={`border-r border-t align-center ${
                              day.isWeekend && !day.isHoliday ? 'px-2 py-2' : 'px-3 py-3'
                            }`}
                            style={{
                              borderColor: '#e2ede9',
                              background: getAttendanceCellBackground(day),
                            }}
                          >
                            {day.isHoliday && (!record || hiddenHolidayAbsent) ? (
                              <div className="flex h-full items-center justify-center">
                                <div
                                  className="rounded-lg border px-2.5 py-1.5 text-center text-[10px] font-semibold"
                                  style={{
                                    borderColor: '#fdba74',
                                    background: '#fff',
                                    color: '#c2410c',
                                  }}
                                  title={day.holidayNames.join(', ')}
                                >
                                  {day.holidayNames[0] || 'Lễ'}
                                </div>
                              </div>
                            ) : day.isWeekend ? (
                              <div className="flex h-full items-center justify-center">
                                <div
                                  className="rounded-lg px-2 py-1 text-center text-[10px] font-medium"
                                  style={{
                                    background: '#f4f4f5',
                                    color: '#a1a1aa',
                                  }}
                                >
                                  {day.weekday === 0 ? 'CN' : 'T7'}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {record ? (
                                  <button
                                    type="button"
                                    onClick={() => canEdit && setSelectedRecord({ employee, record })}
                                    className={cn("w-full rounded-xl border px-2 py-2 text-left", canEdit && "transition-transform hover:-translate-y-0.5", !canEdit && "cursor-default")}
                                    style={{
                                      borderColor: statusStyle?.border,
                                      background: statusStyle?.background,
                                      color: statusStyle?.color,
                                    }}
                                  >
                                    <p
                                      className={cn(
                                        'text-xs font-bold',
                                        view?.status == 'absent' && 'text-center',
                                      )}
                                    >
                                      {view ? renderBadgeLabel(view) : '--'}
                                    </p>
                                    {record.checkIn || record.checkOut ? (
                                      <p className="mt-1 text-[11px] opacity-80">
                                        {formatTime(record.checkIn)} - {formatTime(record.checkOut)}
                                      </p>
                                    ) : null}
                                  </button>
                                ) : (
                                  <div
                                    className="rounded-xl border px-2 py-2 text-[11px] text-center"
                                    style={{ borderColor: '#edf1ef', color: '#9ca3af' }}
                                  >
                                    No data
                                  </div>
                                )}
                              </div>
                            )}
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

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Thiết lập chấm công toàn hệ thống</DialogTitle>
            <DialogDescription>
              Cấu hình các quy tắc chấm công chung cho toàn bộ nhân viên.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                  Rule tính đủ công
                </p>
                <p className="text-xs" style={{ color: '#6b7f78' }}>
                  Dùng để quyết định ô attendance hiển thị xanh active hay thiếu.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    value: 'case_1' as const,
                    title: 'CASE 1',
                    description:
                      '08:00 - 17:15, nghỉ trưa 11:45-13:00 (1h15), đủ công thì active xanh.',
                  },
                  {
                    value: 'case_2' as const,
                    title: 'CASE 2',
                    description:
                      '08:15 - 17:30, nghỉ trưa 11:45-13:00 (1h15), đủ công thì active xanh.',
                  },
                  {
                    value: 'case_3' as const,
                    title: 'CASE 3',
                    description:
                      'Linh hoạt: checkout - checkin - nghỉ trưa >= 8h thì đủ, còn lại tính thiếu.',
                  },
                ].map((item) => {
                  const active = settings.fulfillmentCase === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, fulfillmentCase: item.value }))
                      }
                      disabled={!canEditSettings}
                      className="rounded-xl border p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: active ? '#1DB87A' : '#e2ede9',
                        background: active ? '#ecfdf3' : '#fff',
                      }}
                    >
                      <p className="text-sm font-bold" style={{ color: '#203430' }}>
                        {item.title}
                      </p>
                      <p className="mt-2 text-xs leading-5" style={{ color: '#6b7f78' }}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                  Cách hiển thị tổng giờ
                </p>
                <p className="text-xs" style={{ color: '#6b7f78' }}>
                  Dùng để hiển thị số giờ trong badge và popup chi tiết.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    value: 'case_1' as const,
                    title: 'CASE 1',
                    description: 'Chỉ tính tối đa đúng 8h sau khi đã trừ nghỉ trưa (nếu có).',
                  },
                  {
                    value: 'case_2' as const,
                    title: 'CASE 2',
                    description:
                      'Tính toàn bộ từ checkin đến checkout sau khi trừ nghỉ trưa (nếu có).',
                  },
                ].map((item) => {
                  const active = settings.hoursDisplayCase === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, hoursDisplayCase: item.value }))
                      }
                      disabled={!canEditSettings}
                      className="rounded-xl border p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderColor: active ? '#1DB87A' : '#e2ede9',
                        background: active ? '#ecfdf3' : '#fff',
                      }}
                    >
                      <p className="text-sm font-bold" style={{ color: '#203430' }}>
                        {item.title}
                      </p>
                      <p className="mt-2 text-xs leading-5" style={{ color: '#6b7f78' }}>
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                  Tính năng hiển thị
                </p>
                <p className="text-xs" style={{ color: '#6b7f78' }}>
                  Bật/tắt các biểu đồ, vinh danh trên giao diện.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    if (canEditSettings) {
                      setSettings((prev) => ({ ...prev, showRanking: !prev.showRanking }));
                    }
                  }}
                  disabled={!canEditSettings}
                  className="rounded-xl border p-4 text-left transition-colors flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: settings.showRanking !== false ? '#1DB87A' : '#e2ede9',
                    background: settings.showRanking !== false ? '#ecfdf3' : '#fff',
                  }}
                >
                  <div className="pr-4">
                    <p className="text-sm font-bold" style={{ color: '#203430' }}>
                      Bảng xếp hạng (Top 3)
                    </p>
                    <p className="mt-2 text-xs leading-5" style={{ color: '#6b7f78' }}>
                      Hiển thị 3 nhân viên có giờ công cao nhất vào đầu trang.
                    </p>
                  </div>
                  <div>
                    <Switch checked={settings.showRanking !== false} />
                  </div>
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>
                {canEditSettings ? 'Hủy' : 'Đóng'}
              </Button>
              {canEditSettings && (
                <Button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSettingsSaving}
                  className="text-white"
                  style={{ background: '#1DB87A' }}
                >
                  {isSettingsSaving ? 'Đang lưu...' : 'Lưu thiết lập'}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{canEdit ? 'Chỉnh sửa attendance' : 'Chi tiết attendance'}</DialogTitle>
            <DialogDescription>
              {selectedRecord
                ? `${getFullName(selectedRecord.employee)} - ${formatDisplayDate(selectedRecord.record.date)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && canEdit && (
              <div className="space-y-4">
                <div
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: '#d1fae5', background: '#f0fdf4' }}
                >
                  <p className="text-sm font-semibold" style={{ color: '#166534' }}>
                    Trạng thái hiển thị: {previewRecord?.label ?? '--'}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: '#15803d' }}>
                    Tổng giờ hiển thị: {formatHours(previewRecord?.displayHours ?? 0)} | Tổng giờ
                    thực tế sau nghỉ trưa: {formatHours(previewRecord?.actualHours ?? 0)}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                      Trạng thái gốc
                    </label>
                    <Select
                      value={editorState.status}
                      onValueChange={(value) =>
                        setEditorState((prev) => ({
                          ...prev,
                          status: value as RawAttendanceStatus,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="leave">Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                      Mã nhân viên
                    </label>
                    <Input
                      value={
                        selectedRecord.employee.employeeCode ||
                        selectedRecord.employee.username ||
                        '-'
                      }
                      readOnly
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                      Giờ vào
                    </label>
                    <Input
                      type="time"
                      value={editorState.checkIn}
                      onChange={(event) =>
                        setEditorState((prev) => ({ ...prev, checkIn: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                      Giờ ra
                    </label>
                    <Input
                      type="time"
                      value={editorState.checkOut}
                      onChange={(event) =>
                        setEditorState((prev) => ({ ...prev, checkOut: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                    Ghi chú
                  </label>
                  <Textarea
                    value={editorState.note}
                    onChange={(event) =>
                      setEditorState((prev) => ({ ...prev, note: event.target.value }))
                    }
                    rows={4}
                    placeholder="Thêm ghi chú attendance..."
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedRecord(null)}
                    disabled={isSavingAttendance}
                  >
                    Đóng
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSaveAttendance()}
                    disabled={isSavingAttendance}
                    className="text-white"
                    style={{ background: '#1DB87A' }}
                  >
                    {isSavingAttendance ? 'Đang lưu...' : 'Lưu attendance'}
                  </Button>
                </DialogFooter>
              </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
