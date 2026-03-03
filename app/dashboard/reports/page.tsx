"use client";

import { useState } from "react";
import {
  BarChart2, FileText, FileDown, FilePieChart,
  TrendingUp, TrendingDown, Minus, Search, Eye,
  Building2, Trophy,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from "recharts";

const TREND_DATA = [
  { month: "Jan", annual: 42, sick: 18, wfh: 12 },
  { month: "Feb", annual: 38, sick: 22, wfh: 15 },
  { month: "Mar", annual: 55, sick: 14, wfh: 18 },
  { month: "Apr", annual: 48, sick: 20, wfh: 22 },
  { month: "May", annual: 52, sick: 16, wfh: 25 },
  { month: "Jun", annual: 46, sick: 12, wfh: 20 },
  { month: "Jul", annual: 50, sick: 10, wfh: 18 },
  { month: "Aug", annual: 44, sick: 14, wfh: 16 },
  { month: "Sep", annual: 38, sick: 18, wfh: 14 },
  { month: "Oct", annual: 42, sick: 20, wfh: 12 },
  { month: "Nov", annual: 36, sick: 16, wfh: 10 },
  { month: "Dec", annual: 40, sick: 22, wfh: 8 },
];

const DEPT_PIE_DATA = [
  { name: "IT", value: 342, color: "#3b82f6" },
  { name: "Marketing", value: 298, color: "#f59e0b" },
  { name: "Sales", value: 256, color: "#1DB87A" },
  { name: "HR", value: 142, color: "#06b6d4" },
  { name: "Finance", value: 207, color: "#8b5cf6" },
];

const DEPT_CARDS = [
  { code: "IT", label: "Công nghệ thông tin", count: 45, days: 342, ot: "156h", compoff: "78h", rate: 95, usage: 76, color: "#3b82f6", bg: "#eff6ff" },
  { code: "Marketing", label: "Marketing", count: 32, days: 298, ot: "124h", compoff: "62h", rate: 92, usage: 82, color: "#f59e0b", bg: "#fffbeb" },
  { code: "Sales", label: "Kinh doanh", count: 28, days: 256, ot: "98h", compoff: "49h", rate: 88, usage: 68, color: "#1DB87A", bg: "#f0fdf9" },
  { code: "HR", label: "Nhân sự", count: 15, days: 142, ot: "45h", compoff: "22h", rate: 97, usage: 71, color: "#06b6d4", bg: "#ecfeff" },
];

const TOP_USERS = [
  { rank: 1, name: "Nguyễn Văn A", dept: { label: "Marketing", color: "#f59e0b", bg: "#fffbeb" }, days: 18, pct: 90 },
  { rank: 2, name: "Trần Thị B", dept: { label: "Sales", color: "#1DB87A", bg: "#f0fdf9" }, days: 16, pct: 80 },
  { rank: 3, name: "Lê Văn C", dept: { label: "IT", color: "#3b82f6", bg: "#eff6ff" }, days: 15, pct: 75 },
  { rank: 4, name: "Phạm Thị D", dept: { label: "HR", color: "#06b6d4", bg: "#ecfeff" }, days: 14, pct: 70 },
  { rank: 5, name: "Hoàng Văn E", dept: { label: "Finance", color: "#8b5cf6", bg: "#f5f3ff" }, days: 13, pct: 65 },
];

const LEAVE_TYPES = [
  { code: "AL", label: "Nghỉ phép năm", days: 645, pct: 52, color: "#3b82f6" },
  { code: "SL", label: "Nghỉ phép ốm", days: 234, pct: 19, color: "#10b981" },
  { code: "WFH", label: "Làm việc tại nhà", days: 189, pct: 15, color: "#8b5cf6" },
  { code: "ML", label: "Nghỉ thai sản", days: 90, pct: 7, color: "#f97316" },
  { code: "PL", label: "Nghỉ việc riêng", days: 87, pct: 7, color: "#6b7280" },
];

const MONTHLY_TABLE = [
  { month: "02/2026", total: 45, approved: 42, rejected: 3, days: 89, ot: "156.5", compoff: "78.5", rate: 93.3 },
  { month: "01/2026", total: 52, approved: 48, rejected: 4, days: 102, ot: "189.0", compoff: "94.5", rate: 92.3 },
  { month: "12/2025", total: 38, approved: 35, rejected: 3, days: 78, ot: "145.5", compoff: "72.5", rate: 92.1 },
  { month: "11/2025", total: 41, approved: 37, rejected: 4, days: 85, ot: "167.0", compoff: "83.5", rate: 90.2 },
];

const RATE_COLOR = (r: number) => r >= 95 ? "#1DB87A" : r >= 90 ? "#f59e0b" : "#ef4444";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("leave-summary");
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-02-28");
  const [deptFilter, setDeptFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <BarChart2 size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Báo cáo &amp; Thống kê</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#1DB87A" }}>
            <FileText size={14} /> Tạo báo cáo
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <FileDown size={14} /> Export Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#ef4444", color: "#ef4444" }}>
            <FilePieChart size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={14} style={{ color: "#1DB87A" }} />
          <span className="font-semibold text-sm" style={{ color: "#203430" }}>Bộ lọc báo cáo</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Loại báo cáo</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[200px]"
              style={{ borderColor: "#e2ede9", color: "#203430" }}>
              <option value="leave-summary">Tổng quan nghỉ phép</option>
              <option value="leave-detail">Chi tiết nghỉ phép</option>
              <option value="overtime-summary">Tổng quan overtime</option>
              <option value="department-analysis">Phân tích theo phòng ban</option>
              <option value="employee-performance">Hiệu suất nhân viên</option>
              <option value="leave-trend">Xu hướng nghỉ phép</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Từ ngày</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: "#e2ede9", color: "#203430" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Đến ngày</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ borderColor: "#e2ede9", color: "#203430" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Phòng ban</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[130px]"
              style={{ borderColor: "#e2ede9", color: "#203430" }}>
              <option value="">Tất cả</option>
              <option value="IT">IT</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Nhóm</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[130px]"
              style={{ borderColor: "#e2ede9", color: "#203430" }}>
              <option value="">Tất cả</option>
              <option value="Backend">Backend Team</option>
              <option value="Frontend">Frontend Team</option>
              <option value="QA">QA Team</option>
              <option value="Marketing">Marketing Team</option>
            </select>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white self-end"
            style={{ background: "#1DB87A" }}>
            <Search size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng ngày nghỉ", value: "1,245", sub: "+12%", trend: "up", gradFrom: "#0E474E", gradTo: "#1DB87A" },
          { label: "Yêu cầu đã duyệt", value: "892", sub: "+8%", trend: "up", gradFrom: "#059669", gradTo: "#34d399" },
          { label: "Tổng overtime", value: "456.5h", sub: "-5%", trend: "down", gradFrom: "#d97706", gradTo: "#fbbf24", dark: false },
          { label: "Comp-off tích lũy", value: "234.5h", sub: "0%", trend: "neutral", gradFrom: "#0891b2", gradTo: "#a5f3fc", dark: false },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-5 text-white"
            style={{ background: `linear-gradient(135deg, ${k.gradFrom} 0%, ${k.gradTo} 100%)` }}>
            <p className="text-3xl font-bold mb-2" style={{ color: k.dark === false ? "#1f2937" : "white" }}>{k.value}</p>
            <div className="flex items-center gap-1.5">
              {k.trend === "up" && <TrendingUp size={14} className="text-green-200" />}
              {k.trend === "down" && <TrendingDown size={14} className="text-red-300" />}
              {k.trend === "neutral" && <Minus size={14} className="opacity-70" />}
              <span className="text-xs opacity-80" style={{ color: k.dark === false ? "#374151" : "rgba(255,255,255,0.85)" }}>
                {k.label}
              </span>
              <span className="text-xs font-semibold ml-1"
                style={{ color: k.dark === false ? (k.trend === "up" ? "#059669" : k.trend === "down" ? "#dc2626" : "#6b7280") : "rgba(255,255,255,0.9)" }}>
                {k.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Line chart: 12-month trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} style={{ color: "#1DB87A" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Xu hướng nghỉ phép 12 tháng</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={TREND_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f2" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7f78" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7f78" }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2ede9", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="annual" name="Nghỉ phép năm" stroke="#1DB87A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sick" name="Nghỉ ốm" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wfh" name="WFH" stroke="#9ca3af" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut: department distribution */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <FilePieChart size={15} style={{ color: "#1DB87A" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Phân bố theo phòng ban</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={DEPT_PIE_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" paddingAngle={3}>
                {DEPT_PIE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <PieTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2ede9", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {DEPT_PIE_DATA.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: "#6b7f78" }}>
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department analysis cards */}
      <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={15} style={{ color: "#1DB87A" }} />
          <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Phân tích chi tiết theo phòng ban</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {DEPT_CARDS.map((d) => (
            <div key={d.code} className="rounded-xl border p-4 hover:shadow-sm transition-all"
              style={{ borderColor: "#e2ede9", borderLeft: `4px solid ${d.color}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: d.color }}>
                    {d.code}
                  </span>
                  <span className="font-semibold text-sm" style={{ color: "#203430" }}>{d.label}</span>
                </div>
                <span className="text-xs" style={{ color: "#6b7f78" }}>{d.count} nhân viên</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                {[
                  { val: d.days, label: "Ngày nghỉ", color: d.color },
                  { val: d.ot, label: "Overtime", color: "#1DB87A" },
                  { val: d.compoff, label: "Comp-off", color: "#f59e0b" },
                  { val: `${d.rate}%`, label: "Tỷ lệ duyệt", color: "#06b6d4" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-lg font-bold" style={{ color: m.color }}>{m.val}</p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>{m.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "#6b7f78" }}>
                  <span>Tỷ lệ sử dụng phép:</span>
                  <span className="font-semibold">{d.usage}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                  <div className="h-full rounded-full" style={{ width: `${d.usage}%`, background: d.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom two columns */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top 10 users */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} style={{ color: "#f59e0b" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Top 10 nhân viên nghỉ phép nhiều nhất</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                {["#", "Nhân viên", "Phòng ban", "Số ngày", "%"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_USERS.map((u) => (
                <tr key={u.rank} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                  <td className="px-3 py-3 text-xs font-bold" style={{ color: u.rank <= 3 ? "#f59e0b" : "#6b7f78" }}>
                    {u.rank}
                  </td>
                  <td className="px-3 py-3 text-xs font-medium" style={{ color: "#203430" }}>{u.name}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ background: u.dept.bg, color: u.dept.color }}>{u.dept.label}</span>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold" style={{ color: "#203430" }}>{u.days}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                        <div className="h-full rounded-full" style={{ width: `${u.pct}%`, background: "#1DB87A" }} />
                      </div>
                      <span className="text-xs font-semibold min-w-[32px]" style={{ color: "#203430" }}>{u.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Leave type breakdown */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} style={{ color: "#1DB87A" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Phân tích theo loại nghỉ phép</h3>
          </div>
          <div className="space-y-3">
            {LEAVE_TYPES.map((t) => (
              <div key={t.code} className="flex items-center gap-3">
                <span className="w-12 text-xs font-bold text-white px-1 py-0.5 rounded text-center flex-shrink-0"
                  style={{ background: t.color }}>{t.code}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "#203430" }}>{t.label}</span>
                    <span className="font-semibold" style={{ color: "#203430" }}>{t.days} ngày ({t.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                    <div className="h-full rounded-full" style={{ width: `${t.pct * 1.9}%`, background: t.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly detail table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "#e2ede9" }}>
          <BarChart2 size={15} style={{ color: "#1DB87A" }} />
          <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Báo cáo chi tiết theo tháng</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#203430" }}>
                {["Tháng", "Tổng yêu cầu", "Đã duyệt", "Từ chối", "Tổng ngày nghỉ", "Overtime (h)", "Comp-off (h)", "Tỷ lệ duyệt", "Thao tác"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHLY_TABLE.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "#f0f4f2" }}>
                  <td className="px-4 py-3 font-bold text-xs" style={{ color: "#203430" }}>{row.month}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#203430" }}>{row.total}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: "#1DB87A" }}>{row.approved}</td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: "#ef4444" }}>{row.rejected}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#203430" }}>{row.days}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#203430" }}>{row.ot}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#203430" }}>{row.compoff}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded text-xs font-bold text-white"
                      style={{ background: RATE_COLOR(row.rate) }}>
                      {row.rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-blue-50"
                      style={{ borderColor: "#e2ede9" }}>
                      <Eye size={13} style={{ color: "#3b82f6" }} />
                    </button>
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

