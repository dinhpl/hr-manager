"use client";

import { useState } from "react";
import {
  CalendarCheck, PlusCircle, FileDown, Calculator,
  Clock, CheckCircle, AlertTriangle, XCircle,
  History, BarChart3, ChevronRight,
} from "lucide-react";

interface CompoffItem {
  id: string;
  date: string;
  otHours: number;
  otType: "weekday" | "weekend" | "holiday";
  compoffHours: number;
  usedHours: number;
  expireDate: string;
  expireDays: number;
  status: "available" | "expiring" | "expired" | "used";
  usageLog?: { date: string; desc: string }[];
}

const ITEMS: CompoffItem[] = [
  {
    id: "co1", date: "18/02/2026", otHours: 4.0, otType: "weekend",
    compoffHours: 6.0, usedHours: 0, expireDate: "18/05/2026", expireDays: 79,
    status: "available",
    usageLog: [
      { date: "22/02/2026", desc: "Tích lũy 6.0h comp-off từ 4.0h OT cuối tuần" },
    ],
  },
  {
    id: "co2", date: "10/01/2026", otHours: 2.0, otType: "weekday",
    compoffHours: 2.0, usedHours: 0, expireDate: "10/04/2026", expireDays: 41,
    status: "expiring",
    usageLog: [
      { date: "10/01/2026", desc: "Tích lũy 2.0h comp-off từ 2.0h OT ngày thường" },
    ],
  },
  {
    id: "co3", date: "22/02/2026", otHours: 3.0, otType: "weekend",
    compoffHours: 4.5, usedHours: 0.5, expireDate: "22/05/2026", expireDays: 83,
    status: "available",
    usageLog: [
      { date: "10/02/2026", desc: "Sử dụng 2.0h comp-off – Nghỉ nửa ngày (buổi chiều)" },
      { date: "22/02/2026", desc: "Tích lũy 4.5h comp-off từ 3.0h OT cuối tuần" },
    ],
  },
  {
    id: "co4", date: "15/02/2026", otHours: 2.0, otType: "weekday",
    compoffHours: 2.0, usedHours: 2.0, expireDate: "15/02/2026", expireDays: 0,
    status: "used",
    usageLog: [
      { date: "10/02/2026", desc: "Đã sử dụng: 10/02/2026 (Nửa ngày)" },
    ],
  },
  {
    id: "co5", date: "05/01/2026", otHours: 1.0, otType: "weekday",
    compoffHours: 1.0, usedHours: 0, expireDate: "05/04/2026", expireDays: -23,
    status: "expired",
    usageLog: [],
  },
];

const TIMELINE = [
  { date: "10/02/2026", text: "Sử dụng 2.0h comp-off – Nghỉ nửa ngày (buổi chiều)", type: "use" },
  { date: "22/02/2026", text: "Tích lũy 4.5h comp-off – Từ 3.0h OT cuối tuần", type: "earn" },
  { date: "18/02/2026", text: "Tích lũy 6.0h comp-off – Từ 4.0h OT cuối tuần", type: "earn" },
  { date: "05/04/2026", text: "Hết hạn 1.0h comp-off – Không sử dụng kịp thời", type: "expire" },
];

const OT_TYPE_LABEL: Record<string, string> = {
  weekday: "Ngày thường", weekend: "Cuối tuần", holiday: "Ngày lễ",
};

const OT_TYPE_COLOR: Record<string, string> = {
  weekday: "bg-blue-50 text-blue-600 border border-blue-200",
  weekend: "bg-purple-50 text-purple-600 border border-purple-200",
  holiday: "bg-orange-50 text-orange-600 border border-orange-200",
};

const STATUS_BORDER: Record<string, string> = {
  available: "#1DB87A", expiring: "#f59e0b", expired: "#ef4444", used: "#9ca3af",
};
const STATUS_BG: Record<string, string> = {
  available: "#f0fdf9", expiring: "#fffbeb", expired: "#fff5f5", used: "#f9fafb",
};
const STATUS_LABEL: Record<string, string> = {
  available: "Có sẵn", expiring: "Sắp hết hạn", expired: "Đã hết hạn", used: "Đã sử dụng",
};
const STATUS_BADGE: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  expiring: "bg-amber-50 text-amber-600 border border-amber-200",
  expired: "bg-red-50 text-red-500 border border-red-200",
  used: "bg-gray-100 text-gray-500 border border-gray-200",
};

