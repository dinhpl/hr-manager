'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Building2,
  Cake,
  CalendarOff,
  FileDown,
  Pencil,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from 'sonner';
import { api, apiClient, getApiBaseUrl, getStoredToken, getStoredUser } from '@/lib/api-client';
import {
  buildQuery,
  formatDate,
  formatDateVN,
  getFullName,
  getRoleLabel,
  toFrontendRole,
  toIsoDateTime,
} from '@/lib/hr-utils';

type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN';
type EmployeeStatus = 'active' | 'inactive';

interface EmployeeApiItem {
  id: string | number;
  email: string;
  username?: string | null;
  employeeCode?: string | null;
  fullName?: string | null;
  role?: UserRole | null;
  department?: string | null;
  position?: string | null;
  avatar?: string | null;
  teamId?: number | null;
  isCountable?: boolean;
  isAttendance?: boolean;
  preJoinDate?: string | null;
  companyJoinDate?: string | null;
  manager?: {
    id: string | number;
    fullName: string;
    username?: string | null;
  } | null;
  isActive: boolean;
  createdAt: string;
  birthday?: string | null;
  gender?: string | null;
  phone?: string | null;
}

interface UserDropdownItem {
  id: string | number;
  fullName?: string | null;
  username?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  role?: UserRole | null;
}

interface EmployeeRow {
  id: string;
  email: string;
  username: string;
  employeeCode: string;
  fullName: string;
  profileImageUrl: string | null;
  role: UserRole;
  department: string;
  position: string;
  managerId: string;
  managerName: string;
  isCountable: boolean;
  isAttendance: boolean;
  status: EmployeeStatus;
  preJoinDate: string | null;
  companyJoinDate: string | null;
  birthday: string | null;
  gender: string;
  phone: string;
}

interface EmployeeFormData {
  fullName: string;
  email: string;
  username: string;
  employeeCode: string;
  password: string;
  role: UserRole;
  department: string;
  position: string;
  managerId: string;
  isCountable: boolean;
  isAttendance: boolean;
  preJoinDate: string;
  companyJoinDate: string;
  birthday: string;
  status: EmployeeStatus;
  gender: string;
  phone: string;
}

// Department item from /api/departments
interface DepartmentItem {
  id: string;
  code: string;
  name: string;
}

// Fallback palette for departments without a defined color (cycles through these)
const PALETTE: Array<{ color: string; bg: string }> = [
  { color: '#3b82f6', bg: '#eff6ff' },
  { color: '#f59e0b', bg: '#fffbeb' },
  { color: '#1DB87A', bg: '#f0fdf9' },
  { color: '#06b6d4', bg: '#ecfeff' },
  { color: '#8b5cf6', bg: '#f5f3ff' },
  { color: '#f43f5e', bg: '#fff1f2' },
  { color: '#0ea5e9', bg: '#f0f9ff' },
];

function getDeptColor(name: string, index: number): { color: string; bg: string } {
  return PALETTE[index % PALETTE.length];
}

function getAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  // External URL: use as-is
  if (avatar.startsWith('http')) return avatar;
  // Preset avatars (same origin): /assets/...
  if (avatar.startsWith('/assets')) return avatar;
  // Uploaded avatars: backend phục vụ file → dùng full URL backend
  if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
  return null;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'EMPLOYEE', label: 'Nhân viên' },
  { value: 'MANAGER', label: 'Quản lý' },
  { value: 'HR', label: 'HR' },
  { value: 'ADMIN', label: 'Admin' },
];

