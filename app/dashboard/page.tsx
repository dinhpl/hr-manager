'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Hourglass,
  Home,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import LeaveDetailModal, { LeaveDetailData } from '@/components/leave-detail-modal';
import CalendarDayDetailModal, {
  CalendarDayBirthday,
  CalendarDayHoliday,
  CalendarDayUser,
} from '@/components/calendar-day-detail-modal';
import LeaveRequestModal, { LeaveRequestData } from '@/components/leave-request-modal';
import { apiClient, clearAuthSession, getApiBaseUrl } from '@/lib/api-client';
import {
  formatDateTimeVN,
  formatDateVN,
  getDateTimeValue,
  numberValue,
  parseApiDateTime,
  toFrontendRole,
} from '@/lib/hr-utils';
import type { FrontendRole } from '@/lib/hr-utils';

type UserRole = FrontendRole;
type StatusKey = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface UserInfo {
  id: string;
  username: string;
  fullName?: string | null;
  role: string;
}

interface DashboardEmployeeSummary {
  type: 'employee';
  stats: {
    remainingLeaveDays: number;
    usedLeaveDays: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  };
}

interface EmployeeLeaveBalance {
  annualDays: number;
  carryOverDays: number;
  seniorityDays: number;
  compOffDays: number;
  wfhDays: number;
  usedDays: number;
  usedCarryOverDays: number;
  usedCompOffDays: number;
}

interface BalanceApiRecord {
  annualDays: number | string;
  carryOverDays: number | string;
  seniorityDays: number | string;
  compOffDays: number | string;
  wfhDays: number | string;
  usedDays: number | string;
  usedCarryOverDays: number | string;
  usedCompOffDays: number | string;
  leaveType: { code: string; name: string };
}

interface DashboardManagerSummary {
  type: 'manager' | 'hr' | 'admin';
  stats: {
    totalEmployees: number;
    pendingRequests: number;
    todayRequests: number;
    weekApproved: number;
    overdueRequests: number;
  };
}

type DashboardSummary = DashboardEmployeeSummary | DashboardManagerSummary;
type CalendarData = Record<
  string,
  {
    users: CalendarDayUser[];
    holidays: CalendarDayHoliday[];
  }
>;

interface DashboardLeaveRequest {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  totalDays: number | string;
  reason?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  approvedNote?: string | null;
  user?: {
    id?: string;
    fullName?: string | null;
    username?: string | null;
    avatar?: string | null;
  };
  leaveType?: {
    id?: string;
    code?: string | null;
    name?: string | null;
    color?: string | null;
  };
  durationMode?: string | null;
  approver?: {
    id?: string;
    fullName?: string | null;
  } | null;
  handoverPerson?: {
    id?: string;
    fullName?: string | null;
  } | null;
}

type BirthdayData = Record<string, CalendarDayBirthday[]>;

