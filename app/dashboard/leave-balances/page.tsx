'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { CalendarDays, FileDown, RefreshCw, Save, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
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
import { toFrontendRole } from '@/lib/hr-utils';
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
  user: {
    id: string;
    fullName: string;
    employeeCode?: string | null;
    department?: string | null;
  };
  leaveType: {
    code: string;
    name: string;
    color: string;
  };
}

interface CurrentUserInfo {
  role?: string | null;
  systemRole?: string | null;
}

const BALANCE_FORM_SECTIONS = [
  {
    title: 'Quỹ phép',
    description: 'Các ngày được cấp hoặc cộng dồn.',
    fields: [
      { key: 'annualDays', label: 'Phép năm', hint: 'annualDays' },
      { key: 'carryOverDays', label: 'Chuyển tiếp', hint: 'carryOverDays' },
      { key: 'seniorityDays', label: 'Thâm niên', hint: 'seniorityDays' },
      { key: 'compOffDays', label: 'Comp-Off tích lũy', hint: 'compOffDays' },
      { key: 'wfhDays', label: 'WFH', hint: 'wfhDays' },
    ],
  },
  {
    title: 'Đã sử dụng',
    description: 'Theo dõi phần đã trừ khỏi quỹ phép.',
    fields: [
      { key: 'usedCarryOverDays', label: 'Đã dùng carry-over', hint: 'usedCarryOverDays' },
      { key: 'usedDays', label: 'Đã dùng phép', hint: 'usedDays' },
      { key: 'usedCompOffDays', label: 'Đã dùng Comp-Off', hint: 'usedCompOffDays' },
    ],
  },
] as const;

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
  const [resetCarryOverDate, setResetCarryOverDate] = useState<string>('03-31');
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [isImportingBalances, setIsImportingBalances] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);
  const [isLoadingCurrentUser, setIsLoadingCurrentUser] = useState(true);

  const currentRole: FrontendRole | null = currentUser ? toFrontendRole(currentUser.role) : null;
  const canManageLeaveBalances =
    currentRole === 'hr' ||
    currentRole === 'admin' ||
    currentUser?.systemRole?.toUpperCase() === 'ADMIN';

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

  const handleRecalculateLeave = async () => {
    if (!canManageLeaveBalances) return;
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
      toast.error(error instanceof Error ? error.message : 'Không thể tính toán lại phép năm.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const openEditBalance = (row: LeaveBalanceApiRow) => {
    if (!canManageLeaveBalances) return;
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
            <button
              type="button"
              onClick={() => void handleRecalculateLeave()}
              disabled={isRecalculating}
              title="Tính toán lại tổng ngày phép năm cho tất cả nhân viên dựa theo ngày vào công ty"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderColor: '#1DB87A', color: '#1DB87A', background: '#f0fdf9' }}
            >
              <RefreshCw size={14} className={isRecalculating ? 'animate-spin' : ''} />
              {isRecalculating ? 'Đang tính...' : 'Tính toán lại phép năm'}
            </button>
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
        <p className="text-xs" style={{ color: '#6b7f78' }}>
          {leaveBalances.length} bản ghi ·{' '}
          {canManageLeaveBalances ? 'Click vào hàng để chỉnh sửa' : 'Chỉ xem dữ liệu'}
        </p>
      </div>

      {/* Balance table */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: '#e2ede9' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#203430' }}>
                {[
                  'Nhân viên',
                  'Mã NV',
                  'Phòng ban',
                  `Phép năm ${balanceYear}`,
                  'Thâm niên',
                  `Phép ${balanceYear - 1}\nChưa Sử Dụng`,
                  'Comp-Off',
                  'WFH',
                  'Đã dùng carry-over',
                  'Đã dùng phép',
                  'Đã dùng Comp-Off',
                  'Số ngày nghỉ còn lại tính ĐẾN tháng hiện tại',
                  'Số ngày nghỉ còn lại TẠM tính trong năm',
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
                    colSpan={13}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : leaveBalances.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-3 py-8 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    Chưa có dữ liệu phép năm {balanceYear}. Hãy nhấn &quot;Tính toán lại phép
                    năm&quot; để khởi tạo.
                  </td>
                </tr>
              ) : (
                leaveBalances.map((row) => {
                  const today = new Date();
                  const isCurrentBalanceYear = balanceYear === today.getFullYear();
                  const currentMonth = today.getMonth() + 1;
                  const [resetMM, resetDD] = resetCarryOverDate.split('-').map(Number);
                  const resetDate = new Date(
                    today.getFullYear(),
                    (resetMM || 3) - 1,
                    resetDD || 31,
                  );
                  // carry-over còn hiệu lực: dùng raw (không clamp 0) để giữ giá trị âm
                  const effectiveCarryOver =
                    today < resetDate
                      ? Number(row.carryOverDays) - Number(row.usedCarryOverDays ?? 0)
                      : 0;
                  // Còn lại TẠM tính cả năm: phép năm + thâm niên + comp-off (không gộp carry-over hết hạn Q1, không gộp WFH)
                  const yearlyRemaining = roundBalanceDisplay(
                    Number(row.annualDays) +
                      Number(row.seniorityDays) +
                      Number(row.compOffDays) -
                      Number(row.usedDays) -
                      Number(row.usedCompOffDays),
                  );
                  const currentMonthAccruedAnnualDays = isCurrentBalanceYear
                    ? roundBalanceDisplay((Number(row.annualDays) / 12) * currentMonth)
                    : Number(row.annualDays);
                  // Còn lại ĐẾN tháng hiện tại: phép tích lũy + thâm niên + carry-over hiệu lực - đã dùng phép
                  const currentMonthRemaining = roundBalanceDisplay(
                    currentMonthAccruedAnnualDays +
                      Number(row.seniorityDays) +
                      effectiveCarryOver -
                      Number(row.usedDays),
                  );

                  return (
                    <tr
                      key={row.id}
                      className={`border-b last:border-0 transition-colors ${
                        canManageLeaveBalances
                          ? 'cursor-pointer hover:bg-emerald-50'
                          : 'cursor-default'
                      }`}
                      style={{ borderColor: '#e2ede9' }}
                      onClick={() => openEditBalance(row)}
                    >
                      <td
                        className="px-3 py-2.5 font-semibold whitespace-nowrap"
                        style={{ color: '#203430' }}
                      >
                        {row.user.fullName}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6b7f78' }}>
                        {row.user.employeeCode || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: '#6b7f78' }}>
                        {row.user.department || '—'}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-semibold"
                        style={{ color: Number(row.annualDays) < 0 ? '#ef4444' : '#203430' }}
                      >
                        {Number(row.annualDays)}
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
                        style={{ color: Number(row.usedCarryOverDays ?? 0) < 0 ? '#ef4444' : '#f59e0b' }}
                      >
                        {Number(row.usedCarryOverDays ?? 0)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center"
                        style={{ color: Number(row.usedDays) < 0 ? '#ef4444' : '#f59e0b' }}
                      >
                        {Number(row.usedDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center"
                        style={{ color: Number(row.usedCompOffDays) < 0 ? '#ef4444' : '#f59e0b' }}
                      >
                        {Number(row.usedCompOffDays)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-bold"
                        style={{
                          color: currentMonthRemaining < 0 ? '#ef4444' : '#1DB87A',
                        }}
                      >
                        <HoverCard openDelay={100} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <span className="cursor-help">
                              {currentMonthRemaining}
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-72 p-0 overflow-hidden"
                            style={{ borderColor: '#e2ede9' }}
                          >
                            <div
                              className="px-4 py-3 border-b text-xs font-bold"
                              style={{ borderColor: '#e2ede9', color: '#203430', background: '#f8fdfb' }}
                            >
                              Cách tính — ĐẾN tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
                            </div>
                            <div className="px-4 py-3 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>
                                  Phép năm {balanceYear} ({new Date().getMonth() + 1}/12 tháng)
                                </span>
                                <span className="font-semibold tabular-nums" style={{ color: '#203430' }}>
                                  {currentMonthAccruedAnnualDays}
                                </span>
                              </div>
                              {Number(row.seniorityDays) !== 0 && (
                                <div className="flex justify-between items-center">
                                  <span style={{ color: '#6b7f78' }}>+ Thâm niên</span>
                                  <span className="font-semibold tabular-nums" style={{ color: '#203430' }}>
                                    {Number(row.seniorityDays)}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>
                                  {today < resetDate
                                    ? `+ Phép ${balanceYear - 1} chưa sử dụng (còn lại)`
                                    : `± Phép ${balanceYear - 1} chưa sử dụng (đã hết hạn)`}
                                </span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: today < resetDate ? (effectiveCarryOver < 0 ? '#ef4444' : '#203430') : '#9ca3af' }}
                                >
                                  {today < resetDate ? effectiveCarryOver : 0}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span style={{ color: '#6b7f78' }}>− Đã dùng phép</span>
                                <span className="font-semibold tabular-nums" style={{ color: '#f59e0b' }}>
                                  {Number(row.usedDays)}
                                </span>
                              </div>
                              <div
                                className="flex justify-between items-center pt-2 mt-1 border-t font-bold text-sm"
                                style={{ borderColor: '#e2ede9' }}
                              >
                                <span style={{ color: '#203430' }}>=</span>
                                <span style={{ color: currentMonthRemaining < 0 ? '#ef4444' : '#1DB87A' }}>
                                  {currentMonthRemaining} ngày
                                </span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-bold"
                        style={{
                          color: yearlyRemaining < 0 ? '#ef4444' : '#1DB87A',
                        }}
                      >
                        {yearlyRemaining}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit balance modal */}
      <Dialog
        open={canManageLeaveBalances && Boolean(editingBalance)}
        onOpenChange={(open) => !open && setEditingBalance(null)}
      >
        {editingBalance && (
          <DialogContent
            showCloseButton={false}
            className="overflow-hidden border-0 p-0 shadow-2xl sm:max-w-3xl"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Chỉnh sửa phép năm</DialogTitle>
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
                      const today = new Date();
                      const isCurrentBalanceYear = editingBalance.year === today.getFullYear();
                      const currentMonth = today.getMonth() + 1;
                      const [resetMM, resetDD] = resetCarryOverDate.split('-').map(Number);
                      const resetDate = new Date(
                        today.getFullYear(),
                        (resetMM || 3) - 1,
                        resetDD || 31,
                      );
                      const carryOverDays = parseFloat(balanceForm.carryOverDays) || 0;
                      const usedCarryOverDays = parseFloat(balanceForm.usedCarryOverDays) || 0;
                      const effectiveCarryOver =
                        today < resetDate ? carryOverDays - usedCarryOverDays : 0;
                      const annualDays = parseFloat(balanceForm.annualDays) || 0;
                      const seniorityDays = parseFloat(balanceForm.seniorityDays) || 0;
                      const compOffDays = parseFloat(balanceForm.compOffDays) || 0;
                      const wfhDays = parseFloat(balanceForm.wfhDays) || 0;
                      const usedDays = parseFloat(balanceForm.usedDays) || 0;
                      const usedCompOffDays = parseFloat(balanceForm.usedCompOffDays) || 0;
                      const totalAllocated =
                        annualDays + carryOverDays + seniorityDays + compOffDays + wfhDays;
                      const totalUsed = usedCarryOverDays + usedDays + usedCompOffDays;
                      const currentMonthAccruedAnnualDays = isCurrentBalanceYear
                        ? roundBalanceDisplay((annualDays / 12) * currentMonth)
                        : annualDays;
                      const currentMonthRemaining = roundBalanceDisplay(
                        currentMonthAccruedAnnualDays +
                          seniorityDays +
                          effectiveCarryOver -
                          usedDays,
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
                              Số ngày nghỉ còn lại tính ĐẾN tháng hiện tại
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
                      Chỉnh sửa phép năm
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
                  {BALANCE_FORM_SECTIONS.map((section) => (
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
    </div>
  );
}
