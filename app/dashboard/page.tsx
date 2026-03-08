'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Hourglass,
  Plus,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import LeaveDetailModal, { LeaveDetailData } from '@/components/leave-detail-modal';
import LeaveRequestModal from '@/components/leave-request-modal';
import { apiClient, clearAuthSession } from '@/lib/api-client';
import { formatDateTimeVN, formatDateVN, numberValue, toFrontendRole } from '@/lib/hr-utils';
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
type CalendarData = Record<string, { users: { name: string; status: 'approved' | 'pending' }[] }>;

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

interface SharedDashboardProps {
  currentMonth: number;
  currentYear: number;
  calendarData: CalendarData;
  recentRequests: DashboardLeaveRequest[];
  onNextMonth: () => void;
  onOpenDetail: (request: DashboardLeaveRequest) => void;
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
  return user?.fullName?.trim() || 'Nhân viên';
}

function toDetailData(request: DashboardLeaveRequest): LeaveDetailData {
  return {
    id: String(request.id),
    typeCode: request.leaveType?.code || '-',
    typeColor: request.leaveType?.color || undefined,
    fromDate: formatDateVN(request.fromDate),
    toDate: formatDateVN(request.toDate),
    days: numberValue(request.totalDays),
    reason: request.reason || '—',
    status: normalizeStatus(request.status),
    submittedAt: formatDateTimeVN(request.createdAt),
    approver: request.approver?.fullName || undefined,
    approvedAt: request.approvedAt ? formatDateTimeVN(request.approvedAt) : undefined,
    employeeName: request.user?.fullName || undefined,
  };
}

