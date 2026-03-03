"use client";

import { useState } from "react";
import { Clock, PlusCircle, Save, History, BedDouble, MinusCircle, Calculator } from "lucide-react";
import Link from "next/link";

const OT_HISTORY = [
  { date: "25/02/2026", hours: "3.0h", type: "Ngày thường", status: "pending" },
  { date: "22/02/2026", hours: "4.0h", type: "Cuối tuần", status: "approved" },
  { date: "18/02/2026", hours: "2.0h", type: "Ngày thường", status: "approved" },
  { date: "15/02/2026", hours: "1.5h", type: "Ngày thường", status: "rejected" },
];

const COMPOFF_ROWS = [
  { date: "22/02/2026", otHours: "4.0h", type: "Cuối tuần", compoff: "6.0h", expire: "22/05/2026", status: "available" },
  { date: "18/02/2026", otHours: "2.0h", type: "Ngày thường", compoff: "2.0h", expire: "18/05/2026", status: "available" },
  { date: "10/01/2026", otHours: "2.0h", type: "Ngày thường", compoff: "2.0h", expire: "10/04/2026", status: "expiring" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  rejected: "bg-red-50 text-red-500 border border-red-200",
  available: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  expiring: "bg-amber-50 text-amber-600 border border-amber-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Từ chối",
  available: "Có sẵn", expiring: "Sắp hết hạn",
};

function toMins(t: string) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function OvertimePage() {
  const [workDate, setWorkDate] = useState("2026-03-03");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("13:00");
  const [otType, setOtType] = useState("weekday");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const RATE: Record<string, number> = { weekday: 1, weekend: 1.5, holiday: 2 };
  const RATE_LABEL: Record<string, string> = {
    weekday: "Ngày thường (×1.0)",
    weekend: "Cuối tuần (×1.5)",
    holiday: "Ngày lễ (×2.0)",
  };

  const calcOT = () => {
    if (!startTime || !endTime) return null;
    let total = toMins(endTime) - toMins(startTime);
    if (lunchStart && lunchEnd) total -= toMins(lunchEnd) - toMins(lunchStart);
    if (total <= 0) return null;
    const otHrs = total / 60;
    const compoff = otHrs * RATE[otType];
    return { otHrs: otHrs.toFixed(1), compoff: compoff.toFixed(1) };
  };
  const calc = calcOT();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
          <Clock size={18} style={{ color: "#0E474E" }} />
        </div>
        <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Quản lý làm thêm giờ (Overtime)</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng OT tháng này", value: "24.5h", icon: Clock, color: "#3b82f6", bg: "#eff6ff" },
          { label: "OT chờ duyệt", value: "3.0h", icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
          { label: "Comp-off tích lũy", value: "16.5h", icon: PlusCircle, color: "#1DB87A", bg: "#f0fdf4" },
          { label: "Comp-off đã dùng", value: "8.0h", icon: MinusCircle, color: "#ef4444", bg: "#fef2f2" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border" style={{ borderColor: "#e2ede9" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: s.bg }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#203430" }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#6b7f78" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Two-col: form + history */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Registration form */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-5 pb-4 border-b" style={{ borderColor: "#e2ede9" }}>
            <PlusCircle size={17} style={{ color: "#1DB87A" }} />
            <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Đăng ký làm thêm giờ</h2>
          </div>

          {submitted && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: "#D3F2E7", color: "#0E474E" }}>
              Đã gửi đăng ký OT thành công!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#203430" }}>Ngày làm việc *</label>
              <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ borderColor: "#e2ede9", color: "#203430" }} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#203430" }}>Giờ bắt đầu *</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: "#e2ede9" }} required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#203430" }}>Giờ kết thúc *</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: "#e2ede9" }} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Nghỉ trưa từ</label>
                <input type="time" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: "#e2ede9" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Nghỉ trưa đến</label>
                <input type="time" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  style={{ borderColor: "#e2ede9" }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: "#203430" }}>Loại overtime *</label>
              <div className="flex gap-4">
                {[
                  { val: "weekday", label: "Ngày thường" },
                  { val: "weekend", label: "Cuối tuần" },
                  { val: "holiday", label: "Ngày lễ" },
                ].map((opt) => (
                  <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: "#203430" }}>
                    <input type="radio" name="otType" value={opt.val} checked={otType === opt.val}
                      onChange={() => setOtType(opt.val)} className="accent-[#1DB87A]" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Live calculation */}
            {calc && (
              <div className="rounded-lg p-3 border" style={{ background: "#f0fdf9", borderColor: "#D3F2E7" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calculator size={14} style={{ color: "#0E474E" }} />
                  <span className="text-xs font-semibold" style={{ color: "#0E474E" }}>Tính toán OT</span>
                </div>
                <div className="flex items-center justify-between text-center">
                  <div>
                    <p className="text-xl font-bold" style={{ color: "#1DB87A" }}>{calc.otHrs}h</p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>Giờ OT</p>
                  </div>
                  <p className="text-xs px-2 font-medium" style={{ color: "#0E474E" }}>{RATE_LABEL[otType]}</p>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "#0E474E" }}>{calc.compoff}h</p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>Comp-off nhận được</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#203430" }}>Lý do làm thêm giờ *</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Nhập lý do làm thêm giờ..."
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none"
                style={{ borderColor: "#e2ede9", color: "#203430" }} required />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "#1DB87A" }}>
                <PlusCircle size={15} /> Gửi đăng ký OT
              </button>
              <button type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: "#e2ede9", color: "#203430" }}>
                <Save size={15} /> Lưu nháp
              </button>
            </div>
          </form>
        </div>

        {/* OT History */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center justify-between mb-5 pb-4 border-b" style={{ borderColor: "#e2ede9" }}>
            <div className="flex items-center gap-2">
              <History size={17} style={{ color: "#1DB87A" }} />
              <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Lịch sử OT gần đây</h2>
            </div>
            <button className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "#D3F2E7", color: "#0E474E" }}>
              Xem tất cả
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                {["Ngày", "Giờ OT", "Loại", "Trạng thái"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OT_HISTORY.map((row, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                  <td className="px-3 py-3 text-xs font-medium" style={{ color: "#203430" }}>{row.date}</td>
                  <td className="px-3 py-3 text-xs font-bold" style={{ color: "#203430" }}>{row.hours}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>{row.type}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comp-off overview table */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2">
            <BedDouble size={17} style={{ color: "#1DB87A" }} />
            <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Tổng quan Comp-off</h2>
          </div>
          <Link href="/dashboard/compoff"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "#D3F2E7", color: "#0E474E" }}>
            Quản lý chi tiết
          </Link>
        </div>
        <div className="p-3 rounded-lg text-xs mb-4" style={{ background: "#f0fdf9", color: "#0E474E", border: "1px solid #D3F2E7" }}>
          <strong>Quy tắc tính Comp-off:</strong> Ngày thường: 1h OT = 1h nghỉ bù | Cuối tuần: 1h OT = 1.5h nghỉ bù | Ngày lễ: 1h OT = 2h nghỉ bù
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                {["Ngày OT", "Giờ OT", "Loại", "Comp-off tích lũy", "Hạn sử dụng", "Trạng thái"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPOFF_ROWS.map((row, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                  <td className="px-3 py-3 text-xs font-medium" style={{ color: "#203430" }}>{row.date}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>{row.otHours}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>{row.type}</td>
                  <td className="px-3 py-3 text-xs font-bold" style={{ color: "#1DB87A" }}>{row.compoff}</td>
                  <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>{row.expire}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
