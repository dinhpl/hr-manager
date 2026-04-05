'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { CalendarDays, Eye, FileDown, FileText, History, Pencil, Save, Upload, X } from 'lucide-react';
import { TiptapNotionEditor } from '@/components/tiptap-notion-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { api, apiClient, getStoredToken } from '@/lib/api-client';
import { buildQuery, formatDate, formatDateTimeVN, toFrontendRole } from '@/lib/hr-utils';
import type { FrontendRole } from '@/lib/hr-utils';

interface LeaveBalanceApiRow {
  id: string;
  userId: string;
  year: number;
  annualDays: number | string;
  carryOverDays: number | string;
  seniorityDays: number | string;
  compOffDays: number | string;
  wfhDays: number | string;
  usedDays: number | string;
  usedCarryOverDays: number | string;
  usedCompOffDays: number | string;
  note?: string | null;
  user: {
    id: string;
    fullName: string;
    employeeCode?: string | null;
    department?: string | null;
    isActive?: boolean | null;
    companyJoinDate?: string | null;
  };
  leaveType: {
    code: string;
    name: string;
    color: string;
  };
}

interface CurrentUserInfo {
  id?: string | null;
  role?: string | null;
  systemRole?: string | null;
}

interface LeaveBalanceHistoryItem {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  totalDays: number | string;
  reason?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  leaveType?: {
    code?: string | null;
    name?: string | null;
    color?: string | null;
  } | null;
  approver?: {
    fullName?: string | null;
  } | null;
  user?: {
    id?: string | null;
    fullName?: string | null;
  } | null;
}

function getBalanceFormSections(balanceYear: number) {
  return [
    {
      title: 'Quỹ phép',
      description: 'Các ngày được cấp hoặc cộng dồn.',
      fields: [
        {
          key: 'annualDays',
          label: `Phép năm ${balanceYear} được hưởng`,
          hint: 'annualDays',
        },
        {
          key: 'carryOverDays',
          label: `Phép năm ${balanceYear - 1} chuyển sang`,
          hint: 'carryOverDays',
        },
        { key: 'seniorityDays', label: 'Thâm niên', hint: 'seniorityDays' },
        { key: 'compOffDays', label: 'Số ngày được nghỉ bù do OT', hint: 'compOffDays' },
        { key: 'wfhDays', label: 'WFH', hint: 'wfhDays' },
      ],
    },
    {
      title: 'Đã sử dụng',
      description: 'Theo dõi phần đã trừ khỏi quỹ phép.',
      fields: [
        {
          key: 'usedCarryOverDays',
          label: `Số phép năm ${balanceYear - 1} đã nghỉ đến 31/03/${balanceYear}`,
          hint: 'usedCarryOverDays',
        },
        {
          key: 'usedDays',
          label: `Số phép năm ${balanceYear} đã sử dụng`,
          hint: 'usedDays',
        },
        {
          key: 'usedCompOffDays',
          label: 'Số ngày nghỉ bù đã dùng',
          hint: 'usedCompOffDays',
        },
      ],
    },
  ] as const;
}

function sanitizeBalanceInput(value: string) {
  const normalized = value
    .replace(/,/g, '.')
    .replace(/(?!^)-/g, '')
    .replace(/[^\d.-]/g, '');
  const [integerPart = '', ...decimalParts] = normalized.split('.');
  const hasNegativeSign = integerPart.startsWith('-');
  const safeIntegerPart = hasNegativeSign
    ? integerPart.slice(1).replace(/-/g, '')
    : integerPart.replace(/-/g, '');
  const signedIntegerPart = hasNegativeSign ? `-${safeIntegerPart}` : safeIntegerPart;

  if (decimalParts.length === 0) {
    return signedIntegerPart;
  }

  return `${signedIntegerPart}.${decimalParts.join('')}`;
}

function roundBalanceDisplay(value: number) {
  return Math.round(value * 10) / 10;
}

function getMonthsNotWorkedInYear() {
  const currentMonth = new Date().getMonth() + 1;
  return Math.max(12 - currentMonth, 0);
}