// Shared Google-Calendar-style calendar grid
function CalendarGrid({
  calendarData,
  calendarDays,
}: {
  calendarData: CalendarData;
  calendarDays: ReturnType<typeof getCalendarDays>;
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
            const hasPending = users.some((u) => u.status === 'pending');
            const isToday = cell.dateStr === todayStr;
            const isCurrentMonth = cell.month === 'current';

            return (
              <div
                key={`${cell.dateStr}-${index}`}
                className="flex min-h-[88px] flex-col gap-0.5 border-b border-r border-gray-100 p-1.5 transition-colors hover:bg-gray-50/50"
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
                {/* Event chips */}
                {isCurrentMonth &&
                  users.slice(0, 3).map((u, i) => (
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
                {/* Overflow */}
                {isCurrentMonth && users.length > 3 && (
                  <span className="pl-1 text-[9px] font-medium text-gray-400">
                    +{users.length - 3} khác
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

function EmployeeDashboard({
  currentMonth,
  currentYear,
  calendarData,
  recentRequests,
  summary,
  onNextMonth,
  onOpenDetail,
  onOpenRequestModal,
  onPrevMonth,
}: SharedDashboardProps & { summary: DashboardEmployeeSummary['stats'] }) {
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
        const fromDate = new Date(request.fromDate);
        return fromDate >= today && status !== 'rejected' && status !== 'cancelled';
      })
      .sort(
        (left, right) => new Date(left.fromDate).getTime() - new Date(right.fromDate).getTime(),
      )[0];
  }, [recentRequests]);

  const employeeStats = [
    {
      label: 'Phép còn lại (ngày)',
      value: summary.remainingLeaveDays,
      icon: CalendarCheck,
      iconBg: '#D3F2E7',
      iconColor: '#1DB87A',
      borderColor: '#1DB87A',
    },
    {
      label: 'Chờ duyệt',
      value: summary.pendingRequests,
      icon: Hourglass,
      iconBg: '#fef3c7',
      iconColor: '#f59e0b',
      borderColor: '#f59e0b',
    },
    {
      label: 'Đã duyệt',
      value: summary.approvedRequests,
      icon: CheckCircle2,
      iconBg: '#dbeafe',
      iconColor: '#3b82f6',
      borderColor: '#3b82f6',
    },
    {
      label: 'Từ chối',
      value: summary.rejectedRequests,
      icon: XCircle,
      iconBg: '#fee2e2',
      iconColor: '#ef4444',
      borderColor: '#ef4444',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {employeeStats.map((stat) => (
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
            <p className="text-3xl font-bold" style={{ color: '#203430' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

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
          <div className="mb-3 flex items-center gap-4">
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

          <CalendarGrid calendarDays={calendarDays} calendarData={calendarData} />
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
              Thông tin chính
            </h3>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Phép còn lại</p>
                <p className="text-2xl font-bold" style={{ color: '#1DB87A' }}>
                  {summary.remainingLeaveDays} ngày
                </p>
              </div>
              <div style={{ height: '1px', background: '#e2ede9' }} />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Đã sử dụng năm nay</p>
                <p className="text-2xl font-bold" style={{ color: '#203430' }}>
                  {summary.usedLeaveDays} ngày
                </p>
              </div>
              <div style={{ height: '1px', background: '#e2ede9' }} />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Kế tiếp</p>
                <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                  {nextUpcoming ? formatDateVN(nextUpcoming.fromDate) : 'Chưa có lịch sắp tới'}
                </p>
              </div>
            </div>
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
                  'Loại nghỉ',
                  'Từ ngày',
                  'Đến ngày',
                  'Số ngày',
                  'Trạng thái',
                  'Thao tác',
                ].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Chưa có yêu cầu gần đây.
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => {
                  const status = STATUS_CONFIG[normalizeStatus(request.status)];
                  return (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-[#f7f7f7]"
                      style={{ borderBottom: '1px solid #f0f4f2' }}
                    >
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: '#203430' }}>
                        #{request.id}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#203430' }}>
                        {request.leaveType?.code || '-'}
                        {request.leaveType?.name ? ` - ${request.leaveType.name}` : ''}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {formatDateVN(request.fromDate)}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {formatDateVN(request.toDate)}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium" style={{ color: '#203430' }}>
                        {numberValue(request.totalDays)}
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
  onNextMonth,
  onOpenDetail,
  onOpenRequestModal,
  onPrevMonth,
}: SharedDashboardProps & {
  summary: DashboardManagerSummary['stats'];
  userRole: Exclude<UserRole, 'employee'>;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

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
          <div className="mb-3 flex items-center gap-4">
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

          <CalendarGrid calendarDays={calendarDays} calendarData={calendarData} />
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
                  'Trạng thái',
                  'Thao tác',
                ].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Chưa có yêu cầu gần đây.
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => {
                  const status = STATUS_CONFIG[normalizeStatus(request.status)];
                  return (
                    <tr
                      key={request.id}
                      className="transition-colors hover:bg-[#f7f7f7]"
                      style={{ borderBottom: '1px solid #f0f4f2' }}
                    >
                      <td className="px-3 py-3 text-sm font-semibold" style={{ color: '#203430' }}>
                        #{request.id}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#203430' }}>
                        {getDisplayName(request.user)}
                      </td>
                      <td className="px-3 py-3 text-sm" style={{ color: '#203430' }}>
                        {request.leaveType?.code || '-'}
                        {request.leaveType?.name ? ` - ${request.leaveType.name}` : ''}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {formatDateVN(request.fromDate)}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {formatDateVN(request.toDate)}
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
  const [recentRequests, setRecentRequests] = useState<DashboardLeaveRequest[]>([]);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
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

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [summaryResponse, calendarResponse, recentResponse] = await Promise.all([
        apiClient.get<DashboardSummary>('/api/dashboard/summary'),
        apiClient.get<CalendarData>(
          `/api/dashboard/calendar?year=${currentYear}&month=${currentMonth}`,
        ),
        apiClient.get<DashboardLeaveRequest[]>('/api/dashboard/recent-requests'),
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

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

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
          onNextMonth={handleNextMonth}
          onOpenDetail={(request) => setSelectedDetail(toDetailData(request))}
          onOpenRequestModal={() => setIsLeaveRequestModalOpen(true)}
          onPrevMonth={handlePrevMonth}
        />
      ) : (
        <AdminHRDashboard
          currentMonth={currentMonth}
          currentYear={currentYear}
          calendarData={calendarData}
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
          onOpenDetail={(request) => setSelectedDetail(toDetailData(request))}
          onOpenRequestModal={() => setIsLeaveRequestModalOpen(true)}
          onPrevMonth={handlePrevMonth}
        />
      )}

      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      <LeaveRequestModal
        isOpen={isLeaveRequestModalOpen}
        onClose={() => setIsLeaveRequestModalOpen(false)}
        onSubmitSuccess={() => {
          void loadDashboardData();
        }}
      />
    </>
  );
}