const STATUS_CONFIG: Record<EmployeeStatus, { label: string; badge: string }> = {
  active: {
    label: 'Đang làm việc',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  inactive: {
    label: 'Đã nghỉ',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
};

function buildUsernameFromEmail(email: string) {
  return (
    email
      .trim()
      .toLowerCase()
      .split('@')[0]
      .replace(/[^a-z0-9._-]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '') || `user.${Date.now()}`
  );
}

function getDefaultEmployeeFormData(departments: DepartmentItem[]): EmployeeFormData {
  return {
    fullName: '',
    email: '',
    username: '',
    employeeCode: '',
    password: '',
    role: 'EMPLOYEE',
    department: departments[0]?.name ?? '',
    position: '',
    managerId: '',
    isCountable: true,
    isAttendance: true,
    preJoinDate: '',
    companyJoinDate: '',
    birthday: '',
    status: 'active',
    gender: '',
    phone: '',
  };
}

function mapEmployee(item: EmployeeApiItem): EmployeeRow {
  const fullName = getFullName({
    fullName: item.fullName,
    username: item.username,
  });

  return {
    id: String(item.id),
    email: item.email,
    username: item.username?.trim() || buildUsernameFromEmail(item.email),
    employeeCode: item.employeeCode?.trim() || '',
    fullName,
    profileImageUrl: item.avatar ?? null,
    role: item.role ?? 'EMPLOYEE',
    department: item.department?.trim() || 'Chưa phân bổ',
    position: item.position?.trim() || '',
    managerId: item.manager ? String(item.manager.id) : '',
    managerName: item.manager?.fullName?.trim() || '',
    isCountable: item.isCountable ?? true,
    isAttendance: item.isAttendance ?? true,
    status: item.isActive ? 'active' : 'inactive',
    preJoinDate: item.preJoinDate ?? null,
    companyJoinDate: item.companyJoinDate ?? null,
    birthday: item.birthday ? item.birthday.slice(0, 10) : null,
    gender: item.gender ?? '',
    phone: item.phone ?? '',
  };
}

export default function EmployeesPage() {
  const storedUser = getStoredUser<{ id?: string | number; role?: string }>();
  const currentRole = toFrontendRole(storedUser?.role);
  const isReadOnly = currentRole === 'employee';
  const canExport = currentRole === 'hr' || currentRole === 'admin';

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [managerOptions, setManagerOptions] = useState<UserDropdownItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'role' | 'department' | 'employeeCode' | null>(
    null,
  );
  const [editingValue, setEditingValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await apiClient.get<DepartmentItem[]>('/api/departments');
      setDepartments(data ?? []);
    } catch {
      setDepartments([]);
    }
  }, []);

  const fetchManagers = useCallback(async () => {
    try {
      const { data } = await apiClient.get<UserDropdownItem[]>('/api/users/dropdown');
      setManagerOptions(data ?? []);
    } catch {
      setManagerOptions([]);
    }
  }, []);

  const fetchEmployees = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const query = buildQuery({
          search: searchQuery || undefined,
          department: teamFilter || undefined,
          status: statusFilter || undefined,
          page: 1,
          limit: 100,
        });
        const url = query ? `/api/users?${query}` : '/api/users';
        const { data } = await apiClient.get<EmployeeApiItem[]>(url);
        const mappedEmployees = data.map(mapEmployee);

        setEmployees(mappedEmployees);
        setSelectedIds((prev) =>
          prev.filter((id) => mappedEmployees.some((item) => item.id === id)),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Không thể tải danh sách nhân viên.';
        scrollToTop();
        toast.error(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [scrollToTop, searchQuery, statusFilter, teamFilter],
  );

  useEffect(() => {
    void fetchDepartments();
    void fetchManagers();
  }, [fetchDepartments, fetchManagers]);

  useEffect(() => {
    void fetchEmployees(true);
  }, [fetchEmployees]);

  const departmentDistribution = useMemo(() => {
    if (!employees.length) return [];

    const total = employees.length;
    const grouped = employees.reduce<Record<string, number>>((acc, employee) => {
      acc[employee.department] = (acc[employee.department] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([department, count], index) => {
        const palette = getDeptColor(department, index);
        const pct = Math.round((count / total) * 100);

        return {
          label: department,
          code: department.slice(0, 10).toUpperCase(),
          count,
          pct,
          color: palette.color,
        };
      });
  }, [employees]);

  const roleDistribution = useMemo(() => {
    if (!employees.length) return [];

    const total = employees.length;
    const grouped = employees.reduce<Record<string, number>>((acc, employee) => {
      acc[employee.role] = (acc[employee.role] ?? 0) + 1;
      return acc;
    }, {});

    const roleColors: Record<string, { color: string; iconBg: string }> = {
      ADMIN: { color: '#ef4444', iconBg: '#fef2f2' }, // Red
      HR: { color: '#8b5cf6', iconBg: '#f5f3ff' }, // Purple
      MANAGER: { color: '#f59e0b', iconBg: '#fffbeb' }, // Amber
      EMPLOYEE: { color: '#3b82f6', iconBg: '#eff6ff' }, // Blue
    };

    return Object.entries(grouped)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([role, count]) => {
        const pct = Math.round((count / total) * 100);
        const label = ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
        const palette = roleColors[role] || { color: '#6b7f78', iconBg: '#f0f4f2' };

        return {
          role,
          label,
          count,
          pct,
          color: palette.color,
          iconBg: palette.iconBg,
        };
      });
  }, [employees]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedIds(
      selectedIds.length === employees.length ? [] : employees.map((employee) => employee.id),
    );
  };

  const closeInlineEdit = () => {
    setEditingCellId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleCellEdit = async (
    employeeId: string,
    field: 'role' | 'department' | 'employeeCode',
    value: string,
  ) => {
    if (!value && field !== 'employeeCode') return;

    setIsMutating(true);
    try {
      await apiClient.patch(
        `/api/users/${employeeId}`,
        field === 'role'
          ? { role: value }
          : field === 'department'
            ? { department: value }
            : { employeeCode: value.trim() || undefined },
      );
      closeInlineEdit();
      toast.success(
        field === 'role'
          ? 'Đã cập nhật vai trò.'
          : field === 'department'
            ? 'Đã cập nhật phòng ban.'
            : 'Đã cập nhật mã nhân viên.',
      );
      await Promise.all([fetchEmployees(), fetchDepartments(), fetchManagers()]);
    } catch (error) {
      scrollToTop();
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật nhân viên.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateEmployee = async (formData: EmployeeFormData) => {
    setIsMutating(true);
    try {
      const created = await apiClient.post<EmployeeApiItem>('/api/users', {
        email: formData.email.trim(),
        username: formData.username.trim() || buildUsernameFromEmail(formData.email),
        employeeCode: formData.employeeCode.trim() || undefined,
        password: formData.password,
        fullName: formData.fullName.trim(),
        role: formData.role,
        department: formData.department || undefined,
        position: formData.position.trim() || getRoleLabel(formData.role),
        managerId: formData.managerId ? formData.managerId : undefined,
        isCountable: formData.isCountable,
        isAttendance: formData.isAttendance,
        preJoinDate: formData.preJoinDate ? toIsoDateTime(formData.preJoinDate) : undefined,
        companyJoinDate: formData.companyJoinDate
          ? toIsoDateTime(formData.companyJoinDate)
          : undefined,
        birthday: formData.birthday ? toIsoDateTime(formData.birthday) : undefined,
        gender: formData.gender || undefined,
        phone: formData.phone.trim() || undefined,
      });

      if (formData.status === 'inactive') {
        await apiClient.patch(`/api/users/${created.data.id}`, {
          isActive: false,
        });
      }

      setIsAddModalOpen(false);
      toast.success('Đã tạo nhân viên mới.');
      await Promise.all([fetchEmployees(), fetchDepartments()]);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể tạo nhân viên mới.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateEmployee = async (employeeId: string, formData: EmployeeFormData) => {
    setIsMutating(true);
    try {
      await apiClient.patch(`/api/users/${employeeId}`, {
        email: formData.email.trim(),
        username: formData.username.trim() || buildUsernameFromEmail(formData.email),
        employeeCode: formData.employeeCode.trim() || null,
        password: formData.password.trim() || undefined,
        fullName: formData.fullName.trim(),
        role: formData.role,
        department: formData.department || null,
        position: formData.position.trim() || null,
        managerId: formData.managerId ? formData.managerId : null,
        isCountable: formData.isCountable,
        isAttendance: formData.isAttendance,
        preJoinDate: formData.preJoinDate ? toIsoDateTime(formData.preJoinDate) : null,
        companyJoinDate: formData.companyJoinDate ? toIsoDateTime(formData.companyJoinDate) : null,
        birthday: formData.birthday ? toIsoDateTime(formData.birthday) : null,
        isActive: formData.status === 'active',
        gender: formData.gender || null,
        phone: formData.phone.trim() || null,
      });

      setEditingEmployee(null);
      toast.success('Đã cập nhật thông tin nhân viên.');
      await Promise.all([fetchEmployees(), fetchDepartments(), fetchManagers()]);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Không thể cập nhật nhân viên.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteEmployee = async (employeeId: string, fullName: string) => {
    if (
      !window.confirm(
        `Xóa nhân viên "${fullName}"? Tài khoản sẽ được chuyển sang trạng thái không hoạt động.`,
      )
    ) {
      return;
    }

    setIsMutating(true);
    try {
      await apiClient.delete(`/api/users/${employeeId}`);
      toast.success('Đã chuyển nhân viên sang trạng thái không hoạt động.');
      await Promise.all([fetchEmployees(), fetchManagers()]);
    } catch (error) {
      scrollToTop();
      toast.error(error instanceof Error ? error.message : 'Không thể xóa nhân viên.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = getStoredToken();
      const response = await api.get('/api/users/export', {
        responseType: 'arraybuffer',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = new Blob([response.data as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employees_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất danh sách nhân viên.');
    } catch {
      toast.error('Không thể xuất danh sách nhân viên.');
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiClient.post<{
        created: number;
        updated: number;
        errors: { row: number; message: string }[];
      }>('/api/users/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { created, updated, errors } = result.data;
      if (errors.length > 0) {
        toast.warning(
          `Import xong: ${created} tạo mới, ${updated} cập nhật, ${errors.length} lỗi.`,
        );
        console.warn('Import errors:', errors);
      } else {
        toast.success(`Import thành công: ${created} tạo mới, ${updated} cập nhật.`);
      }
      await Promise.all([fetchEmployees(), fetchDepartments(), fetchManagers()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể import file.');
    } finally {
      setIsImporting(false);
    }
  };

  const birthdayThisMonthCount = useMemo(() => {
    const thisMonth = new Date().getMonth() + 1;
    return employees.filter((emp) => {
      if (!emp.birthday) return false;
      return new Date(emp.birthday).getMonth() + 1 === thisMonth;
    }).length;
  }, [employees]);

  return (
    <div className="space-y-4">
      <section className="flex h-[calc(100dvh)] flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center"
              style={{ background: '#D3F2E7' }}
            >
              <Users size={18} style={{ color: '#0E474E' }} />
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
              Quản lý nhân viên
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isReadOnly && (
              <>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: '#1DB87A' }}
                  disabled={isMutating}
                >
                  <UserPlus size={14} /> Thêm nhân viên
                </button>
                <label
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: '#e2ede9', color: '#203430' }}
                  title="Import nhân viên từ file Excel"
                >
                  <Upload size={14} />
                  {isImporting ? 'Đang import...' : 'Import Excel'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={isImporting}
                    onChange={(e) => void handleImport(e)}
                  />
                </label>
              </>
            )}
            {canExport && (
              <button
                type="button"
                onClick={() => void handleExport()}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
                style={{ borderColor: '#e2ede9', color: '#203430' }}
                title="Xuất danh sách nhân viên ra Excel"
              >
                <FileDown size={14} /> Export
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
          {[
            {
              label: 'Tổng nhân viên',
              value: employees.length.toString(),
              icon: Users,
              color: '#3b82f6',
              bg: '#eff6ff',
            },
            {
              label: 'Đang làm việc',
              value: employees.filter((employee) => employee.status === 'active').length.toString(),
              icon: UserCheck,
              color: '#1DB87A',
              bg: '#f0fdf9',
            },
            {
              label: 'Nghỉ phép hôm nay',
              value: '—',
              icon: CalendarOff,
              color: '#f59e0b',
              bg: '#fffbeb',
            },
            {
              label: 'Sinh nhật tháng này',
              value: birthdayThisMonthCount.toString(),
              icon: Cake,
              color: '#06b6d4',
              bg: '#ecfeff',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3"
              style={{ borderColor: '#e2ede9' }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: stat.bg }}
              >
                <stat.icon size={18} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none" style={{ color: '#203430' }}>
                  {stat.value}
                </p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: '#6b7f78' }}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 rounded-xl border bg-white p-3" style={{ borderColor: '#e2ede9' }}>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold leading-4" style={{ color: '#6b7f78' }}>
                Trạng thái
              </label>
              <Select
                value={statusFilter || 'all-status'}
                onValueChange={(value) => setStatusFilter(value === 'all-status' ? '' : value)}
              >
                <SelectTrigger className="h-9 min-w-[144px] text-xs">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Đang làm việc</SelectItem>
                  <SelectItem value="inactive">Tạm nghỉ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold leading-4" style={{ color: '#6b7f78' }}>
                Phòng ban
              </label>
              <Select
                value={teamFilter || 'all-team'}
                onValueChange={(value) => setTeamFilter(value === 'all-team' ? '' : value)}
              >
                <SelectTrigger className="h-9 min-w-[144px] text-xs">
                  <SelectValue placeholder="Phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-team">Tất cả phòng ban</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.code} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[220px] flex-1 items-end gap-2">
              <div className="flex-1">
                <label
                  className="mb-1 block text-[11px] font-semibold leading-4"
                  style={{ color: '#6b7f78' }}
                >
                  Tìm kiếm
                </label>
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="Tìm theo tên, email, mã nhân viên..."
                  className="h-9 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white"
                style={{ background: '#1DB87A' }}
              >
                <Search size={14} />
              </button>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-xl border overflow-hidden flex min-h-0 flex-1 flex-col"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="min-h-0 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: '#203430' }}>
                  {!isReadOnly && (
                    <th className="px-3 py-3 w-10">
                      <Checkbox
                        checked={selectedIds.length === employees.length && employees.length > 0}
                        onCheckedChange={toggleAll}
                        aria-label="Chọn tất cả nhân viên"
                      />
                    </th>
                  )}
                  {[
                    'Avatar',
                    'Họ tên',
                    'Email',
                    'Số điện thoại',
                    'Phòng ban',
                    'Vai trò',
                    'Ngày gia nhập',
                    'Ngày chính thức',
                    'Sinh nhật',
                    'Trạng thái',
                    ...(!isReadOnly ? ['Thao tác'] : []),
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-3 text-left font-semibold text-white whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={isReadOnly ? 10 : 12}
                      className="px-3 py-8 text-center text-sm"
                      style={{ color: '#6b7f78' }}
                    >
                      Đang tải dữ liệu nhân viên...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isReadOnly ? 10 : 12}
                      className="px-3 py-8 text-center text-sm"
                      style={{ color: '#6b7f78' }}
                    >
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
                    const isSelected = selectedIds.includes(employee.id);
                    const isSelf = String(employee.id) === String(storedUser?.id);
                    const initials = employee.fullName.slice(0, 2).toUpperCase();
                    const deptIndex = departments.findIndex((d) => d.name === employee.department);
                    const departmentColor = getDeptColor(
                      employee.department,
                      deptIndex >= 0 ? deptIndex : 0,
                    );

                    return (
                      <tr
                        key={employee.id}
                        className={`border-b last:border-0 hover:bg-gray-50 transition-all${!isReadOnly ? ' cursor-pointer' : ''}`}
                        style={{
                          background: isSelected ? '#f0fdf9' : isSelf ? '#f0fdf9' : undefined,
                          opacity: employee.status === 'inactive' ? 0.75 : 1,
                        }}
                        onClick={!isReadOnly ? () => toggleSelect(employee.id) : undefined}
                      >
                        {!isReadOnly && (
                          <td className="px-3 py-3 w-10">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(employee.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Chọn nhân viên ${employee.fullName}`}
                            />
                          </td>
                        )}
                        <td className="px-3 py-3">
                          {getAvatarUrl(employee.profileImageUrl) ? (
                            <img
                              src={getAvatarUrl(employee.profileImageUrl) || ''}
                              alt={employee.fullName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                              style={{
                                background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                              }}
                            >
                              {initials}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p
                            className="font-semibold whitespace-nowrap"
                            style={{ color: '#203430' }}
                          >
                            {employee.fullName}
                          </p>
                          {employee.department && (
                            <p
                              className="truncate text-[11px] font-medium mt-0.5"
                              style={{ color: '#6b7f78' }}
                            >
                              {employee.department}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: '#6b7f78' }}>
                          {employee.email}
                        </td>
                        <td
                          className="px-3 py-3 text-xs whitespace-nowrap tabular-nums"
                          style={{ color: '#6b7f78' }}
                        >
                          {employee.phone || '—'}
                        </td>
                        <td className="px-3 py-3 min-w-[160px]">
                          {!isReadOnly &&
                          editingCellId === employee.id &&
                          editingField === 'department' ? (
                            <div onClick={(event) => event.stopPropagation()}>
                              <select
                                autoFocus
                                value={editingValue}
                                onChange={(event) => {
                                  void handleCellEdit(
                                    employee.id,
                                    'department',
                                    event.target.value,
                                  );
                                }}
                                onBlur={closeInlineEdit}
                                className="px-2 py-1 rounded border text-xs w-full"
                                style={{ borderColor: '#e2ede9', color: '#203430' }}
                              >
                                <option value="Chưa phân bổ">Chưa phân bổ</option>
                                {departments.map((dept) => (
                                  <option key={dept.code} value={dept.name}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div
                              onClick={
                                !isReadOnly
                                  ? (event) => {
                                      event.stopPropagation();
                                      setEditingCellId(employee.id);
                                      setEditingField('department');
                                      setEditingValue(employee.department);
                                    }
                                  : undefined
                              }
                              className={`px-2 py-1 rounded inline-flex items-center gap-1${!isReadOnly ? ' cursor-pointer hover:bg-gray-100' : ''}`}
                              style={{ background: departmentColor.bg }}
                            >
                              <span
                                className="text-xs font-semibold"
                                style={{ color: departmentColor.color }}
                              >
                                {employee.department}
                              </span>
                              {!isReadOnly && (
                                <Pencil size={10} style={{ color: departmentColor.color }} />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 min-w-[140px]">
                          {!isReadOnly &&
                          editingCellId === employee.id &&
                          editingField === 'role' ? (
                            <div onClick={(event) => event.stopPropagation()}>
                              <select
                                autoFocus
                                value={editingValue}
                                onChange={(event) => {
                                  void handleCellEdit(employee.id, 'role', event.target.value);
                                }}
                                onBlur={closeInlineEdit}
                                className="px-2 py-1 rounded border text-xs w-full"
                                style={{ borderColor: '#e2ede9', color: '#203430' }}
                              >
                                <option value="">Chưa phân bổ</option>
                                {ROLE_OPTIONS.map((role) => (
                                  <option key={role.value} value={role.value}>
                                    {role.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div
                              onClick={
                                !isReadOnly
                                  ? (event) => {
                                      event.stopPropagation();
                                      setEditingCellId(employee.id);
                                      setEditingField('role');
                                      setEditingValue(employee.role);
                                    }
                                  : undefined
                              }
                              className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1${!isReadOnly ? ' cursor-pointer hover:bg-blue-50' : ''}`}
                              style={{ color: '#203430' }}
                            >
                              {getRoleLabel(employee.role)}
                              {!isReadOnly && <Pencil size={10} style={{ color: '#3b82f6' }} />}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 py-3 text-xs whitespace-nowrap tabular-nums"
                          style={{ color: '#6b7f78' }}
                        >
                          {formatDate(employee.preJoinDate)}
                        </td>
                        <td
                          className="px-3 py-3 text-xs whitespace-nowrap tabular-nums"
                          style={{ color: '#6b7f78' }}
                        >
                          {formatDate(employee.companyJoinDate)}
                        </td>
                        <td
                          className="px-3 py-3 text-xs whitespace-nowrap"
                          style={{ color: employee.birthday ? '#db2777' : '#9ca3af' }}
                        >
                          {employee.birthday ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span aria-hidden="true">🎂</span>
                              <span className="tabular-nums">
                                {formatDate(employee.birthday)}
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[employee.status].badge}`}
                          >
                            {STATUS_CONFIG[employee.status].label}
                          </span>
                        </td>
                        {!isReadOnly && (
                          <td className="px-3 py-3">
                            <div
                              className="flex items-center gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setEditingEmployee(employee)}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50"
                                title="Chỉnh sửa nhân viên"
                              >
                                <Pencil size={13} style={{ color: '#f59e0b' }} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteEmployee(employee.id, employee.fullName)
                                }
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"
                                title="Xóa"
                              >
                                <Trash2 size={13} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} style={{ color: '#1DB87A' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#203430' }}>
              Phân bố theo phòng ban
            </h3>
          </div>
          {departmentDistribution.length > 0 ? (
            <div className="space-y-4 pt-2">
              {departmentDistribution.map((department) => {
                const words = department.label.trim().split(' ').filter(Boolean);
                let initials = '';

                if (words.length >= 2) {
                  initials = (words[0][0] + words[1][0]).toUpperCase();
                } else {
                  const upperLetters = department.label.replace(/[^A-Z]/g, '');
                  initials =
                    upperLetters.length >= 2
                      ? upperLetters.slice(0, 2)
                      : department.label.slice(0, 2).toUpperCase();
                }

                return (
                  <div key={department.label} className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs shrink-0"
                          style={{
                            background: `${department.color}15`,
                            color: department.color,
                          }}
                        >
                          {initials}
                        </div>
                        <span className="font-semibold text-sm" style={{ color: '#203430' }}>
                          {department.label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold text-sm" style={{ color: '#203430' }}>
                          {department.count}
                        </span>
                        <span className="text-xs font-medium" style={{ color: '#6b7f78' }}>
                          người
                        </span>
                        <div
                          className="text-xs font-bold px-1.5 py-0.5 rounded-md ml-1 min-w-[44px] text-center"
                          style={{
                            background: `${department.color}10`,
                            color: department.color,
                          }}
                        >
                          {department.pct}%
                        </div>
                      </div>
                    </div>
                    <div className="pl-11 pr-1">
                      <div
                        className="h-2 w-full rounded-full overflow-hidden"
                        style={{ background: '#f0f4f2' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${department.pct}%`,
                            background: department.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#6b7f78' }}>
              Chưa có dữ liệu phòng ban để hiển thị.
            </p>
          )}
        </div>

        <div
          className="bg-white rounded-xl border p-5 flex flex-col"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} style={{ color: '#1DB87A' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#203430' }}>
              Cơ cấu vai trò nhân sự
            </h3>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {roleDistribution.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {roleDistribution.map((role) => (
                  <div
                    key={role.role}
                    className="border rounded-xl p-3 flex flex-col justify-between hover:-translate-y-0.5 transition-transform"
                    style={{ borderColor: '#e2ede9', backgroundColor: '#fafdfa' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: role.iconBg, color: role.color }}
                      >
                        <span className="font-bold text-xs" style={{ color: role.color }}>
                          {role.label.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: '#f0f4f2', color: '#6b7f78' }}
                      >
                        {role.pct}%
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold mb-0.5" style={{ color: '#203430' }}>
                        {role.count}
                      </h4>
                      <p className="text-[11px] font-semibold" style={{ color: '#6b7f78' }}>
                        {role.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#6b7f78' }}>
                Chưa có dữ liệu vai trò.
              </p>
            )}
          </div>
        </div>
      </div>
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Thêm nhân viên</DialogTitle>
            <DialogDescription>
              Tạo hồ sơ nhân viên mới và bổ sung thông tin cơ bản.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex items-center justify-between border-b bg-white px-6 py-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: '#D3F2E7' }}
              >
                <UserPlus size={20} style={{ color: '#1DB87A' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#203430' }}>
                  Thêm nhân viên mới
                </h2>
                <p className="text-xs text-muted-foreground">
                  Điền thông tin cơ bản để tạo hồ sơ nhân sự trong hệ thống
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: '#6b7f78' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[calc(90vh-88px)] overflow-y-auto">
            <EmployeeForm
              mode="create"
              departments={departments}
              managerOptions={managerOptions}
              onSubmit={handleCreateEmployee}
              onClose={() => setIsAddModalOpen(false)}
              isSubmitting={isMutating}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingEmployee)}
        onOpenChange={(open) => !open && setEditingEmployee(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Chỉnh sửa nhân viên</DialogTitle>
            <DialogDescription>
              Cập nhật toàn bộ thông tin hồ sơ và tài khoản nhân viên.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex items-center justify-between border-b bg-white px-6 py-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: '#fff7ed' }}
              >
                <Pencil size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: '#203430' }}>
                  Chỉnh sửa nhân viên
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cập nhật hồ sơ, trạng thái làm việc và có thể đặt mật khẩu mới
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditingEmployee(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: '#6b7f78' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[calc(90vh-88px)] overflow-y-auto">
            {editingEmployee ? (
              <EmployeeForm
                mode="edit"
                departments={departments}
                managerOptions={managerOptions}
                initialData={editingEmployee}
                onSubmit={(formData) => handleUpdateEmployee(editingEmployee.id, formData)}
                onClose={() => setEditingEmployee(null)}
                isSubmitting={isMutating}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeForm({
  mode,
  departments,
  managerOptions,
  initialData,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  mode: 'create' | 'edit';
  departments: DepartmentItem[];
  managerOptions: UserDropdownItem[];
  initialData?: EmployeeRow;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<EmployeeFormData>(() =>
    initialData
      ? {
          fullName: initialData.fullName,
          email: initialData.email,
          username: initialData.username,
          employeeCode: initialData.employeeCode,
          password: '',
          role: initialData.role,
          department: initialData.department === 'Chưa phân bổ' ? '' : initialData.department,
          position: initialData.position,
          managerId: initialData.managerId,
          isCountable: initialData.isCountable,
          isAttendance: initialData.isAttendance,
          preJoinDate: initialData.preJoinDate?.slice(0, 10) ?? '',
          companyJoinDate: initialData.companyJoinDate?.slice(0, 10) ?? '',
          birthday: initialData.birthday?.slice(0, 10) ?? '',
          status: initialData.status,
          gender: initialData.gender ?? '',
          phone: initialData.phone ?? '',
        }
      : getDefaultEmployeeFormData(departments),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  useEffect(() => {
    setFormData(
      initialData
        ? {
            fullName: initialData.fullName,
            email: initialData.email,
            username: initialData.username,
            employeeCode: initialData.employeeCode,
            password: '',
            role: initialData.role,
            department: initialData.department === 'Chưa phân bổ' ? '' : initialData.department,
            position: initialData.position,
            managerId: initialData.managerId,
            isCountable: initialData.isCountable,
            isAttendance: initialData.isAttendance,
            preJoinDate: initialData.preJoinDate?.slice(0, 10) ?? '',
            companyJoinDate: initialData.companyJoinDate?.slice(0, 10) ?? '',
            birthday: initialData.birthday?.slice(0, 10) ?? '',
            status: initialData.status,
            gender: initialData.gender ?? '',
            phone: initialData.phone ?? '',
          }
        : getDefaultEmployeeFormData(departments),
    );
    setErrors({});
    setSubmitError('');
  }, [departments, initialData]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === 'email') {
        const generatedFromPreviousEmail = buildUsernameFromEmail(prev.email);
        const nextGeneratedUsername = buildUsernameFromEmail(value);
        const shouldSyncUsername = !prev.username || prev.username === generatedFromPreviousEmail;

        return {
          ...prev,
          email: value,
          ...(shouldSyncUsername ? { username: nextGeneratedUsername } : {}),
        };
      }

      return { ...prev, [name]: value };
    });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (submitError) setSubmitError('');
  };

  const handleFieldChange = (name: keyof EmployeeFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value as EmployeeFormData[keyof EmployeeFormData],
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (submitError) setSubmitError('');
  };

  const handleBooleanChange = (name: 'isCountable' | 'isAttendance', value: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (submitError) setSubmitError('');
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) nextErrors.fullName = 'Họ và tên là bắt buộc';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      nextErrors.email = 'Email không hợp lệ';
    if (!formData.username.trim()) nextErrors.username = 'Username là bắt buộc';
    if (formData.username.trim().length < 3) nextErrors.username = 'Username phải ít nhất 3 ký tự';
    if (mode === 'create' && !formData.password) nextErrors.password = 'Mật khẩu là bắt buộc';
    if (formData.password && formData.password.length < 6) {
      nextErrors.password = 'Mật khẩu phải ít nhất 6 ký tự';
    }
    if (initialData && formData.managerId === initialData.id) {
      nextErrors.managerId = 'Nhân viên không thể tự làm quản lý trực tiếp';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      await onSubmit({
        ...formData,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        username: formData.username.trim(),
        employeeCode: formData.employeeCode.trim(),
        position: formData.position.trim(),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : mode === 'create'
            ? 'Không thể tạo nhân viên mới.'
            : 'Không thể cập nhật nhân viên.',
      );
    }
  };

  const accountSummary = [
    {
      label: mode === 'create' ? 'Trạng thái khi tạo' : 'Trạng thái hiện tại',
      value: formData.status === 'active' ? 'Đang làm việc' : 'Tạm nghỉ',
    },
    { label: 'Vai trò hệ thống', value: getRoleLabel(formData.role) },
    { label: 'Đăng nhập', value: formData.username.trim() || 'Username + email' },
    {
      label: 'Bảo mật',
      value:
        mode === 'create'
          ? 'Mật khẩu tối thiểu 6 ký tự'
          : formData.password
            ? 'Sẽ cập nhật mật khẩu mới'
            : 'Giữ nguyên mật khẩu hiện tại',
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div
        className="rounded-xl border px-4 py-4"
        style={{ background: '#f0f9f5', borderColor: '#D3F2E7' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Shield size={15} style={{ color: '#1DB87A' }} />
          <span className="text-sm font-semibold" style={{ color: '#0E474E' }}>
            {mode === 'create' ? 'Thông tin tạo tài khoản' : 'Thông tin cập nhật tài khoản'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {accountSummary.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-sm font-bold" style={{ color: '#1DB87A' }}>
                {item.value}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users size={14} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Thông tin cá nhân
            </h3>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Họ và tên
            </label>
            <Input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Ví dụ: Phạm Long Đĩnh"
              className={errors.fullName ? 'border-red-500' : undefined}
            />
            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Shield size={14} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Thông tin tài khoản
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Email
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@company.com"
                className={errors.email ? 'border-red-500' : undefined}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Ví dụ: pham.long"
                className={errors.username ? 'border-red-500' : undefined}
              />
              {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Mã nhân viên
              </label>
              <Input
                type="text"
                name="employeeCode"
                value={formData.employeeCode}
                onChange={handleChange}
                placeholder="Ví dụ: 00025"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Có thể để trống khi tạo, nhưng cần cập nhật trước khi import attendance.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                {mode === 'create' ? 'Mật khẩu' : 'Mật khẩu mới'}
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={
                  mode === 'create' ? 'Tối thiểu 6 ký tự' : 'Để trống nếu không đổi mật khẩu'
                }
                className={errors.password ? 'border-red-500' : undefined}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              {mode === 'edit' ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Chỉ nhập khi cần đặt lại mật khẩu cho nhân viên.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={14} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Thông tin tổ chức
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Vai trò
              </label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleFieldChange('role', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Phòng ban
              </label>
              <Select
                value={formData.department || 'no-department'}
                onValueChange={(value) =>
                  handleFieldChange('department', value === 'no-department' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-department">Chưa phân bổ</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.code} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Chức danh
              </label>
              <Input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="Ví dụ: Senior Developer"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Quản lý trực tiếp
              </label>
              <Select
                value={formData.managerId || 'no-manager'}
                onValueChange={(value) =>
                  handleFieldChange('managerId', value === 'no-manager' ? '' : value)
                }
              >
                <SelectTrigger className={errors.managerId ? 'border-red-500' : undefined}>
                  <SelectValue placeholder="Chọn quản lý" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-manager">Không gán quản lý</SelectItem>
                  {managerOptions
                    .filter((manager) => String(manager.id) !== initialData?.id)
                    .map((manager) => {
                      const managerId = String(manager.id);
                      const managerLabel =
                        manager.fullName?.trim() ||
                        manager.username?.trim() ||
                        manager.employeeCode?.trim() ||
                        `User #${managerId}`;

                      return (
                        <SelectItem key={managerId} value={managerId}>
                          {manager.employeeCode
                            ? `${managerLabel} (${manager.employeeCode})`
                            : managerLabel}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              {errors.managerId && <p className="mt-1 text-xs text-red-500">{errors.managerId}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Ngày gia nhập
              </label>
              <DatePicker
                value={formData.preJoinDate}
                onChange={(value) => handleFieldChange('preJoinDate', value)}
                captionLayout="dropdown"
                fromYear={1970}
                toYear={new Date().getFullYear()}
              />
              <button
                type="button"
                onClick={() => handleFieldChange('preJoinDate', '')}
                className="mt-2 text-xs font-medium"
                style={{ color: '#6b7f78' }}
              >
                Xóa ngày gia nhập
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Ngày chính thức
              </label>
              <DatePicker
                value={formData.companyJoinDate}
                onChange={(value) => handleFieldChange('companyJoinDate', value)}
                captionLayout="dropdown"
                fromYear={1970}
                toYear={new Date().getFullYear()}
              />
              <button
                type="button"
                onClick={() => handleFieldChange('companyJoinDate', '')}
                className="mt-2 text-xs font-medium"
                style={{ color: '#6b7f78' }}
              >
                Xóa ngày chính thức
              </button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Ngày sinh 🎂
              </label>
              <DatePicker
                value={formData.birthday}
                onChange={(value) => handleFieldChange('birthday', value)}
                captionLayout="dropdown"
                fromYear={1970}
                toYear={new Date().getFullYear()}
              />
              {formData.birthday && (
                <button
                  type="button"
                  onClick={() => handleFieldChange('birthday', '')}
                  className="mt-2 text-xs font-medium"
                  style={{ color: '#6b7f78' }}
                >
                  Xóa ngày sinh
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Trạng thái
              </label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleFieldChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Đang làm việc</SelectItem>
                  <SelectItem value="inactive">Tạm nghỉ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Giới tính
              </label>
              <Select
                value={formData.gender || 'no-gender'}
                onValueChange={(value) =>
                  handleFieldChange('gender', value === 'no-gender' ? '' : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-gender">Không xác định</SelectItem>
                  <SelectItem value="male">Nam</SelectItem>
                  <SelectItem value="female">Nữ</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Số điện thoại
              </label>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ví dụ: 0912345678"
              />
            </div>
            <div className="sm:col-span-2">
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: '#e2ede9', background: '#f8faf9' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                    Tính vào nhân sự chính thức
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tắt nếu tài khoản là bot hoặc không cần tính vào thống kê nhân sự, nghỉ phép.
                  </p>
                </div>
                <Checkbox
                  checked={formData.isCountable}
                  onCheckedChange={(checked) =>
                    handleBooleanChange('isCountable', checked === true)
                  }
                  aria-label="Tính vào nhân sự chính thức"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: '#e2ede9', background: '#f8faf9' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                    Hiển thị & tính toán trên bảng Chấm công
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tắt nếu nhân viên không cần hiển thị hoặc tính toán trên bảng chấm công.
                  </p>
                </div>
                <Checkbox
                  checked={formData.isAttendance}
                  onCheckedChange={(checked) =>
                    handleBooleanChange('isAttendance', checked === true)
                  }
                  aria-label="Hiển thị trên bảng chấm công"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t pt-4" style={{ borderColor: '#e2ede9' }}>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onClose}
          style={{ color: '#203430' }}
        >
          Hủy
        </Button>
        <Button
          type="submit"
          className="flex-1 text-white disabled:opacity-70"
          style={{ background: '#1DB87A' }}
          disabled={isSubmitting}
        >
          {mode === 'create' ? <UserPlus size={15} /> : <Pencil size={15} />}
          {isSubmitting
            ? mode === 'create'
              ? 'Đang tạo...'
              : 'Đang cập nhật...'
            : mode === 'create'
              ? 'Thêm nhân viên'
              : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