function getStatusBadge(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'APPROVED':
      return {
        label: 'Đã duyệt',
        className: 'border border-emerald-200 bg-emerald-50 text-emerald-600',
      };
    case 'REJECTED':
      return {
        label: 'Từ chối',
        className: 'border border-red-200 bg-red-50 text-red-500',
      };
    case 'CANCELLED':
      return {
        label: 'Đã hủy',
        className: 'border border-slate-200 bg-slate-100 text-slate-500',
      };
    default:
      return {
        label: 'Chờ duyệt',
        className: 'border border-amber-200 bg-amber-50 text-amber-600',
      };
  }
}

function getHistoryReason(reason?: string | null) {
  if (!reason) return '—';
  const firstLine = reason
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || '—';
}

export default function LeaveBalancesPage() {
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceApiRow[]>([]);
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalanceApiRow | null>(null);
  const [balanceForm, setBalanceForm] = useState({
    annualDays: '',
    carryOverDays: '',
    seniorityDays: '',
    compOffDays: '',
    wfhDays: '',
    usedCarryOverDays: '',
    usedDays: '',
    usedCompOffDays: '',
  });
  const [noteBalance, setNoteBalance] = useState<LeaveBalanceApiRow | null>(null);
  const [noteEditorValue, setNoteEditorValue] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [resetCarryOverDate, setResetCarryOverDate] = useState<string>('03-31');
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [isImportingBalances, setIsImportingBalances] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);
  const [historyBalance, setHistoryBalance] = useState<LeaveBalanceApiRow | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<LeaveBalanceHistoryItem[]>([]);
  const [isLoadingBalanceHistory, setIsLoadingBalanceHistory] = useState(false);
  const [balanceHistoryError, setBalanceHistoryError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [nameKeyword, setNameKeyword] = useState('');

  const currentRole: FrontendRole | null = currentUser ? toFrontendRole(currentUser.role) : null;
  const canManageLeaveBalances =
    currentRole === 'hr' ||
    currentRole === 'admin' ||
    currentUser?.systemRole?.toUpperCase() === 'ADMIN';

  const canEditNote =
    currentRole === 'hr' ||
    currentRole === 'admin' ||
    currentUser?.systemRole?.toUpperCase() === 'ADMIN';

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        leaveBalances
          .map((row) => row.user.department?.trim())
          .filter((department): department is string => Boolean(department)),
      ),
    ).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [leaveBalances]);

  const filteredLeaveBalances = useMemo(() => {
    const normalizedKeyword = nameKeyword.trim().toLowerCase();

    return leaveBalances.filter((row) => {
      const matchesDepartment =
        departmentFilter === 'all' || (row.user.department ?? '') === departmentFilter;
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        row.user.fullName.toLowerCase().includes(normalizedKeyword);

      return matchesDepartment && matchesKeyword;
    });
  }, [departmentFilter, leaveBalances, nameKeyword]);

  useEffect(() => {
    let isMounted = true;

    apiClient
      .get<CurrentUserInfo>('/api/auth/me')
      .then(({ data }) => {
        if (!isMounted) return;
        setCurrentUser(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setCurrentUser(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingCurrentUser(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchLeaveBalances = useCallback(async (year: number) => {
    setIsLoadingBalances(true);
    try {
      const { data } = await apiClient.get<LeaveBalanceApiRow[]>(
        `/api/leave-balances/all?year=${year}`,
      );
      setLeaveBalances(data ?? []);
    } catch {
      toast.error('Không thể tải dữ liệu phép năm.');
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeaveBalances(balanceYear);
    apiClient
      .get<{ resetCarryOverDate?: string }>('/api/settings/leave-policy')
      .then(({ data }) => {
        if (data?.resetCarryOverDate) setResetCarryOverDate(data.resetCarryOverDate);
      })
      .catch(() => {});
  }, [balanceYear, fetchLeaveBalances]);

  const handleExportBalances = async () => {
    if (!canManageLeaveBalances) return;
    try {
      const token = getStoredToken();
      const response = await api.get(`/api/leave-balances/export?year=${balanceYear}`, {
        responseType: 'arraybuffer',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = new Blob([response.data as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leave_balances_${balanceYear}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất dữ liệu phép năm.');
    } catch {
      toast.error('Không thể xuất dữ liệu phép năm.');
    }
  };

  const handleImportBalances = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canManageLeaveBalances) return;
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setIsImportingBalances(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiClient.post<{
        updated: number;
        errors: { row: number; message: string }[];
      }>('/api/leave-balances/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { updated, errors } = result.data;
      if (errors.length > 0) {
        toast.warning(`Import xong: ${updated} cập nhật, ${errors.length} lỗi.`);
        console.warn('Import balance errors:', errors);
      } else {
        toast.success(`Import thành công: ${updated} bản ghi đã cập nhật.`);
      }
      void fetchLeaveBalances(balanceYear);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể import file.');
    } finally {
      setIsImportingBalances(false);
    }
  };

  const openInfoDialog = (row: LeaveBalanceApiRow) => {
    setEditingBalance(row);
    setBalanceForm({
      annualDays: String(row.annualDays),
      carryOverDays: String(row.carryOverDays),
      seniorityDays: String(row.seniorityDays),
      compOffDays: String(row.compOffDays),
      wfhDays: String(row.wfhDays),
      usedCarryOverDays: String(row.usedCarryOverDays ?? 0),
      usedDays: String(row.usedDays ?? 0),
      usedCompOffDays: String(row.usedCompOffDays ?? 0),
    });
  };

  const openHistoryDialog = (row: LeaveBalanceApiRow) => {
    setHistoryBalance(row);
    setBalanceHistory([]);
    setBalanceHistoryError(null);
  };

  const openNoteDialog = (row: LeaveBalanceApiRow) => {
    setNoteBalance(row);
    setNoteEditorValue(row.note ?? '');
  };

  const handleSaveNote = async () => {
    if (!noteBalance || !canEditNote) return;
    setIsSavingNote(true);
    try {
      await apiClient.patch(`/api/leave-balances/${noteBalance.id}`, {
        note: noteEditorValue || null,
      });
      setLeaveBalances((prev) =>
        prev.map((b) =>
          b.id === noteBalance.id ? { ...b, note: noteEditorValue || null } : b,
        ),
      );
      setNoteBalance(null);
      toast.success('Đã lưu ghi chú.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú.');
    } finally {
      setIsSavingNote(false);
    }
  };

  useEffect(() => {
    if (!historyBalance) {
      setBalanceHistory([]);
      setBalanceHistoryError(null);
      setIsLoadingBalanceHistory(false);
      return;
    }

    const query = buildQuery({
      scope: 'global',
      userId: historyBalance.userId,
      fromDate: `${historyBalance.year}-01-01 00:00`,
      toDate: `${historyBalance.year}-12-31 23:59`,
      limit: 100,
      page: 1,
    });

    setIsLoadingBalanceHistory(true);
    setBalanceHistoryError(null);

    apiClient
      .get<LeaveBalanceHistoryItem[]>(`/api/leave-requests?${query}`)
      .then((response) => {
        const rows = (response.data ?? []).filter(
          (item) =>
            String(item.user?.id ?? '') === String(historyBalance.userId) &&
            !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()),
        );
        setBalanceHistory(rows);
      })
      .catch((error) => {
        setBalanceHistory([]);
        setBalanceHistoryError(
          error instanceof Error ? error.message : 'Không thể tải lịch sử nghỉ phép.',
        );
      })
      .finally(() => {
        setIsLoadingBalanceHistory(false);
      });
  }, [historyBalance]);

  const handleSaveBalance = async () => {
    if (!editingBalance || !canManageLeaveBalances) return;
    setIsSavingBalance(true);
    try {
      await apiClient.patch(`/api/leave-balances/${editingBalance.id}`, {
        annualDays: parseFloat(balanceForm.annualDays) || 0,
        carryOverDays: parseFloat(balanceForm.carryOverDays) || 0,
        seniorityDays: parseFloat(balanceForm.seniorityDays) || 0,
        compOffDays: parseFloat(balanceForm.compOffDays) || 0,
        wfhDays: parseFloat(balanceForm.wfhDays) || 0,
        usedCarryOverDays: parseFloat(balanceForm.usedCarryOverDays) || 0,
        usedDays: parseFloat(balanceForm.usedDays) || 0,
        usedCompOffDays: parseFloat(balanceForm.usedCompOffDays) || 0,
      });
      setEditingBalance(null);
      toast.success('Đã cập nhật số ngày phép.');
      void fetchLeaveBalances(balanceYear);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật phép năm.');
    } finally {
      setIsSavingBalance(false);
    }
  };

  if (isLoadingCurrentUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: '#6b7f78' }}>
          Đang tải...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: '#D3F2E7' }}
          >
            <CalendarDays size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Quản lý phép năm
          </h1>
        </div>
        {canManageLeaveBalances && (
          <div className="flex gap-2 flex-wrap">
            <label
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: '#e2ede9', color: '#203430' }}
              title="Import phép năm từ file Excel (chỉ cập nhật các trường số)"
            >
              <Upload size={14} />
              {isImportingBalances ? 'Đang import...' : 'Import Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isImportingBalances}
                onChange={(e) => void handleImportBalances(e)}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleExportBalances()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: '#e2ede9', color: '#203430' }}
              title="Xuất dữ liệu phép năm ra Excel"
            >
              <FileDown size={14} /> Export
            </button>
          </div>
        )}
      </div>

      {/* Year selector */}
      <div
        className="bg-white rounded-xl justify-between border p-4 flex flex-wrap items-center gap-4"
        style={{ borderColor: '#e2ede9' }}
      >
        <div className="flex flex-1 flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Năm
            </label>
            <Select value={String(balanceYear)} onValueChange={(v) => setBalanceYear(Number(v))}>
              <SelectTrigger className="min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Phòng ban
            </label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="Tất cả phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phòng ban</SelectItem>
                {departmentOptions.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Tìm theo tên
            </label>
            <Input
              value={nameKeyword}
              onChange={(event) => setNameKeyword(event.target.value)}
              placeholder="Nhập tên nhân viên..."
              className="max-w-sm"
            />
          </div>
        </div>
        <p className="text-xs" style={{ color: '#6b7f78' }}>
          {filteredLeaveBalances.length}/{leaveBalances.length} bản ghi ·{' '}
          {canManageLeaveBalances
            ? 'Click vào hàng để chỉnh sửa hoặc xem lịch sử'
            : 'Click vào hàng để xem lịch sử'}
        </p>
      </div>

      {/* Balance table */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: '#e2ede9' }}
      >
        <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: '#203430' }}>
                {[
                  'MãNV',
                  'Nhân viên',
                  'Phòng ban',
                  'Ngày chính thức',
                  `Phép năm ${balanceYear} được hưởng`,
                  'Thâm niên',
                  `Phép năm ${balanceYear - 1}\nchuyển sang`,
                  `Số phép năm ${balanceYear - 1}\nđã nghỉ đến 31/03/${balanceYear}`,
                  `Số phép năm ${balanceYear - 1}\ncòn lại đến 31/03/${balanceYear}`,
                  'Số ngày được nghỉ bù do OT',
                  'WFH',
                  `Số phép năm ${balanceYear} đã sử dụng`,
                  'Số tháng chưa làm việc',
                  'Số phép còn lại được dùng ngay',
                  'Action',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 font-semibold text-white whitespace-pre-line text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingBalances ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : filteredLeaveBalances.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Không có nhân sự nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredLeaveBalances.map((row) => {
                  const isSelf = String(row.user.id) === String(currentUser?.id);
                  const monthsNotWorked = getMonthsNotWorkedInYear();
                  const remainingCarryOverByDeadline = roundBalanceDisplay(
                    Number(row.carryOverDays) - Number(row.usedCarryOverDays ?? 0),
                  );
                  // Còn lại TẠM tính cả năm: phép năm + thâm niên + comp-off (không gộp carry-over hết hạn Q1, không gộp WFH)
                  const yearlyRemaining = roundBalanceDisplay(
                    Number(row.annualDays) +
                      Number(row.seniorityDays) +
                      Number(row.compOffDays) -
                      Number(row.usedDays) -
                      Number(row.usedCompOffDays),
                  );
                  const annualDaysWithSeniority = roundBalanceDisplay(
                    Number(row.annualDays) + Number(row.seniorityDays),
                  );
                  // Còn lại được dùng ngay: phép năm được hưởng - đã sử dụng - số tháng chưa làm việc
                  const currentMonthRemaining = roundBalanceDisplay(
                    annualDaysWithSeniority - Number(row.usedDays) - monthsNotWorked,
                  );

                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b last:border-0 transition-colors hover:bg-emerald-50"
                      style={{
                        borderColor: '#e2ede9',
                        background: isSelf
                          ? '#f0fdf9'
                          : row.user.isActive === false
                            ? '#f3f4f6'
                            : undefined,
                        opacity: row.user.isActive === false ? 0.85 : 1,
                      }}
                      onClick={() =>
                        canManageLeaveBalances ? openInfoDialog(row) : openHistoryDialog(row)
                      }
                    >
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6b7f78' }}>
                        {row.user.employeeCode || '—'}
                      </td>
                      <td
                        className="px-3 py-2.5 font-semibold whitespace-nowrap"
                        style={{ color: '#203430' }}
                      >
                        {row.user.fullName}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6b7f78' }}>
                        {row.user.department || '—'}
                      </td>
                      <td
                        className="px-3 py-2.5 text-xs whitespace-nowrap tabular-nums"
                        style={{ color: '#6b7f78' }}
                      >
                        {formatDate(row.user.companyJoinDate)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: annualDaysWithSeniority < 0 ? '#ef4444' : '#203430' }}
                      >
                        {annualDaysWithSeniority}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: Number(row.seniorityDays) < 0 ? '#ef4444' : '#203430' }}
                      >
                        {Number(row.seniorityDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: Number(row.carryOverDays) < 0 ? '#ef4444' : '#203430' }}
                      >
                        {Number(row.carryOverDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center"
                        style={{
                          color: Number(row.usedCarryOverDays ?? 0) < 0 ? '#ef4444' : '#f59e0b',
                        }}
                      >
                        {Number(row.usedCarryOverDays ?? 0)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{
                          color: remainingCarryOverByDeadline < 0 ? '#ef4444' : '#203430',
                        }}
                      >
                        {remainingCarryOverByDeadline}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: Number(row.compOffDays) < 0 ? '#ef4444' : '#203430' }}
                      >
                        {Number(row.compOffDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: Number(row.wfhDays) < 0 ? '#ef4444' : '#203430' }}
                      >
                        {Number(row.wfhDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center"
                        style={{ color: Number(row.usedDays) < 0 ? '#ef4444' : '#f59e0b' }}
                      >
                        {Number(row.usedDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: monthsNotWorked > 0 ? '#203430' : '#6b7f78' }}
                      >
                        {monthsNotWorked}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-bold"
                        style={{
                          color: currentMonthRemaining < 0 ? '#ef4444' : '#1DB87A',
                        }}
                      >
                        <HoverCard openDelay={100} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <span className="inline-flex cursor-help items-center justify-center gap-1">
                              <span>{currentMonthRemaining}</span>
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold leading-none"
                                style={{
                                  borderColor:
                                    currentMonthRemaining < 0
                                      ? '#ef4444'
                                      : 'rgba(29, 184, 122, 0.35)',
                                  color: currentMonthRemaining < 0 ? '#ef4444' : '#1DB87A',
                                  background:
                                    currentMonthRemaining < 0
                                      ? 'rgba(239, 68, 68, 0.08)'
                                      : 'rgba(29, 184, 122, 0.1)',
                                }}
                              >
                                !
                              </span>
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-72 p-0 overflow-hidden"
                            style={{ borderColor: '#e2ede9' }}
                          >
                            <div
                              className="px-4 py-3 border-b text-xs font-bold"
                              style={{
                                borderColor: '#e2ede9',
                                color: '#203430',
                                background: '#f8fdfb',
                              }}
                            >
                              Cách tính — ĐẾN tháng {new Date().getMonth() + 1}/
                              {new Date().getFullYear()}
                            </div>
                            <div className="px-4 py-3 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>
                                  Phép năm {balanceYear} được hưởng
                                </span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: '#203430' }}
                                >
                                  {annualDaysWithSeniority}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>
                                  − Số phép năm {balanceYear} đã sử dụng
                                </span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: '#f59e0b' }}
                                >
                                  {Number(row.usedDays)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>− Số tháng chưa làm việc</span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: '#203430' }}
                                >
                                  {monthsNotWorked}
                                </span>
                              </div>
                              <div
                                className="flex justify-between items-center pt-2 mt-1 border-t font-bold text-sm"
                                style={{ borderColor: '#e2ede9' }}
                              >
                                <span style={{ color: '#203430' }}>=</span>
                                <span
                                  style={{
                                    color: currentMonthRemaining < 0 ? '#ef4444' : '#1DB87A',
                                  }}
                                >
                                  {currentMonthRemaining} ngày
                                </span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {canManageLeaveBalances ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openInfoDialog(row);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-emerald-50"
                              style={{ borderColor: '#d1fae5', color: '#059669' }}
                              title="Chỉnh sửa thông tin"
                            >
                              <Pencil size={14} />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNoteDialog(row);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-amber-50"
                            style={{
                              borderColor: row.note ? '#fde68a' : '#e5e7eb',
                              color: row.note ? '#d97706' : '#9ca3af',
                            }}
                            title={canEditNote ? 'Ghi chú' : 'Xem ghi chú'}
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openHistoryDialog(row);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-sky-50"
                            style={{ borderColor: '#dbeafe', color: '#2563eb' }}
                            title="Xem lịch sử"
                          >
                            {canManageLeaveBalances ? <History size={14} /> : <Eye size={14} />}
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

      {/* Info modal */}
      <Dialog
        open={Boolean(editingBalance)}
        onOpenChange={(open) => !open && setEditingBalance(null)}
      >
        {editingBalance && (
          <DialogContent
            showCloseButton={false}
            className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-4xl"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Thông Tin phép năm</DialogTitle>
              <DialogDescription>
                Cập nhật quỹ phép năm và phần đã sử dụng của nhân viên.
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[min(88vh,760px)] flex-col overflow-hidden rounded-3xl bg-white">
              <div
                className="flex items-start justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: '#e2ede9' }}
              >
                <div className="space-y-3">
                  <div>
                    {(() => {
                      const carryOverDays = parseFloat(balanceForm.carryOverDays) || 0;
                      const usedCarryOverDays = parseFloat(balanceForm.usedCarryOverDays) || 0;
                      const annualDays = parseFloat(balanceForm.annualDays) || 0;
                      const seniorityDays = parseFloat(balanceForm.seniorityDays) || 0;
                      const compOffDays = parseFloat(balanceForm.compOffDays) || 0;
                      const wfhDays = parseFloat(balanceForm.wfhDays) || 0;
                      const usedDays = parseFloat(balanceForm.usedDays) || 0;
                      const usedCompOffDays = parseFloat(balanceForm.usedCompOffDays) || 0;
                      const monthsNotWorked = getMonthsNotWorkedInYear();
                      const annualDaysWithSeniority = annualDays + seniorityDays;
                      const totalAllocated =
                        annualDays + carryOverDays + seniorityDays + compOffDays + wfhDays;
                      const totalUsed = usedCarryOverDays + usedDays + usedCompOffDays;
                      const currentMonthRemaining = roundBalanceDisplay(
                        annualDaysWithSeniority - usedDays - monthsNotWorked,
                      );
                      const yearlyRemaining = roundBalanceDisplay(
                        annualDays + seniorityDays + compOffDays - usedDays - usedCompOffDays,
                      );

                      return (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl px-4 py-3" style={{ background: '#f0fdf9' }}>
                            <p
                              className="text-xs font-semibold uppercase tracking-[0.12em]"
                              style={{ color: '#6b7f78' }}
                            >
                              Tổng quỹ
                            </p>
                            <p className="mt-1 text-lg font-bold" style={{ color: '#0E474E' }}>
                              {totalAllocated.toFixed(1)}
                              <span className="ml-1 text-sm font-medium">ngày</span>
                            </p>
                          </div>
                          <div className="rounded-2xl px-4 py-3" style={{ background: '#fff7ed' }}>
                            <p
                              className="text-xs font-semibold uppercase tracking-[0.12em]"
                              style={{ color: '#b45309' }}
                            >
                              Đã dùng
                            </p>
                            <p className="mt-1 text-lg font-bold" style={{ color: '#92400e' }}>
                              {totalUsed.toFixed(1)}
                              <span className="ml-1 text-sm font-medium">ngày</span>
                            </p>
                          </div>
                          <div className="rounded-2xl px-4 py-3" style={{ background: '#eff6ff' }}>
                            <p
                              className="text-xs font-semibold uppercase tracking-[0.12em]"
                              style={{ color: '#1d4ed8' }}
                            >
                              Số phép còn lại được dùng ngay
                            </p>
                            <p className="mt-1 text-lg font-bold" style={{ color: '#1e3a8a' }}>
                              {currentMonthRemaining.toFixed(1)}
                              <span className="ml-1 text-sm font-medium">ngày</span>
                            </p>
                          </div>
                          <div className="rounded-2xl px-4 py-3" style={{ background: '#eef2ff' }}>
                            <p
                              className="text-xs font-semibold uppercase tracking-[0.12em]"
                              style={{ color: '#4338ca' }}
                            >
                              Số ngày nghỉ còn lại TẠM tính trong năm
                            </p>
                            <p className="mt-1 text-lg font-bold" style={{ color: '#312e81' }}>
                              {yearlyRemaining.toFixed(1)}
                              <span className="ml-1 text-sm font-medium">ngày</span>
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    <h2 className="text-lg font-bold" style={{ color: '#203430' }}>
                      Thông Tin phép năm
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: '#6b7f78' }}>
                      {editingBalance.user.fullName} · {editingBalance.year}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingBalance(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
                  style={{ color: '#6b7f78' }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto px-6 py-5">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  {getBalanceFormSections(editingBalance.year).map((section) => (
                    <div
                      key={section.title}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: '#e2ede9', background: '#fcfefd' }}
                    >
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
                          {section.title}
                        </h3>
                        <p className="mt-1 text-xs" style={{ color: '#6b7f78' }}>
                          {section.description}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {section.fields.map(({ key, label, hint }) => (
                          <div key={key} className="space-y-1.5">
                            <label
                              className="block text-xs font-semibold"
                              style={{ color: '#6b7f78' }}
                            >
                              {label}
                            </label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              pattern="-?[0-9]*[.,]?[0-9]*"
                              value={balanceForm[key as keyof typeof balanceForm]}
                              onChange={(e) =>
                                setBalanceForm((prev) => ({
                                  ...prev,
                                  [key]: sanitizeBalanceInput(e.target.value),
                                }))
                              }
                            />
                            <p className="text-[11px]" style={{ color: '#94a3b8' }}>
                              {hint}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-4 rounded-2xl px-4 py-3 text-xs"
                  style={{ background: '#f0fdf9', color: '#6b7f78' }}
                >
                  <p>
                    <strong style={{ color: '#203430' }}>Giá trị còn lại</strong> trên bảng sẽ được
                    tính lại ngay sau khi lưu dựa trên các số liệu bạn chỉnh ở đây.
                  </p>
                </div>

              </div>

              <div
                className="flex justify-end gap-2 border-t px-6 py-4"
                style={{ borderColor: '#e2ede9' }}
              >
                <button
                  type="button"
                  onClick={() => setEditingBalance(null)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveBalance()}
                  disabled={isSavingBalance}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#1DB87A' }}
                >
                  <Save size={14} />
                  {isSavingBalance ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* History modal */}
      <Dialog
        open={Boolean(historyBalance)}
        onOpenChange={(open) => !open && setHistoryBalance(null)}
      >
        {historyBalance && (
          <DialogContent
            showCloseButton={false}
            className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-4xl"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Lịch Sử phép năm</DialogTitle>
              <DialogDescription>
                Xem lịch sử nghỉ phép của nhân viên trong năm đã chọn.
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[min(88vh,760px)] flex-col overflow-hidden rounded-3xl bg-white">
              <div
                className="flex items-start justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: '#e2ede9' }}
              >
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#203430' }}>
                    Lịch Sử phép năm
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: '#6b7f78' }}>
                    {historyBalance.user.fullName} · {historyBalance.year}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryBalance(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
                  style={{ color: '#6b7f78' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-5">
                <div
                  className="rounded-2xl border"
                  style={{ borderColor: '#e2ede9', background: '#fcfefd' }}
                >
                  <div
                    className="flex items-center justify-between gap-3 border-b px-4 py-3"
                    style={{ borderColor: '#e2ede9' }}
                  >
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
                        Lịch sử nghỉ phép năm {historyBalance.year}
                      </h3>
                      <p className="mt-1 text-xs" style={{ color: '#6b7f78' }}>
                        Chỉ hiển thị các đơn của member đang chọn.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {balanceHistory.length} bản ghi
                    </span>
                  </div>

                  {isLoadingBalanceHistory ? (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: '#6b7f78' }}>
                      Đang tải lịch sử...
                    </div>
                  ) : balanceHistoryError ? (
                    <div className="px-4 py-8 text-center text-sm text-red-500">
                      {balanceHistoryError}
                    </div>
                  ) : balanceHistory.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm" style={{ color: '#6b7f78' }}>
                      Chưa có lịch sử nghỉ phép trong năm {historyBalance.year}.
                    </div>
                  ) : (
                    <div className="space-y-3 p-4">
                      {balanceHistory.map((item) => {
                        const status = getStatusBadge(item.status);
                        const leaveTypeLabel = item.leaveType?.name
                          ? `${item.leaveType.code} - ${item.leaveType.name}`
                          : item.leaveType?.code || 'Nghỉ phép';

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border p-4"
                            style={{ borderColor: '#e2ede9', background: '#fff' }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                                    style={{
                                      background: `${item.leaveType?.color || '#e2ede9'}20`,
                                      color: item.leaveType?.color || '#203430',
                                    }}
                                  >
                                    {leaveTypeLabel}
                                  </span>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                                  {formatDate(item.fromDate)} - {formatDate(item.toDate)} ·{' '}
                                  {Number(item.totalDays)} ngày
                                </p>
                                <p className="text-xs" style={{ color: '#6b7f78' }}>
                                  Lý do: {getHistoryReason(item.reason)}
                                </p>
                              </div>
                              <div
                                className="space-y-1 text-right text-xs"
                                style={{ color: '#6b7f78' }}
                              >
                                <p>Tạo lúc: {formatDateTimeVN(item.createdAt)}</p>
                                <p>
                                  Duyệt lúc:{' '}
                                  {item.approvedAt ? formatDateTimeVN(item.approvedAt) : '—'}
                                </p>
                                <p>Người duyệt: {item.approver?.fullName || '—'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="flex justify-end gap-2 border-t px-6 py-4"
                style={{ borderColor: '#e2ede9' }}
              >
                <button
                  type="button"
                  onClick={() => setHistoryBalance(null)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Note modal */}
      <Dialog open={Boolean(noteBalance)} onOpenChange={(open) => !open && setNoteBalance(null)}>
        {noteBalance && (
          <DialogContent
            showCloseButton={false}
            className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-2xl"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Ghi chú phép năm</DialogTitle>
              <DialogDescription>Ghi chú nội bộ về số dư phép của nhân viên.</DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[min(88vh,640px)] flex-col overflow-hidden rounded-3xl bg-white">
              {/* Header */}
              <div
                className="flex items-center justify-between gap-4 border-b px-6 py-5"
                style={{ borderColor: '#e2ede9' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: '#fef3c7' }}
                  >
                    <FileText size={16} style={{ color: '#d97706' }} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ color: '#203430' }}>
                      Ghi chú
                    </h2>
                    <p className="text-xs" style={{ color: '#6b7f78' }}>
                      {noteBalance.user.fullName} · {noteBalance.leaveType.name} · {noteBalance.year}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setNoteBalance(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
                  style={{ color: '#6b7f78' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {!canEditNote && !noteEditorValue && (
                  <p className="text-sm italic" style={{ color: '#b0c8bf' }}>
                    Chưa có ghi chú nào.
                  </p>
                )}
                <TiptapNotionEditor
                  value={noteEditorValue}
                  onChange={setNoteEditorValue}
                  placeholder="Thêm ghi chú về số dư phép của nhân viên này..."
                  readOnly={!canEditNote}
                />
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between gap-2 border-t px-6 py-4"
                style={{ borderColor: '#e2ede9' }}
              >
                <p className="text-xs" style={{ color: '#94a3b8' }}>
                  {canEditNote
                    ? 'Hỗ trợ định dạng: in đậm, danh sách, checklist, trích dẫn…'
                    : 'Bạn chỉ có quyền xem ghi chú này.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteBalance(null)}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                    style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
                  >
                    {canEditNote ? 'Hủy' : 'Đóng'}
                  </button>
                  {canEditNote && (
                    <button
                      type="button"
                      onClick={() => void handleSaveNote()}
                      disabled={isSavingNote}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: '#d97706' }}
                    >
                      <Save size={14} />
                      {isSavingNote ? 'Đang lưu...' : 'Lưu ghi chú'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
