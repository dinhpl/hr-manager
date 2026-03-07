"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Hourglass,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import LeaveDetailModal, { LeaveDetailData } from "@/components/leave-detail-modal";

// ── Types ───────────────────────────────────────────────────────────────────
type UserRole = "admin" | "hr" | "employee";

interface UserInfo {
  username: string;
  role: UserRole;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CALENDAR_DATA: Record<string, { approved?: boolean; pending?: boolean }> = {
  "2026-02-10": { approved: true },
  "2026-02-11": { approved: true },
  "2026-02-25": { pending: true },
  "2026-02-28": { approved: true },
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

const RECENT_REQUESTS = [
  { id: "#001", type: "AL - Nghỉ phép năm", from: "25/02/2026", to: "25/02/2026", days: 1, status: "pending", userName: "Phạm Long Đĩnh" },
  { id: "#002", type: "SL - Nghỉ ốm", from: "20/02/2026", to: "21/02/2026", days: 2, status: "approved", userName: "Trương Hữu Đạt" },
  { id: "#003", type: "WFH - Làm từ xa", from: "15/02/2026", to: "15/02/2026", days: 1, status: "rejected", userName: "Lê Thị Bình" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Chờ duyệt", bg: "#fef3c7", color: "#d97706" },
  approved: { label: "Đã duyệt", bg: "#d1fae5", color: "#059669" },
  rejected: { label: "Từ chối", bg: "#fee2e2", color: "#dc2626" },
};

// ── Helper functions ────────────────────────────────────────────────────────────
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const days: { day: number; month: "prev" | "current" | "next"; dateStr: string }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month - 1 === 0 ? 12 : month - 1;
    const y = month - 1 === 0 ? year - 1 : year;
    days.push({ day: d, month: "prev", dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, month: "current", dateStr: `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}` });
  }
  
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const m = month + 1 === 13 ? 1 : month + 1;
    const y = month + 1 === 13 ? year + 1 : year;
    days.push({ day: i, month: "next", dateStr: `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}` });
  }
  return days;
}

function toDetailData(req: (typeof RECENT_REQUESTS)[0]): LeaveDetailData {
  return {
    id: req.id.replace("#", ""),
    typeCode: req.type.split(" - ")[0],
    fromDate: req.from,
    toDate: req.to,
    days: req.days,
    status: req.status,
    reason: "—",
  };
}