export default function CompoffPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("expiry_asc");
  const [calcHours, setCalcHours] = useState("");
  const [calcType, setCalcType] = useState("weekday");
  const [calcResult, setCalcResult] = useState<number | null>(null);

  const RATE: Record<string, number> = { weekday: 1, weekend: 1.5, holiday: 2 };

  const filtered = ITEMS.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (typeFilter && item.otType !== typeFilter) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "expiry_asc") return a.expireDays - b.expireDays;
    if (sortBy === "expiry_desc") return b.expireDays - a.expireDays;
    if (sortBy === "hours_desc") return b.compoffHours - a.compoffHours;
    return 0;
  });

  const totalAccum = 24.5;
  const totalUsed = 8.0;
  const totalLeft = 16.5;
  const totalExpiring = 3.0;
  const usedPct = Math.round((totalUsed / totalAccum) * 100);
  const leftPct = Math.round((totalLeft / totalAccum) * 100);
  const expiringPct = Math.round((totalExpiring / totalAccum) * 100);
  const availPct = Math.round(((totalLeft) / totalAccum) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <CalendarCheck size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Quản lý nghỉ bù (Comp-off)</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#1DB87A" }}>
            <PlusCircle size={14} /> Đăng ký nghỉ bù
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <FileDown size={14} /> Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <Calculator size={14} /> Tính toán
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng tích lũy", value: `${totalAccum}h`, icon: PlusCircle, color: "#1DB87A", bg: "#f0fdf9" },
          { label: "Còn lại", value: `${totalLeft}h`, icon: Clock, color: "#3b82f6", bg: "#eff6ff" },
          { label: "Đã sử dụng", value: `${totalUsed}h`, icon: CheckCircle, color: "#f59e0b", bg: "#fffbeb" },
          { label: "Sắp hết hạn", value: `${totalExpiring}h`, icon: AlertTriangle, color: "#ef4444", bg: "#fef2f2" },
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

      {/* Usage progress bar */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
        <h2 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>Tình trạng sử dụng comp-off</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "#6b7f78" }}>
              <span>Đã sử dụng</span>
              <span className="font-semibold" style={{ color: "#203430" }}>{totalUsed}h / {totalAccum}h ({usedPct}%)</span>
            </div>
            <div className="flex h-5 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
              <div className="h-full flex items-center justify-center text-white text-xs font-medium" style={{ width: `${usedPct}%`, background: "#f59e0b" }}>
                {totalUsed}h
              </div>
              <div className="h-full flex items-center justify-center text-white text-xs font-medium" style={{ width: `${leftPct}%`, background: "#1DB87A" }}>
                {totalLeft}h
              </div>
              <div className="h-full flex items-center justify-center text-white text-xs font-medium" style={{ width: `${expiringPct}%`, background: "#ef4444" }}>
                {totalExpiring}h
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                { label: "Đã sử dụng", val: `${totalUsed}h`, color: "#f59e0b" },
                { label: "Còn lại", val: `${totalLeft}h`, color: "#1DB87A" },
                { label: "Sắp hết hạn", val: `${totalExpiring}h`, color: "#ef4444" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-bold text-sm" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-xs" style={{ color: "#6b7f78" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Circle indicator */}
          <div className="flex-shrink-0 w-20 h-20 rounded-full flex flex-col items-center justify-center border-4"
            style={{ borderColor: "#1DB87A", background: "#f0fdf9" }}>
            <span className="text-xl font-bold" style={{ color: "#0E474E" }}>{availPct}%</span>
            <span className="text-xs" style={{ color: "#6b7f78" }}>Khả dụng</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#e2ede9" }}>
        <div className="flex flex-wrap gap-3">
          {[
            { id: "status", label: "Trạng thái", value: statusFilter, onChange: setStatusFilter,
              options: [["", "Tất cả"], ["available", "Có sẵn"], ["expiring", "Sắp hết hạn"], ["expired", "Đã hết hạn"], ["used", "Đã sử dụng"]] },
            { id: "type", label: "Loại OT gốc", value: typeFilter, onChange: setTypeFilter,
              options: [["", "Tất cả"], ["weekday", "Ngày thường"], ["weekend", "Cuối tuần"], ["holiday", "Ngày lễ"]] },
            { id: "sort", label: "Sắp xếp", value: sortBy, onChange: setSortBy,
              options: [["expiry_asc", "Hết hạn sớm nhất"], ["expiry_desc", "Hết hạn muộn nhất"], ["hours_desc", "Giờ nhiều nhất"]] },
          ].map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>{f.label}</label>
              <select value={f.value} onChange={(e) => f.onChange(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[160px]"
                style={{ borderColor: "#e2ede9", color: "#203430" }}>
                {f.options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            </div>
          ))}
          <div className="ml-auto self-end">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#1DB87A" }}>
              Tìm kiếm
            </button>
          </div>
        </div>
      </div>

      {/* Main two-col: item list + sidebar */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Comp-off item list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Chi tiết comp-off</h2>
          {filtered.map((item) => {
            const remaining = item.compoffHours - item.usedHours;
            const usedPctItem = item.compoffHours > 0 ? Math.round((item.usedHours / item.compoffHours) * 100) : 0;
            return (
              <div key={item.id}
                className="rounded-xl border-l-4 p-4"
                style={{
                  borderLeftColor: STATUS_BORDER[item.status],
                  background: STATUS_BG[item.status],
                  border: `1px solid #e2ede9`,
                  borderLeft: `4px solid ${STATUS_BORDER[item.status]}`,
                  opacity: item.status === "expired" ? 0.7 : 1,
                }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  {/* Circle hours */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: STATUS_BORDER[item.status] }}>
                    {item.compoffHours}h
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: "#203430" }}>
                        Overtime ngày {item.date}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${OT_TYPE_COLOR[item.otType]}`}>
                        {OT_TYPE_LABEL[item.otType]}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      {item.otHours}h OT × {item.otType === "weekday" ? "1.0" : item.otType === "weekend" ? "1.5" : "2.0"} ({OT_TYPE_LABEL[item.otType]})
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs">
                  <div className="flex items-center gap-1" style={{ color: "#6b7f78" }}>
                    <CalendarCheck size={12} />
                    <span>Hạn sử dụng: {item.expireDate}</span>
                    {item.expireDays > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: item.expireDays < 50 ? "#fffbeb" : "#f0fdf9", color: item.expireDays < 50 ? "#f59e0b" : "#1DB87A" }}>
                        Còn {item.expireDays} ngày
                      </span>
                    )}
                    {item.expireDays < 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "#fef2f2", color: "#ef4444" }}>
                        Hết hạn {Math.abs(item.expireDays)} ngày trước
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: "#6b7f78" }}>
                    <span>Đã sử dụng</span>
                    <span className="font-medium">{item.usedHours}h / {item.compoffHours}h</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#e2ede9" }}>
                    <div className="h-full rounded-full" style={{ width: `${usedPctItem}%`, background: STATUS_BORDER[item.status] }} />
                  </div>
                </div>

                {/* Actions */}
                {item.status !== "expired" && item.status !== "used" && (
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#1DB87A" }}>
                      Sử dụng
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                      Lịch sử
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
                      OT gốc
                    </button>
                  </div>
                )}
                {(item.status === "expired" || item.status === "used") && (
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
                      Lịch sử
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
                      OT gốc
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Calculator */}
          <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #0E474E 0%, #1DB87A 100%)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} className="text-white" />
              <h3 className="font-semibold text-sm">Tính toán Comp-off</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Giờ overtime</label>
                <input type="number" step="0.5" min="0" value={calcHours} onChange={(e) => setCalcHours(e.target.value)}
                  placeholder="Nhập số giờ OT"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Loại ngày</label>
                <select value={calcType} onChange={(e) => setCalcType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}>
                  <option value="weekday" style={{ color: "#203430" }}>Ngày thường (×1.0)</option>
                  <option value="weekend" style={{ color: "#203430" }}>Cuối tuần (×1.5)</option>
                  <option value="holiday" style={{ color: "#203430" }}>Ngày lễ (×2.0)</option>
                </select>
              </div>
              <div className="py-2">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Comp-off nhận được:</p>
                <p className="text-2xl font-bold">
                  {calcHours ? (parseFloat(calcHours) * RATE[calcType]).toFixed(1) : "0"}h
                </p>
              </div>
              <button onClick={() => setCalcResult(calcHours ? parseFloat(calcHours) * RATE[calcType] : 0)}
                className="w-full py-2 rounded-lg text-sm font-semibold" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                Tính toán
              </button>
            </div>
          </div>

          {/* Usage timeline */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
            <div className="flex items-center gap-2 mb-4">
              <History size={16} style={{ color: "#1DB87A" }} />
              <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Lịch sử sử dụng gần đây</h3>
            </div>
            <div className="relative pl-5">
              <div className="absolute left-2 top-0 bottom-0 w-0.5" style={{ background: "#e2ede9" }} />
              {TIMELINE.map((t, i) => (
                <div key={i} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-3.5 top-1 w-3 h-3 rounded-full border-2 border-white"
                    style={{ background: t.type === "earn" ? "#1DB87A" : t.type === "use" ? "#3b82f6" : "#ef4444" }} />
                  <p className="text-xs font-semibold" style={{ color: "#203430" }}>{t.date}</p>
                  <p className="text-xs mt-0.5 leading-relaxed"
                    style={{ color: t.type === "expire" ? "#ef4444" : "#6b7f78" }}>{t.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} style={{ color: "#1DB87A" }} />
              <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Thống kê nhanh</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Tổng OT tháng này", val: "45.5h", color: "#1DB87A" },
                { label: "Comp-off tích lũy", val: "22.5h", color: "#3b82f6" },
                { label: "Đã sử dụng", val: "8.0h", color: "#f59e0b" },
                { label: "Đã hết hạn", val: "1.0h", color: "#ef4444" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#6b7f78" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