interface SharedDashboardProps {
  currentMonth: number;
  currentYear: number;
  calendarData: CalendarData;
  recentRequests: DashboardLeaveRequest[];
  onNextMonth: () => void;
  onOpenDetail: (request: DashboardLeaveRequest) => void;
  onOpenDayDetail: (
    date: string,
    users: CalendarData[string]['users'],
    holidays: CalendarData[string]['holidays'],
    birthdays?: CalendarDayBirthday[],
  ) => void;
  onOpenRequestModal: () => void;
  onPrevMonth: () => void;
}

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const STATUS_CONFIG: Record<StatusKey, { label: string; bg: string; color: string }> = {
  pending: { label: 'Chờ duyệt', bg: '#fef3c7', color: '#d97706' },
  approved: { label: 'Đã duyệt', bg: '#d1fae5', color: '#059669' },
  rejected: { label: 'Từ chối', bg: '#fee2e2', color: '#dc2626' },
  cancelled: { label: 'Đã hủy', bg: '#f3f4f6', color: '#6b7280' },
};

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const days: { day: number; month: 'prev' | 'current' | 'next'; dateStr: string }[] = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const prevMonth = month - 1 === 0 ? 12 : month - 1;
    const prevYear = month - 1 === 0 ? year - 1 : year;
    days.push({
      day,
      month: 'prev',
      dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      day,
      month: 'current',
      dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  const remaining = 42 - days.length;
  for (let day = 1; day <= remaining; day += 1) {
    const nextMonth = month + 1 === 13 ? 1 : month + 1;
    const nextYear = month + 1 === 13 ? year + 1 : year;
    days.push({
      day,
      month: 'next',
      dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  return days;
}

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

function getDisplayName(user?: DashboardLeaveRequest['user']) {
  return user?.fullName?.trim() || user?.username?.trim() || 'Nhân viên';
}

function getAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
  return null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRecentRequestHeaderClass(header: string) {
  if (header === 'Từ ngày' || header === 'Đến ngày' || header === 'Số ngày') {
    return 'px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  }

  return 'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';
}

function toDetailData(request: DashboardLeaveRequest): LeaveDetailData {
  return {
    id: String(request.id),
    typeCode: request.leaveType?.code || '-',
    typeColor: request.leaveType?.color || undefined,
    fromDate: formatDateVN(request.fromDate),
    toDate: formatDateVN(request.toDate),
    days: numberValue(request.totalDays),
    reason: request.reason || undefined,
    status: normalizeStatus(request.status),
    submittedAt: formatDateTimeVN(request.createdAt),
    handover: request.handoverPerson?.fullName || undefined,
    approver: request.approver?.fullName || undefined,
    approvedAt: request.approvedAt ? formatDateTimeVN(request.approvedAt) : undefined,
    employeeName: request.user?.fullName || undefined,
  };
}

// Shared Google-Calendar-style calendar grid
function CalendarGrid({
  calendarData,
  calendarDays,
  birthdayData,
  onDayClick,
}: {
  calendarData: CalendarData;
  calendarDays: ReturnType<typeof getCalendarDays>;
  birthdayData?: BirthdayData;
  onDayClick?: (
    date: string,
    users: CalendarData[string]['users'],
    holidays: CalendarData[string]['holidays'],
    birthdays?: CalendarDayBirthday[],
  ) => void;
}) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>
        {/* Calendar cells */}
        <div className="grid grid-cols-7 border-l border-t border-gray-100">
          {calendarDays.map((cell, index) => {
            const data = calendarData[cell.dateStr];
            const users = data?.users ?? [];
            const holidays = data?.holidays ?? [];
            const birthdays = birthdayData?.[cell.dateStr] ?? [];
            const hasPending = users.some((u) => u.status === 'pending');
            const isToday = cell.dateStr === todayStr;
            const isCurrentMonth = cell.month === 'current';
            const hasUsers = users.length > 0;
            const hasHolidays = holidays.length > 0;
            const hasBirthdays = birthdays.length > 0;
            const hasEvents = hasUsers || hasHolidays || hasBirthdays;
            const visibleHolidayCount = Math.min(holidays.length, 2);
            const visibleBirthdayCount = Math.min(birthdays.length, 1);
            const visibleUserCount = Math.min(
              users.length,
              Math.max(0, 3 - visibleHolidayCount - visibleBirthdayCount),
            );
            const hiddenCount =
              holidays.length +
              birthdays.length +
              users.length -
              visibleHolidayCount -
              visibleBirthdayCount -
              visibleUserCount;
            return (
              <div
                key={`${cell.dateStr}-${index}`}
                className={`flex min-h-[88px] flex-col gap-0.5 border-b border-r border-gray-100 p-1.5 transition-colors ${
                  isCurrentMonth
                    ? 'cursor-pointer hover:bg-orange-50/70'
                    : 'hover:bg-gray-50/50'
                }`}
                style={{
                  background: hasHolidays && isCurrentMonth ? '#fffaf5' : undefined,
                }}
                onClick={() => {
                  if (isCurrentMonth && onDayClick) {
                    onDayClick(
                      cell.dateStr,
                      users,
                      holidays,
                      birthdays.length > 0 ? birthdays : undefined,
                    );
                  }
                }}
              >
                {/* Day number row */}
                <div className="mb-0.5 flex items-start justify-between">
                  <span
                    className={[
                      'flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold leading-none',
                      isToday
                        ? 'bg-[#1DB87A] text-white'
                        : isCurrentMonth
                          ? 'text-[#203430]'
                          : 'text-gray-300',
                    ].join(' ')}
                  >
                    {cell.day}
                  </span>
                  {hasPending && isCurrentMonth && (
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  )}
                </div>
                {isCurrentMonth &&
                  holidays.slice(0, visibleHolidayCount).map((holiday) => (
                    <div
                      key={holiday.id}
                      className="truncate rounded-[4px] px-1.5 py-[3px] text-[9px] font-semibold leading-none"
                      style={{
                        background: '#ffedd5',
                        color: '#c2410c',
                        borderLeft: '2px solid #ea580c',
                      }}
                      title={holiday.name}
                    >
                      {holiday.name}
                    </div>
                  ))}
                {/* Event chips */}
                {isCurrentMonth &&
                  users.slice(0, visibleUserCount).map((u, i) => (
                    <div
                      key={i}
                      className="truncate rounded-[4px] px-1.5 py-[3px] text-[9px] font-semibold leading-none"
                      style={{
                        background: u.status === 'approved' ? '#dcfce7' : '#fef9c3',
                        color: u.status === 'approved' ? '#15803d' : '#92400e',
                        borderLeft: `2px solid ${u.status === 'approved' ? '#16a34a' : '#d97706'}`,
                      }}
                      title={u.name}
                    >
                      {u.name}
                    </div>
                  ))}
                {isCurrentMonth &&
                  birthdays.slice(0, visibleBirthdayCount).map((b, i) => (
                    <div
                      key={`b-${i}`}
                      className="truncate rounded-[4px] px-1.5 py-[3px] text-[9px] font-semibold leading-none"
                      style={{
                        background: '#fce7f3',
                        color: '#9d174d',
                        borderLeft: '2px solid #ec4899',
                      }}
                      title={`🎂 ${b.name}`}
                    >
                      🎂 {b.name}
                    </div>
                  ))}
                {/* Overflow */}
                {isCurrentMonth && hiddenCount > 0 && (
                  <span className="pl-1 text-[9px] font-medium text-gray-400">
                    +{hiddenCount} khác
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LeaveBalanceCards({
  leaveBalance,
  resetCarryOverDate = '03-31',
}: {
  leaveBalance?: EmployeeLeaveBalance | null;
  resetCarryOverDate?: string;
}) {
  const todayVN = new Date();
  const todayMonth = todayVN.getMonth() + 1;
  const thisYear = todayVN.getFullYear();
  const prevYear = thisYear - 1;

  const annualDays = leaveBalance ? Number(leaveBalance.annualDays) : 0;
  const carryOverDays = leaveBalance ? Number(leaveBalance.carryOverDays) : 0;
  const usedCarryOverDays = leaveBalance ? Number(leaveBalance.usedCarryOverDays) : 0;
  const seniorityDays = leaveBalance ? Number(leaveBalance.seniorityDays) : 0;
  const usedDays = leaveBalance ? Number(leaveBalance.usedDays) : 0;
  const wfhDays = leaveBalance ? Number(leaveBalance.wfhDays) : 0;

  // Carry-over expiry warning
  const [resetMM, resetDD] = resetCarryOverDate.split('-').map(Number);
  const resetDate = new Date(thisYear, (resetMM || 3) - 1, resetDD || 31);
  const remainingCarryOver = Math.max(0, carryOverDays - usedCarryOverDays);
  const showCarryOverWarning = remainingCarryOver > 0 && todayVN < resetDate;

  const proratedAllocation = Math.min(annualDays, todayMonth);
  const remainingToMonth = Math.max(
    0,
    proratedAllocation + (todayVN < resetDate ? remainingCarryOver : 0) + seniorityDays - usedDays,
  );
  const remainingFullYear = Math.max(0, annualDays + seniorityDays + (todayVN < resetDate ? remainingCarryOver : 0) - usedDays);

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const resetDateLabel = `${String(resetDD || 31).padStart(2, '0')}/${String(resetMM || 3).padStart(2, '0')}/${thisYear}`;

  return (
    <div className="space-y-3">
      {showCarryOverWarning && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
        >
          <span>⚠</span>
          <span>
            Phép năm {prevYear} còn{' '}
            <strong>{fmt(remainingCarryOver)} ngày</strong> sẽ hết hạn vào {resetDateLabel}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #a78bfa' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Phép Chuyển {prevYear}</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#ede9fe' }}
          >
            <ArrowRightLeft size={15} style={{ color: '#7c3aed' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#203430' }}>
          {fmt(carryOverDays)}
        </p>
        <p className="text-xs text-muted-foreground">ngày</p>
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #1DB87A' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Phép Năm {thisYear}</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#D3F2E7' }}
          >
            <CalendarCheck size={15} style={{ color: '#1DB87A' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#203430' }}>
          {fmt(annualDays)}
        </p>
        {seniorityDays > 0 ? (
          <p className="text-xs font-medium" style={{ color: '#1DB87A' }}>
            + {fmt(seniorityDays)} thâm niên
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">ngày</p>
        )}
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #f59e0b' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Đã Nghỉ</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#fef3c7' }}
          >
            <Hourglass size={15} style={{ color: '#f59e0b' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#203430' }}>
          {fmt(usedDays)}
        </p>
        <p className="text-xs text-muted-foreground">ngày đã dùng</p>
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #0ea5e9' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Số Ngày WFH</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#e0f2fe' }}
          >
            <Home size={15} style={{ color: '#0ea5e9' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#203430' }}>
          {fmt(wfhDays)}
        </p>
        <p className="text-xs text-muted-foreground">ngày WFH</p>
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #3b82f6' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Còn lại đến T{todayMonth}</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#dbeafe' }}
          >
            <CheckCircle2 size={15} style={{ color: '#3b82f6' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
          {fmt(remainingToMonth)}
        </p>
        <p className="text-xs text-muted-foreground">ngày còn lại</p>
      </div>

      <div
        className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm"
        style={{ border: '1px solid #e2ede9', borderTop: '3px solid #059669' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Tạm tính cả năm</p>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: '#d1fae5' }}
          >
            <TrendingUp size={15} style={{ color: '#059669' }} />
          </div>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#059669' }}>
          {fmt(remainingFullYear)}
        </p>
        <p className="text-xs text-muted-foreground">ngày còn lại</p>
      </div>
    </div>
    </div>
  );
}

function EmployeeDashboard({
  currentMonth,
  currentYear,
  calendarData,
  recentRequests,
  summary,
  leaveBalance,
  resetCarryOverDate,
  onNextMonth,
  onOpenDetail,
  onOpenDayDetail,
  onOpenRequestModal,
  onPrevMonth,
}: SharedDashboardProps & {
  summary: DashboardEmployeeSummary['stats'];
  leaveBalance?: EmployeeLeaveBalance | null;
  resetCarryOverDate?: string;
}) {
  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentMonth, currentYear],
  );

  const nextUpcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...recentRequests]
      .filter((request) => {
        const status = normalizeStatus(request.status);
        const fromDate = parseApiDateTime(request.fromDate);
        if (!fromDate) return false;
        return fromDate >= today && status !== 'rejected' && status !== 'cancelled';
      })
      .sort((left, right) => getDateTimeValue(left.fromDate) - getDateTimeValue(right.fromDate))[0];
  }, [recentRequests]);

  return (
    <div className="space-y-5">
      <LeaveBalanceCards leaveBalance={leaveBalance} resetCarryOverDate={resetCarryOverDate} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Calendar card */}
        <div
          className="rounded-xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-2"
          style={{ border: '1px solid #e2ede9' }}
        >
          {/* Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: '#203430' }}>
              Lịch nghỉ phép
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onPrevMonth}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronLeft size={15} />
              </button>
              <span
                className="min-w-[130px] text-center text-sm font-semibold"
                style={{ color: '#203430' }}
              >
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </span>
              <button
                onClick={onNextMonth}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-2.5 rounded-sm"
                style={{ background: '#dcfce7', borderLeft: '2px solid #16a34a' }}
              />
              <span className="text-xs text-gray-500">Đã duyệt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-2.5 rounded-sm"
                style={{ background: '#fef9c3', borderLeft: '2px solid #d97706' }}
              />
              <span className="text-xs text-gray-500">Chờ duyệt</span>
            </div>
          </div>

          <CalendarGrid
            calendarDays={calendarDays}
            calendarData={calendarData}
            onDayClick={onOpenDayDetail}
          />
        </div>

        <div className="space-y-4">
          <div
            className="rounded-xl bg-linear-to-br p-5 text-white shadow-sm sm:p-6"
            style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
          >
            <h3 className="mb-2 text-base font-bold">Đăng ký nghỉ phép</h3>
            <p className="mb-4 text-sm opacity-90">Tạo yêu cầu nghỉ phép mới cho bạn</p>
            <button
              onClick={onOpenRequestModal}
              className="inline-block cursor-pointer rounded-lg bg-white px-4 py-2 text-xs font-semibold transition-all hover:shadow-lg"
              style={{ color: '#1DB87A' }}
            >
              Tạo yêu cầu →
            </button>
          </div>

          <div
            className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
            style={{ border: '1px solid #e2ede9' }}
          >
            <h3 className="mb-4 text-sm font-bold" style={{ color: '#203430' }}>
              Nghỉ kế tiếp
            </h3>
            {nextUpcoming ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                  {nextUpcoming.leaveType?.name || nextUpcoming.leaveType?.code || 'Nghỉ phép'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Từ: {formatDateVN(nextUpcoming.fromDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Đến: {formatDateVN(nextUpcoming.toDate)}
                </p>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: STATUS_CONFIG[normalizeStatus(nextUpcoming.status)].bg,
                    color: STATUS_CONFIG[normalizeStatus(nextUpcoming.status)].color,
                  }}
                >
                  {STATUS_CONFIG[normalizeStatus(nextUpcoming.status)].label}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có lịch nghỉ sắp tới</p>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
        style={{ border: '1px solid #e2ede9' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: '#203430' }}>
            Yêu cầu gần đây
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '2px solid #e2ede9' }}>
                {[
                  'ID',
                  'Nhân viên',
                  'Loại nghỉ',
                  'Từ ngày',
                  'Đến ngày',
                  'Số ngày',
                  'Người duyệt',
                  'Trạng thái',
                  'Thao tác',
                ].map((header) => (
                  <th key={header} className={getRecentRequestHeaderClass(header)}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Chưa có yêu cầu gần đây.
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => {
                  const status = STATUS_CONFIG[normalizeStatus(request.status)];
                  const employeeName = getDisplayName(request.user);
                  const avatarUrl = getAvatarUrl(request.user?.avatar);
                  return (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-[#f7f7f7]"
                      style={{ borderBottom: '1px solid #f0f4f2' }}
                    >
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: '#203430' }}>
                        #{request.id}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={employeeName}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                              }}
                            >
                              {getInitials(employeeName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: '#203430' }}
                            >
                              {employeeName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#203430' }}>
                        {request.leaveType?.code || '-'}
                        {request.leaveType?.name ? ` - ${request.leaveType.name}` : ''}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-muted-foreground">
                        {formatDateVN(request.fromDate)}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-muted-foreground">
                        {formatDateVN(request.toDate)}
                      </td>
                      <td
                        className="px-3 py-3 text-center text-sm font-medium"
                        style={{ color: '#203430' }}
                      >
                        {numberValue(request.totalDays)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#6b7f78' }}>
                        {request.approver?.fullName || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => onOpenDetail(request)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: '#1DB87A' }}
                        >
                          <Eye size={13} /> Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={onOpenRequestModal}
        className="fixed bottom-6 right-6 z-10 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
        aria-label="Đăng ký nghỉ phép mới"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

function AdminHRDashboard({
  currentMonth,
  currentYear,
  calendarData,
  recentRequests,
  summary,
  userRole,
  birthdayData,
  leaveBalance,
  resetCarryOverDate,
  onNextMonth,
  onOpenDetail,
  onOpenDayDetail,
  onOpenRequestModal,
  onPrevMonth,
}: SharedDashboardProps & {
  summary: DashboardManagerSummary['stats'];
  userRole: Exclude<UserRole, 'employee'>;
  birthdayData?: BirthdayData;
  leaveBalance?: EmployeeLeaveBalance | null;
  resetCarryOverDate?: string;
}) {
  const calendarDays = useMemo(
    () => getCalendarDays(currentYear, currentMonth),
    [currentMonth, currentYear],
  );

  const recentApprovalRate = useMemo(() => {
    const completed = recentRequests.filter((request) =>
      ['APPROVED', 'REJECTED'].includes((request.status || '').toUpperCase()),
    );
    const approved = completed.filter(
      (request) => (request.status || '').toUpperCase() === 'APPROVED',
    ).length;

    if (completed.length === 0) {
      return 0;
    }

    return Math.round((approved / completed.length) * 100);
  }, [recentRequests]);

  const adminStats = [
    {
      label: userRole === 'admin' ? 'Tổng nhân viên' : 'Yêu cầu chờ xử lý',
      value: userRole === 'admin' ? summary.totalEmployees : summary.pendingRequests,
      icon: Users,
      iconBg: '#dbeafe',
      iconColor: '#0284c7',
      borderColor: '#0284c7',
    },
    {
      label: 'Yêu cầu hôm nay',
      value: summary.todayRequests,
      icon: Hourglass,
      iconBg: '#fef3c7',
      iconColor: '#f59e0b',
      borderColor: '#f59e0b',
    },
    {
      label: 'Đã duyệt tuần này',
      value: summary.weekApproved,
      icon: CheckCircle2,
      iconBg: '#d1fae5',
      iconColor: '#059669',
      borderColor: '#059669',
    },
    {
      label: 'Quá hạn xử lý',
      value: summary.overdueRequests,
      icon: AlertCircle,
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
      borderColor: '#dc2626',
    },
  ];

  return (
    <div className="space-y-5">
      <LeaveBalanceCards leaveBalance={leaveBalance} resetCarryOverDate={resetCarryOverDate} />
      {/* <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              border: '1px solid #e2ede9',
              borderTop: `3px solid ${stat.borderColor}`,
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                {stat.label}
              </p>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: stat.iconBg }}
              >
                <stat.icon size={18} style={{ color: stat.iconColor }} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold" style={{ color: '#203430' }}>
                {stat.value}
              </p>
              {stat.label.includes('tuần') && (
                <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                  <TrendingUp size={12} />
                  API thật
                </div>
              )}
            </div>
          </div>
        ))}
      </div> */}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Calendar card */}
        <div
          className="rounded-xl bg-white p-5 shadow-sm sm:p-6 lg:col-span-2"
          style={{ border: '1px solid #e2ede9' }}
        >
          {/* Navigation */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: '#203430' }}>
              Lịch nghỉ phép
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onPrevMonth}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronLeft size={15} />
              </button>
              <span
                className="min-w-[130px] text-center text-sm font-semibold"
                style={{ color: '#203430' }}
              >
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </span>
              <button
                onClick={onNextMonth}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-2.5 rounded-sm"
                style={{ background: '#dcfce7', borderLeft: '2px solid #16a34a' }}
              />
              <span className="text-xs text-gray-500">Đã duyệt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-2.5 rounded-sm"
                style={{ background: '#fef9c3', borderLeft: '2px solid #d97706' }}
              />
              <span className="text-xs text-gray-500">Chờ duyệt</span>
            </div>
            {birthdayData && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-2.5 rounded-sm"
                  style={{ background: '#fce7f3', borderLeft: '2px solid #ec4899' }}
                />
                <span className="text-xs text-gray-500">Sinh nhật</span>
              </div>
            )}
          </div>

          <CalendarGrid
            calendarDays={calendarDays}
            calendarData={calendarData}
            birthdayData={birthdayData}
            onDayClick={onOpenDayDetail}
          />
        </div>

        <div className="space-y-4">
          <div
            className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
            style={{ border: '1px solid #e2ede9' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: '#203430' }}>
                Chờ duyệt
              </h3>
              <Clock size={18} style={{ color: '#f59e0b' }} />
            </div>
            <p className="mb-2 text-3xl font-bold" style={{ color: '#203430' }}>
              {summary.pendingRequests}
            </p>
            <p className="text-xs text-muted-foreground">Yêu cầu cần xử lý ngay</p>
            <Link
              href="/dashboard/approval"
              className="mt-3 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#f59e0b' }}
            >
              Xem chi tiết →
            </Link>
          </div>

          {/* Birthday this month card */}
          {birthdayData && Object.values(birthdayData).flat().length > 0 && (
            <div
              className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
              style={{ border: '1px solid #e2ede9' }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#203430' }}>
                  🎂 Sinh nhật tháng này
                </h3>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {Object.entries(birthdayData)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .flatMap(([dateStr, people]) =>
                    people.map((p) => (
                      <div key={`${dateStr}-${p.id}`} className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{
                            background: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
                          }}
                        >
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-semibold truncate"
                            style={{ color: '#203430' }}
                          >
                            {p.name}
                          </p>
                          <p className="text-[10px]" style={{ color: '#6b7f78' }}>
                            {dateStr.slice(8, 10)}/{dateStr.slice(5, 7)}
                          </p>
                        </div>
                      </div>
                    )),
                  )}
              </div>
            </div>
          )}

          <div
            className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
            style={{ border: '1px solid #e2ede9' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: '#203430' }}>
                Tỉ lệ duyệt gần đây
              </h3>
              <TrendingUp size={18} style={{ color: '#059669' }} />
            </div>
            <p className="mb-2 text-3xl font-bold" style={{ color: '#203430' }}>
              {recentApprovalRate}%
            </p>
            <div className="mb-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${recentApprovalRate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Suy ra từ danh sách yêu cầu gần đây</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-xl bg-white p-5 shadow-sm sm:p-6"
        style={{ border: '1px solid #e2ede9' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: '#203430' }}>
            Yêu cầu gần đây
          </h2>
          <Link
            href="/dashboard/approval"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Xem tất cả →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '2px solid #e2ede9' }}>
                {[
                  'ID',
                  'Nhân viên',
                  'Loại nghỉ',
                  'Từ ngày',
                  'Đến ngày',
                  'Người duyệt',
                  'Trạng thái',
                  'Thao tác',
                ].map((header) => (
                  <th key={header} className={getRecentRequestHeaderClass(header)}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Chưa có yêu cầu gần đây.
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => {
                  const status = STATUS_CONFIG[normalizeStatus(request.status)];
                  const employeeName = getDisplayName(request.user);
                  const avatarUrl = getAvatarUrl(request.user?.avatar);
                  return (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-[#f7f7f7]"
                      style={{ borderBottom: '1px solid #f0f4f2' }}
                    >
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: '#203430' }}>
                        #{request.id}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={employeeName}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                              }}
                            >
                              {getInitials(employeeName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold"
                              style={{ color: '#203430' }}
                            >
                              {employeeName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#203430' }}>
                        {request.leaveType?.code || '-'}
                        {request.leaveType?.name ? ` - ${request.leaveType.name}` : ''}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-muted-foreground">
                        {formatDateVN(request.fromDate)}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-muted-foreground">
                        {formatDateVN(request.toDate)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#6b7f78' }}>
                        {request.approver?.fullName || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => onOpenDetail(request)}
                          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: '#1DB87A' }}
                        >
                          <Eye size={13} /> Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={onOpenRequestModal}
        className="fixed bottom-6 right-6 z-10 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-lg transition-all hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
        aria-label="Đăng ký nghỉ phép mới"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [birthdayData, setBirthdayData] = useState<BirthdayData>({});
  const [recentRequests, setRecentRequests] = useState<DashboardLeaveRequest[]>([]);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    date: string;
    users: CalendarData[string]['users'];
    holidays: CalendarData[string]['holidays'];
    birthdays?: CalendarDayBirthday[];
  } | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<EmployeeLeaveBalance | null>(null);
  const [resetCarryOverDate, setResetCarryOverDate] = useState<string>('03-31');
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
  const [leaveDefaultDate, setLeaveDefaultDate] = useState<string | undefined>(undefined);
  const [editLeaveData, setEditLeaveData] = useState<LeaveRequestData | null>(null);
  const [selectedRawRequest, setSelectedRawRequest] = useState<DashboardLeaveRequest | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCurrentUser = useCallback(async () => {
    setLoadingUser(true);

    try {
      const response = await apiClient.get<UserInfo>('/api/auth/me');
      setUserInfo(response.data);
    } catch {
      clearAuthSession();
      router.replace('/');
    } finally {
      setLoadingUser(false);
    }
  }, [router]);

  const loadLeaveBalance = useCallback(async () => {
    try {
      const [response, policyResponse] = await Promise.all([
        apiClient.get<BalanceApiRecord[]>('/api/leave-balances'),
        apiClient.get<{ resetCarryOverDate?: string }>('/api/settings/leave-policy').catch(() => ({ data: { resetCarryOverDate: undefined } })),
      ]);
      if (policyResponse.data?.resetCarryOverDate) {
        setResetCarryOverDate(policyResponse.data.resetCarryOverDate);
      }
      const records = response.data || [];
      const alRecord = records.find((r) => r.leaveType?.code === 'AL');
      if (alRecord) {
        setLeaveBalance({
          annualDays: Number(alRecord.annualDays),
          carryOverDays: Number(alRecord.carryOverDays),
          seniorityDays: Number(alRecord.seniorityDays),
          usedCarryOverDays: Number(alRecord.usedCarryOverDays ?? 0),
          compOffDays: Number(alRecord.compOffDays),
          wfhDays: Number(alRecord.wfhDays),
          usedDays: Number(alRecord.usedDays),
          usedCompOffDays: Number(alRecord.usedCompOffDays),
        });
      } else {
        setLeaveBalance(null);
      }
    } catch {
      setLeaveBalance(null);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [summaryResponse, calendarResponse, recentResponse] = await Promise.all([
        apiClient.get<DashboardSummary>('/api/dashboard/summary'),
        apiClient.get<CalendarData>(
          `/api/dashboard/calendar?year=${currentYear}&month=${currentMonth}&scope=global`,
        ),
        apiClient.get<DashboardLeaveRequest[]>('/api/dashboard/recent-requests?scope=global'),
      ]);

      setSummary(summaryResponse.data);
      setCalendarData(calendarResponse.data || {});
      setRecentRequests(recentResponse.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu dashboard từ API.');
      setCalendarData({});
      setRecentRequests([]);
    } finally {
      setLoadingData(false);
    }
  }, [currentMonth, currentYear]);

  const loadBirthdayData = useCallback(
    async (role: string) => {
      if (role !== 'HR' && role !== 'ADMIN') return;
      try {
        const response = await apiClient.get<BirthdayData>(
          `/api/users/birthdays?year=${currentYear}&month=${currentMonth}`,
        );
        setBirthdayData(response.data || {});
      } catch {
        setBirthdayData({});
      }
    },
    [currentMonth, currentYear],
  );

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (userInfo?.role) {
      void loadBirthdayData(userInfo.role);
    }
  }, [loadBirthdayData, userInfo?.role]);

  useEffect(() => {
    if (userInfo) {
      void loadLeaveBalance();
    }
  }, [loadLeaveBalance, userInfo]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((year) => year - 1);
      return;
    }

    setCurrentMonth((month) => month - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((year) => year + 1);
      return;
    }

    setCurrentMonth((month) => month + 1);
  };

  const handleOpenCalendarRequestDetail = useCallback(
    async (user: CalendarData[string]['users'][number]) => {
      if (!user.requestId) {
        setSelectedDayDetail(null);
        return;
      }

      try {
        const response = await apiClient.get<DashboardLeaveRequest>(
          `/api/leave-requests/${user.requestId}`,
        );
        setSelectedRawRequest(response.data);
        setSelectedDetail(toDetailData(response.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được chi tiết yêu cầu nghỉ phép.');
      } finally {
        setSelectedDayDetail(null);
      }
    },
    [],
  );

  const handleEditRequest = useCallback(async () => {
    if (!selectedRawRequest) return;
    const id = selectedRawRequest.id;
    setSelectedDetail(null);
    setSelectedRawRequest(null);

    try {
      const response = await apiClient.get<{
        id: string;
        fromDate: string;
        toDate: string;
        durationMode?: string | null;
        reason?: string | null;
        handoverPerson?: { id?: string | null } | null;
        leaveType?: { code?: string | null } | null;
        approver?: { id?: string | null } | null;
      }>(`/api/leave-requests/${id}`);
      const data = response.data;
      setEditLeaveData({
        id: String(data.id),
        typeCode: data.leaveType?.code || '',
        fromDate: data.fromDate?.slice(0, 10) || '',
        toDate: data.toDate?.slice(0, 10) || '',
        durationMode: (data.durationMode as import('@/lib/hr-utils').LeaveRequestMode) || 'FULL_DAY',
        reason: data.reason || '',
        handoverPersonId: data.handoverPerson?.id ? String(data.handoverPerson.id) : '',
        approverId: data.approver?.id ? String(data.approver.id) : '',
      });
      setIsLeaveRequestModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu yêu cầu.');
    }
  }, [selectedRawRequest]);

  const currentRole = toFrontendRole(userInfo?.role);
  const isLoading = loadingUser || (loadingData && !summary);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải dashboard...
      </div>
    );
  }

  if (!summary) {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: '#fecaca',
          background: '#fef2f2',
          color: '#b91c1c',
        }}
      >
        {error || 'Không có dữ liệu dashboard để hiển thị.'}
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: '#fde68a',
            background: '#fffbeb',
            color: '#92400e',
          }}
        >
          {error}
        </div>
      ) : null}

      {currentRole === 'employee' && summary.type === 'employee' ? (
        <EmployeeDashboard
          currentMonth={currentMonth}
          currentYear={currentYear}
          calendarData={calendarData}
          recentRequests={recentRequests}
          summary={summary.stats}
          leaveBalance={leaveBalance}
          resetCarryOverDate={resetCarryOverDate}
          onNextMonth={handleNextMonth}
          onOpenDetail={(request) => { setSelectedRawRequest(request); setSelectedDetail(toDetailData(request)); }}
          onOpenDayDetail={(date, users, holidays, birthdays) => {
            if (users.length === 0) {
              setLeaveDefaultDate(date);
              setIsLeaveRequestModalOpen(true);
            } else {
              setSelectedDayDetail({ date, users, holidays, birthdays });
            }
          }}
          onOpenRequestModal={() => { setLeaveDefaultDate(undefined); setIsLeaveRequestModalOpen(true); }}
          onPrevMonth={handlePrevMonth}
        />
      ) : (
        <AdminHRDashboard
          currentMonth={currentMonth}
          currentYear={currentYear}
          calendarData={calendarData}
          birthdayData={birthdayData}
          leaveBalance={leaveBalance}
          resetCarryOverDate={resetCarryOverDate}
          recentRequests={recentRequests}
          summary={
            summary.type === 'employee'
              ? {
                  totalEmployees: 0,
                  pendingRequests: 0,
                  todayRequests: 0,
                  weekApproved: 0,
                  overdueRequests: 0,
                }
              : summary.stats
          }
          userRole={currentRole === 'employee' ? 'manager' : currentRole}
          onNextMonth={handleNextMonth}
          onOpenDetail={(request) => { setSelectedRawRequest(request); setSelectedDetail(toDetailData(request)); }}
          onOpenDayDetail={(date, users, holidays, birthdays) => {
            if (users.length === 0) {
              setLeaveDefaultDate(date);
              setIsLeaveRequestModalOpen(true);
            } else {
              setSelectedDayDetail({ date, users, holidays, birthdays });
            }
          }}
          onOpenRequestModal={() => { setLeaveDefaultDate(undefined); setIsLeaveRequestModalOpen(true); }}
          onPrevMonth={handlePrevMonth}
        />
      )}

      <LeaveDetailModal
        data={selectedDetail}
        onClose={() => { setSelectedDetail(null); setSelectedRawRequest(null); }}
        onEdit={
          selectedRawRequest?.user?.id === userInfo?.id &&
          normalizeStatus(selectedRawRequest?.status) === 'pending'
            ? handleEditRequest
            : undefined
        }
      />
      <CalendarDayDetailModal
        date={selectedDayDetail?.date}
        users={selectedDayDetail?.users}
        holidays={selectedDayDetail?.holidays}
        birthdays={selectedDayDetail?.birthdays}
        onClose={() => setSelectedDayDetail(null)}
        onViewDetail={(user) => void handleOpenCalendarRequestDetail(user)}
        onAddLeave={() => {
          const date = selectedDayDetail?.date;
          setSelectedDayDetail(null);
          setLeaveDefaultDate(date);
          setIsLeaveRequestModalOpen(true);
        }}
      />

      <LeaveRequestModal
        isOpen={isLeaveRequestModalOpen}
        defaultDate={leaveDefaultDate}
        editData={editLeaveData}
        onClose={() => { setIsLeaveRequestModalOpen(false); setLeaveDefaultDate(undefined); setEditLeaveData(null); }}
        onSubmitSuccess={() => {
          setEditLeaveData(null);
          void loadDashboardData();
          void loadLeaveBalance();
        }}
      />
    </>
  );
}