// ── Admin & HR Dashboard ─────────────────────────────────────────────────────────
function AdminHRDashboard({ userRole }: { userRole: UserRole }) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(2);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);

  const calendarDays = getCalendarDays(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Mock stats for admin/hr
  const ADMIN_STATS = [
    {
      label: userRole === "admin" ? "Tổng nhân viên" : "Yêu cầu chờ xử lý",
      value: userRole === "admin" ? 254 : 12,
      icon: Users,
      iconBg: "#dbeafe",
      iconColor: "#0284c7",
      borderColor: "#0284c7",
    },
    {
      label: "Yêu cầu hôm nay",
      value: 5,
      icon: Hourglass,
      iconBg: "#fef3c7",
      iconColor: "#f59e0b",
      borderColor: "#f59e0b",
    },
    {
      label: "Đã duyệt tuần này",
      value: 28,
      icon: CheckCircle2,
      iconBg: "#d1fae5",
      iconColor: "#059669",
      borderColor: "#059669",
    },
    {
      label: userRole === "admin" ? "Cảnh báo hệ thống" : "Từ chối",
      value: userRole === "admin" ? 3 : 2,
      icon: AlertCircle,
      iconBg: "#fee2e2",
      iconColor: "#dc2626",
      borderColor: "#dc2626",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ADMIN_STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-5 flex flex-col gap-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ border: "1px solid #e2ede9", borderTop: `3px solid ${s.borderColor}` }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">{s.label}</p>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold" style={{ color: "#203430" }}>{s.value}</p>
              {s.label.includes("tuần") && (
                <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                  <TrendingUp size={12} />
                  +12%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar - spans 2 cols on large screens */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <h2 className="font-bold text-base" style={{ color: "#203430" }}>
              Lịch — {MONTH_NAMES[currentMonth - 1]}/{currentYear}
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={prevMonth}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white flex-1 sm:flex-none"
                style={{ background: "#1DB87A" }}
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                onClick={nextMonth}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white flex-1 sm:flex-none"
                style={{ background: "#1DB87A" }}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#d1fae5" }} />
              <span className="text-xs text-muted-foreground">Đã duyệt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#fef3c7" }} />
              <span className="text-xs text-muted-foreground">Chờ duyệt</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEK_DAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-bold rounded-lg"
                    style={{ background: "#1DB87A", color: "#fff" }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  const data = CALENDAR_DATA[cell.dateStr];
                  const isApproved = data?.approved;
                  const isPending = data?.pending;
                  let bg = "transparent";
                  let textColor = cell.month === "current" ? "#203430" : "#c4d4cf";
                  if (isApproved) { bg = "#d1fae5"; textColor = "#059669"; }
                  if (isPending) { bg = "#fef3c7"; textColor = "#d97706"; }

                  return (
                    <div
                      key={idx}
                      className="aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-accent cursor-default"
                      style={{ background: bg, color: textColor }}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats sidebar */}
        <div className="space-y-4">
          {/* Pending approval card */}
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "#203430" }}>Chờ duyệt</h3>
              <Clock size={18} style={{ color: "#f59e0b" }} />
            </div>
            <p className="text-3xl font-bold mb-2" style={{ color: "#203430" }}>12</p>
            <p className="text-xs text-muted-foreground">Yêu cầu cần xử lý ngay</p>
            <Link href="/dashboard/approval" className="mt-3 inline-block text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-all hover:opacity-90" style={{ background: "#f59e0b" }}>
              Xem chi tiết →
            </Link>
          </div>

          {/* Approval rate card */}
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "#203430" }}>Tỉ lệ duyệt</h3>
              <TrendingUp size={18} style={{ color: "#059669" }} />
            </div>
            <p className="text-3xl font-bold mb-2" style={{ color: "#203430" }}>92%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: "92%" }} />
            </div>
            <p className="text-xs text-muted-foreground">So với tháng trước: +5%</p>
          </div>
        </div>
      </div>

      {/* Recent requests table */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base" style={{ color: "#203430" }}>Yêu cầu gần đây</h2>
          <Link href="/dashboard/approval" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Xem tất cả →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: "2px solid #e2ede9" }}>
                {["ID", "Nhân viên", "Loại nghỉ", "Từ ngày", "Đến ngày", "Trạng thái", "Thao tác"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_REQUESTS.map((req) => {
                const sc = STATUS_CONFIG[req.status];
                return (
                  <tr key={req.id} className="hover:bg-[#f7f7f7] transition-colors" style={{ borderBottom: "1px solid #f0f4f2" }}>
                    <td className="py-3 px-3 text-sm font-semibold" style={{ color: "#203430" }}>{req.id}</td>
                    <td className="py-3 px-3 text-sm" style={{ color: "#203430" }}>{req.userName}</td>
                    <td className="py-3 px-3 text-sm" style={{ color: "#203430" }}>{req.type}</td>
                    <td className="py-3 px-3 text-sm text-muted-foreground">{req.from}</td>
                    <td className="py-3 px-3 text-sm text-muted-foreground">{req.to}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedDetail(toDetailData(req))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: "#1DB87A" }}
                      >
                        <Eye size={13} /> Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave detail modal */}
      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}

// ── Employee Dashboard ──────────────────────────────────────────────────────────
function EmployeeDashboard() {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(2);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);

  const calendarDays = getCalendarDays(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Employee-specific stats
  const EMPLOYEE_STATS = [
    {
      label: "Phép còn lại (ngày)",
      value: 11,
      icon: CalendarCheck,
      iconBg: "#D3F2E7",
      iconColor: "#1DB87A",
      borderColor: "#1DB87A",
    },
    {
      label: "Chờ duyệt",
      value: 2,
      icon: Hourglass,
      iconBg: "#fef3c7",
      iconColor: "#f59e0b",
      borderColor: "#f59e0b",
    },
    {
      label: "Đã duyệt",
      value: 15,
      icon: CheckCircle2,
      iconBg: "#dbeafe",
      iconColor: "#3b82f6",
      borderColor: "#3b82f6",
    },
    {
      label: "Từ chối",
      value: 1,
      icon: XCircle,
      iconBg: "#fee2e2",
      iconColor: "#ef4444",
      borderColor: "#ef4444",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {EMPLOYEE_STATS.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl p-5 flex flex-col gap-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ border: "1px solid #e2ede9", borderTop: `3px solid ${s.borderColor}` }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">{s.label}</p>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: "#203430" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <h2 className="font-bold text-base" style={{ color: "#203430" }}>
              Lịch nghỉ phép — {MONTH_NAMES[currentMonth - 1]}/{currentYear}
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={prevMonth}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white flex-1 sm:flex-none"
                style={{ background: "#1DB87A" }}
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                onClick={nextMonth}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white flex-1 sm:flex-none"
                style={{ background: "#1DB87A" }}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#d1fae5" }} />
              <span className="text-xs text-muted-foreground">Đã duyệt</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#fef3c7" }} />
              <span className="text-xs text-muted-foreground">Chờ duyệt</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEK_DAYS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-xs font-bold rounded-lg"
                    style={{ background: "#1DB87A", color: "#fff" }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  const data = CALENDAR_DATA[cell.dateStr];
                  const isApproved = data?.approved;
                  const isPending = data?.pending;
                  let bg = "transparent";
                  let textColor = cell.month === "current" ? "#203430" : "#c4d4cf";
                  if (isApproved) { bg = "#d1fae5"; textColor = "#059669"; }
                  if (isPending) { bg = "#fef3c7"; textColor = "#d97706"; }

                  return (
                    <div
                      key={idx}
                      className="aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-accent cursor-default"
                      style={{ background: bg, color: textColor }}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-4">
          {/* Create request card */}
          <div className="bg-gradient-to-br rounded-xl shadow-sm p-5 sm:p-6 text-white" style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}>
            <h3 className="font-bold text-base mb-2">Đăng ký nghỉ phép</h3>
            <p className="text-sm mb-4 opacity-90">Tạo yêu cầu nghỉ phép mới cho bạn</p>
            <Link href="/dashboard/leave-request" className="inline-block text-xs font-semibold px-4 py-2 rounded-lg bg-white transition-all hover:shadow-lg" style={{ color: "#1DB87A" }}>
              Tạo yêu cầu →
            </Link>
          </div>

          {/* Balance info */}
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "#203430" }}>Thông tin chính</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Phép còn lại</p>
                <p className="text-2xl font-bold" style={{ color: "#1DB87A" }}>11 ngày</p>
              </div>
              <div style={{ height: "1px", background: "#e2ede9" }} />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Đã sử dụng năm nay</p>
                <p className="text-2xl font-bold" style={{ color: "#203430" }}>9 ngày</p>
              </div>
              <div style={{ height: "1px", background: "#e2ede9" }} />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kế tiếp</p>
                <p className="text-sm font-semibold" style={{ color: "#203430" }}>25/02/2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base" style={{ color: "#203430" }}>Yêu cầu gần đây</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: "2px solid #e2ede9" }}>
                {["ID", "Loại nghỉ", "Từ ngày", "Đến ngày", "Số ngày", "Trạng thái", "Thao tác"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_REQUESTS.map((req) => {
                const sc = STATUS_CONFIG[req.status];
                return (
                  <tr key={req.id} className="hover:bg-[#f7f7f7] transition-colors" style={{ borderBottom: "1px solid #f0f4f2" }}>
                    <td className="py-3 px-3 text-sm font-semibold" style={{ color: "#203430" }}>{req.id}</td>
                    <td className="py-3 px-3 text-sm" style={{ color: "#203430" }}>{req.type}</td>
                    <td className="py-3 px-3 text-sm text-muted-foreground">{req.from}</td>
                    <td className="py-3 px-3 text-sm text-muted-foreground">{req.to}</td>
                    <td className="py-3 px-3 text-sm font-medium" style={{ color: "#203430" }}>{req.days}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => setSelectedDetail(toDetailData(req))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: "#1DB87A" }}
                      >
                        <Eye size={13} /> Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave detail modal */}
      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      {/* FAB */}
      <Link
        href="/dashboard/leave-request"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 z-10"
        style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}
        aria-label="Đăng ký nghỉ phép mới"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("userInfo") || sessionStorage.getItem("userInfo");
    if (stored) {
      try {
        setUserInfo(JSON.parse(stored));
      } catch {
        setUserInfo(null);
      }
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const userRole: UserRole = userInfo?.role as UserRole || "employee";

  // Render based on role
  if (userRole === "employee") {
    return <EmployeeDashboard />;
  }

  // admin and hr share the same layout
  return <AdminHRDashboard userRole={userRole} />;
}
