"use client";

import { useState } from "react";
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
} from "lucide-react";
import LeaveDetailModal, { LeaveDetailData } from "@/components/leave-detail-modal";

// ── Stat cards ─────────────────────────────────────────────────────────────────
const STATS = [
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

// ── Calendar data ───────────────────────────────────────────────────────────────
const CALENDAR_DATA: Record<string, { approved?: boolean; pending?: boolean }> = {
  "2026-02-10": { approved: true },
  "2026-02-11": { approved: true },
  "2026-02-25": { pending: true },
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getCalendarDays(year: number, month: number) {
  // month: 1-based
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  // Adjust: Mon=0
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const days: { day: number; month: "prev" | "current" | "next"; dateStr: string }[] = [];

  // Prev month fill
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month - 1 === 0 ? 12 : month - 1;
    const y = month - 1 === 0 ? year - 1 : year;
    days.push({ day: d, month: "prev", dateStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, month: "current", dateStr: `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}` });
  }
  // Next month fill
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const m = month + 1 === 13 ? 1 : month + 1;
    const y = month + 1 === 13 ? year + 1 : year;
    days.push({ day: i, month: "next", dateStr: `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}` });
  }
  return days;
}

const MONTH_NAMES = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

// ── Recent requests ─────────────────────────────────────────────────────────────
const RECENT_REQUESTS = [
  { id: "#001", type: "AL - Nghỉ phép năm", from: "25/02/2026", to: "25/02/2026", days: 1, status: "pending" },
  { id: "#002", type: "SL - Nghỉ ốm", from: "20/02/2026", to: "21/02/2026", days: 2, status: "approved" },
  { id: "#003", type: "WFH - Làm từ xa", from: "15/02/2026", to: "15/02/2026", days: 1, status: "rejected" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "Chờ duyệt", bg: "#fef3c7", color: "#d97706" },
  approved: { label: "Đã duyệt", bg: "#d1fae5", color: "#059669" },
  rejected: { label: "Từ chối", bg: "#fee2e2", color: "#dc2626" },
};

/** Map recent request data to the normalized modal shape */
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

export default function DashboardPage() {
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

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
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

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6" style={{ border: "1px solid #e2ede9" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-base" style={{ color: "#203430" }}>
            Lịch nghỉ phép — {MONTH_NAMES[currentMonth - 1]}/{currentYear}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white"
              style={{ background: "#1DB87A" }}
            >
              <ChevronLeft size={14} /> Tháng trước
            </button>
            <button
              onClick={nextMonth}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 text-white"
              style={{ background: "#1DB87A" }}
            >
              Tháng sau <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
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
          <div className="min-w-[560px]">
            {/* Header row */}
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
            {/* Day rows */}
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
