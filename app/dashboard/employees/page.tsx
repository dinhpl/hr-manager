'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Building2,
  Cake,
  CalendarOff,
  Clock,
  Eye,
  FileDown,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Table2,
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
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { buildQuery, formatDateVN, getFullName, getRoleLabel, toIsoDateTime } from '@/lib/hr-utils';

type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN';
type EmployeeStatus = 'active' | 'inactive';

interface EmployeeApiItem {
  id: string | number;
  email: string;
  username?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: UserRole | null;
  department?: string | null;
  position?: string | null;
  avatar?: string | null;
  teamId?: number | null;
  isCountable?: boolean;
  companyJoinDate?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface EmployeeRow {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  role: UserRole;
  department: string;
  status: EmployeeStatus;
  companyJoinDate: string | null;
}

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  companyJoinDate: string;
  status: EmployeeStatus;
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
    label: 'Tạm nghỉ',
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

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (!normalized) return { firstName: '', lastName: '' };

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
}

function mapEmployee(item: EmployeeApiItem): EmployeeRow {
  const fullName = getFullName({
    fullName: item.fullName,
    firstName: item.firstName,
    lastName: item.lastName,
    username: item.username,
  });
  const { firstName, lastName } = splitFullName(
    [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || fullName,
  );

  return {
    id: String(item.id),
    email: item.email,
    fullName,
    firstName,
    lastName,
    profileImageUrl: item.avatar ?? null,
    role: item.role ?? 'EMPLOYEE',
    department: item.department?.trim() || 'Chưa phân bổ',
    status: item.isActive ? 'active' : 'inactive',
    companyJoinDate: item.companyJoinDate ?? null,
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'role' | 'department' | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

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
  }, [fetchDepartments]);

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
    field: 'role' | 'department',
    value: string,
  ) => {
    if (!value) return;

    setIsMutating(true);
    try {
      await apiClient.patch(
        `/api/users/${employeeId}`,
        field === 'role' ? { role: value } : { department: value },
      );
      closeInlineEdit();
      toast.success(field === 'role' ? 'Đã cập nhật vai trò.' : 'Đã cập nhật phòng ban.');
      await Promise.all([fetchEmployees(), fetchDepartments()]);
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
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const created = await apiClient.post<EmployeeApiItem>('/api/users', {
        email: formData.email.trim(),
        username: buildUsernameFromEmail(formData.email),
        password: formData.password,
        fullName,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: formData.role,
        department: formData.department || undefined,
        position: getRoleLabel(formData.role),
        companyJoinDate: formData.companyJoinDate
          ? toIsoDateTime(formData.companyJoinDate)
          : undefined,
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
      await fetchEmployees();
    } catch (error) {
      scrollToTop();
      toast.error(error instanceof Error ? error.message : 'Không thể xóa nhân viên.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleRecalculateLeave = async () => {
    if (
      !window.confirm(
        `Tính toán lại phép năm ${new Date().getFullYear()} cho tất cả nhân viên?\n` +
          'Số ngày đã dùng (used_days) sẽ được giữ nguyên.',
      )
    ) {
      return;
    }

    setIsRecalculating(true);
    try {
      const result = await apiClient.post<{
        year: number;
        usersProcessed: number;
        leaveTypesProcessed: number;
      }>('/api/leave-balances/recalculate', { year: new Date().getFullYear() });
      toast.success(
        `Đã tính toán lại phép năm ${result.data.year} cho ${result.data.usersProcessed} nhân viên.`,
      );
    } catch (error) {
      scrollToTop();
      toast.error(error instanceof Error ? error.message : 'Không thể tính toán lại phép năm.');
    } finally {
      setIsRecalculating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: '#1DB87A' }}
            disabled={isMutating}
          >
            <UserPlus size={14} /> Thêm nhân viên
          </button>
          <button
            type="button"
            onClick={() => void handleRecalculateLeave()}
            disabled={isRecalculating || isMutating}
            title="Tính toán lại tổng ngày phép năm cho tất cả nhân viên dựa theo ngày vào công ty"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderColor: '#1DB87A', color: '#1DB87A', background: '#f0fdf9' }}
          >
            <RefreshCw size={14} className={isRecalculating ? 'animate-spin' : ''} />
            {isRecalculating ? 'Đang tính...' : 'Tính toán lại phép năm'}
          </button>
          <button
            type="button"
            disabled
            title="Backend chưa hỗ trợ import Excel"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold opacity-50"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <Upload size={14} /> Import Excel
          </button>
          <button
            type="button"
            disabled
            title="Backend chưa hỗ trợ export nhân viên"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold opacity-50"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <FileDown size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            value: '—',
            icon: Cake,
            color: '#06b6d4',
            bg: '#ecfeff',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-4 border flex items-center gap-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: stat.bg }}
            >
              <stat.icon size={22} style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#203430' }}>
                {stat.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#6b7f78' }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Trạng thái
            </label>
            <Select
              value={statusFilter || 'all-status'}
              onValueChange={(value) => setStatusFilter(value === 'all-status' ? '' : value)}
            >
              <SelectTrigger className="min-w-[150px]">
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
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Phòng ban
            </label>
            <Select
              value={teamFilter || 'all-team'}
              onValueChange={(value) => setTeamFilter(value === 'all-team' ? '' : value)}
            >
              <SelectTrigger className="min-w-[150px]">
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
          <div className="flex gap-2 items-end flex-1 min-w-[220px]">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7f78' }}>
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
                placeholder="Tìm theo tên, email..."
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="flex items-center h-[36px] gap-1.5 px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: '#1DB87A' }}
            >
              <Search size={14} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: '#e2ede9' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="flex items-center gap-2">
            <Table2 size={15} style={{ color: '#1DB87A' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#203430' }}>
              Danh sách nhân viên ({employees.length})
            </h2>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => void fetchEmployees()}
              className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: '#e2ede9' }}
              disabled={isRefreshing || isMutating}
              title="Tải lại danh sách"
            >
              <RefreshCw
                size={13}
                style={{
                  color: '#6b7f78',
                  transform: isRefreshing ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s ease',
                }}
              />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#203430' }}>
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={selectedIds.length === employees.length && employees.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả nhân viên"
                  />
                </th>
                {[
                  'Avatar',
                  'Họ tên',
                  'Email',
                  'Phòng ban',
                  'Vai trò',
                  'Ngày tham gia',
                  'Trạng thái',
                  'Thao tác',
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
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Đang tải dữ liệu nhân viên...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Không có nhân viên phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const isSelected = selectedIds.includes(employee.id);
                  const initials =
                    `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`
                      .trim()
                      .toUpperCase() || employee.fullName.slice(0, 2).toUpperCase();
                  const deptIndex = departments.findIndex((d) => d.name === employee.department);
                  const departmentColor = getDeptColor(
                    employee.department,
                    deptIndex >= 0 ? deptIndex : 0,
                  );

                  return (
                    <tr
                      key={employee.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-all cursor-pointer"
                      style={{
                        background: isSelected ? '#f0fdf9' : undefined,
                        opacity: employee.status === 'inactive' ? 0.75 : 1,
                      }}
                      onClick={() => toggleSelect(employee.id)}
                    >
                      <td className="px-3 py-3 w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(employee.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Chọn nhân viên ${employee.fullName}`}
                        />
                      </td>
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
                        <p className="font-semibold whitespace-nowrap" style={{ color: '#203430' }}>
                          {employee.fullName}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: '#6b7f78' }}>
                        {employee.email}
                      </td>
                      <td className="px-3 py-3 min-w-[160px]">
                        {editingCellId === employee.id && editingField === 'department' ? (
                          <div onClick={(event) => event.stopPropagation()}>
                            <select
                              autoFocus
                              value={editingValue}
                              onChange={(event) => {
                                void handleCellEdit(employee.id, 'department', event.target.value);
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
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingCellId(employee.id);
                              setEditingField('department');
                              setEditingValue(employee.department);
                            }}
                            className="px-2 py-1 rounded cursor-pointer hover:bg-gray-100 inline-flex items-center gap-1"
                            style={{ background: departmentColor.bg }}
                          >
                            <span
                              className="text-xs font-semibold"
                              style={{ color: departmentColor.color }}
                            >
                              {employee.department}
                            </span>
                            <Pencil size={10} style={{ color: departmentColor.color }} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 min-w-[140px]">
                        {editingCellId === employee.id && editingField === 'role' ? (
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
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingCellId(employee.id);
                              setEditingField('role');
                              setEditingValue(employee.role);
                            }}
                            className="px-2 py-1 rounded cursor-pointer hover:bg-blue-50 text-xs inline-flex items-center gap-1"
                            style={{ color: '#203430' }}
                          >
                            {getRoleLabel(employee.role)}
                            <Pencil size={10} style={{ color: '#3b82f6' }} />
                          </div>
                        )}
                      </td>
                      <td
                        className="px-3 py-3 text-xs whitespace-nowrap"
                        style={{ color: '#6b7f78' }}
                      >
                        {formatDateVN(employee.companyJoinDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[employee.status].badge}`}
                        >
                          {STATUS_CONFIG[employee.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className="flex items-center gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled
                            title="Chỉnh sửa hiện hỗ trợ inline ở phòng ban và vai trò"
                            className="w-6 h-6 rounded flex items-center justify-center cursor-not-allowed opacity-40"
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} style={{ color: '#1DB87A' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#203430' }}>
              Phân bố theo phòng ban
            </h3>
          </div>
          {departmentDistribution.length > 0 ? (
            <div className="space-y-3">
              {departmentDistribution.map((department) => (
                <div key={department.label} className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold text-white px-2 py-0.5 rounded w-20 text-center shrink-0"
                    style={{ background: department.color }}
                  >
                    {department.code}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: '#203430' }}>{department.label}</span>
                      <span className="font-semibold" style={{ color: '#6b7f78' }}>
                        {department.count} người ({department.pct}%)
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: '#f0f4f2' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${department.pct}%`,
                          background: department.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#6b7f78' }}>
              Chưa có dữ liệu phòng ban để hiển thị.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} style={{ color: '#1DB87A' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#203430' }}>
              Hoạt động gần đây
            </h3>
          </div>
          <div
            className="rounded-xl border border-dashed p-4 text-sm"
            style={{ borderColor: '#d6e5df', color: '#6b7f78' }}
          >
            Backend hiện chưa có feed hoạt động cho trang này, nên khu vực này đang được giữ ở trạng
            thái an toàn.
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
            <AddEmployeeForm
              departments={departments}
              onSubmit={handleCreateEmployee}
              onClose={() => setIsAddModalOpen(false)}
              isSubmitting={isMutating}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddEmployeeForm({
  departments,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  departments: DepartmentItem[];
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    department: departments[0]?.name ?? '',
    companyJoinDate: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      department: prev.department || departments[0]?.name || '',
    }));
  }, [departments]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) nextErrors.firstName = 'Họ là bắt buộc';
    if (!formData.lastName.trim()) nextErrors.lastName = 'Tên là bắt buộc';
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      nextErrors.email = 'Email không hợp lệ';
    if (!formData.password) nextErrors.password = 'Mật khẩu là bắt buộc';
    if (formData.password.length < 6) nextErrors.password = 'Mật khẩu phải ít nhất 6 ký tự';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      await onSubmit({
        ...formData,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể tạo nhân viên mới.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div
        className="rounded-xl border px-4 py-4"
        style={{ background: '#f0f9f5', borderColor: '#D3F2E7' }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Shield size={15} style={{ color: '#1DB87A' }} />
          <span className="text-sm font-semibold" style={{ color: '#0E474E' }}>
            Thông tin tạo tài khoản
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: 'Trạng thái khi tạo',
              value: formData.status === 'active' ? 'Đang làm việc' : 'Tạm nghỉ',
            },
            { label: 'Vai trò hệ thống', value: getRoleLabel(formData.role) },
            { label: 'Đăng nhập', value: 'Email công ty' },
            { label: 'Bảo mật', value: 'Mật khẩu tối thiểu 6 ký tự' },
          ].map((item) => (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Họ
              </label>
              <Input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Ví dụ: Phạm"
                className={errors.firstName ? 'border-red-500' : undefined}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
                Tên
              </label>
              <Input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Ví dụ: Long Đĩnh"
                className={errors.lastName ? 'border-red-500' : undefined}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
            </div>
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
                Mật khẩu
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Tối thiểu 6 ký tự"
                className={errors.password ? 'border-red-500' : undefined}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
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
                value={formData.department}
                onValueChange={(value) => handleFieldChange('department', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
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
                Ngày tham gia công ty
              </label>
              <DatePicker
                value={formData.companyJoinDate}
                onChange={(value) => handleFieldChange('companyJoinDate', value)}
              />
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
          <UserPlus size={15} />
          {isSubmitting ? 'Đang tạo...' : 'Thêm nhân viên'}
        </Button>
      </div>
    </form>
  );
}
