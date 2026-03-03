"use client";

import { useState } from "react";
import {
  Users, UserCheck, CalendarOff, Cake,
  UserPlus, FileDown, Upload, RefreshCw,
  Search, Eye, Pencil, Trash2, Shield,
  ChevronLeft, ChevronRight, LayoutGrid, Table2,
  Building2, Clock,
} from "lucide-react";

interface Employee {
  id: string;
  code: string;
  name: string;
  initials: string;
  team: string;
  email: string;
  dept: { label: string; color: string; bg: string };
  title: string;
  manager: string;
  joinDate: string;
  leaveBalance: string;
  compoff?: string;
  status: "active" | "on_leave" | "inactive" | "terminated" | "maternity" | "new";
  statusNote?: string;
  highlight?: "birthday" | "new";
}

const EMPLOYEES: Employee[] = [
  {
    id: "1", code: "DINHPL", name: "Phạm Long Đĩnh", initials: "PL",
    team: "Backend Team", email: "dinh.pl@company.com",
    dept: { label: "IT", color: "#3b82f6", bg: "#eff6ff" },
    title: "Senior Developer", manager: "Trương Hữu Đạt",
    joinDate: "15/03/2024", leaveBalance: "11/12", compoff: "16.5h",
    status: "active",
  },
  {
    id: "2", code: "DANGTV", name: "Trần Văn Đăng", initials: "TV",
    team: "Marketing Team", email: "dang.tv@company.com",
    dept: { label: "Marketing", color: "#f59e0b", bg: "#fffbeb" },
    title: "Marketing Manager", manager: "Nguyễn Việt Hùng",
    joinDate: "01/07/2023", leaveBalance: "14/15", compoff: "8.0h",
    status: "active", highlight: "birthday",
  },
  {
    id: "3", code: "ANHNT", name: "Nguyễn Thị Anh", initials: "NT",
    team: "Recruitment", email: "anh.nt@company.com",
    dept: { label: "HR", color: "#06b6d4", bg: "#ecfeff" },
    title: "HR Specialist", manager: "Lê Thị Bình",
    joinDate: "10/01/2024", leaveBalance: "2/12",
    status: "maternity", statusNote: "Thai sản: 90 ngày",
  },
  {
    id: "4", code: "NEWBIE", name: "Nguyễn Văn Newbie", initials: "NB",
    team: "Frontend Team", email: "newbie@company.com",
    dept: { label: "IT", color: "#3b82f6", bg: "#eff6ff" },
    title: "Junior Developer", manager: "Phạm Long Đĩnh",
    joinDate: "01/02/2026", leaveBalance: "12/12",
    status: "new", highlight: "new", statusNote: "Mới vào làm",
  },
  {
    id: "5", code: "BINHLV", name: "Lê Văn Bình", initials: "LB",
    team: "QA Team", email: "binh.le@company.com",
    dept: { label: "IT", color: "#3b82f6", bg: "#eff6ff" },
    title: "QA Tester", manager: "Trương Hữu Đạt",
    joinDate: "20/06/2023", leaveBalance: "0/0",
    status: "terminated",
  },
];

const DEPT_DIST = [
  { label: "Công nghệ thông tin", code: "IT", count: 45, pct: 29, color: "#3b82f6" },
  { label: "Marketing", code: "Marketing", count: 32, pct: 21, color: "#f59e0b" },
  { label: "Kinh doanh", code: "Sales", count: 28, pct: 18, color: "#1DB87A" },
  { label: "Nhân sự", code: "HR", count: 15, pct: 10, color: "#06b6d4" },
];

const ACTIVITIES = [
  { icon: UserPlus, color: "#1DB87A", time: "Hôm nay, 09:30", text: "Nguyễn Văn Newbie đã được thêm vào hệ thống" },
  { icon: Cake, color: "#f59e0b", time: "Hôm nay", text: "Sinh nhật Trần Văn Đăng" },
  { icon: CalendarOff, color: "#06b6d4", time: "Hôm qua, 14:20", text: "Nguyễn Thị Anh bắt đầu nghỉ thai sản" },
  { icon: Pencil, color: "#6b7f78", time: "2 ngày trước", text: "Cập nhật thông tin Phạm Long Đĩnh" },
];

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: "Đang làm việc", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  on_leave: { label: "Đang nghỉ phép", badge: "bg-amber-100 text-amber-700 border border-amber-200" },
  inactive: { label: "Tạm nghỉ", badge: "bg-gray-100 text-gray-600 border border-gray-200" },
  terminated: { label: "Đã nghỉ việc", badge: "bg-red-100 text-red-600 border border-red-200" },
  maternity: { label: "Thai sản", badge: "bg-pink-100 text-pink-600 border border-pink-200" },
  new: { label: "Mới vào làm", badge: "bg-blue-100 text-blue-600 border border-blue-200" },
};

const ROW_HIGHLIGHT: Record<string, string> = {
  birthday: "#fffbeb",
  new: "#eff6ff",
};

export default function EmployeesPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [contractFilter, setContractFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = EMPLOYEES.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (deptFilter && e.dept.label !== deptFilter) return false;
    if (searchInput) {
      const q = searchInput.toLowerCase();
      if (!e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((e) => e.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <Users size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Quản lý nhân viên</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#1DB87A" }}>
            <UserPlus size={14} /> Thêm nhân viên
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <Upload size={14} /> Import Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <FileDown size={14} /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng nhân viên", value: "156", icon: Users, color: "#3b82f6", bg: "#eff6ff" },
          { label: "Đang làm việc", value: "142", icon: UserCheck, color: "#1DB87A", bg: "#f0fdf9" },
          { label: "Nghỉ phép hôm nay", value: "8", icon: CalendarOff, color: "#f59e0b", bg: "#fffbeb" },
          { label: "Sinh nhật tháng này", value: "12", icon: Cake, color: "#06b6d4", bg: "#ecfeff" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border flex items-center gap-4"
            style={{ borderColor: "#e2ede9" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon size={22} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#203430" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7f78" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#e2ede9" }}>
        <div className="flex flex-wrap gap-3 items-end">
          {[
            { id: "status", label: "Trạng thái", value: statusFilter, setter: setStatusFilter,
              opts: [["", "Tất cả trạng thái"], ["active", "Đang làm việc"], ["on_leave", "Đang nghỉ phép"], ["inactive", "Tạm nghỉ"], ["terminated", "Đã nghỉ việc"]] },
            { id: "dept", label: "Phòng ban", value: deptFilter, setter: setDeptFilter,
              opts: [["", "Tất cả phòng ban"], ["IT", "IT"], ["Marketing", "Marketing"], ["Sales", "Kinh doanh"], ["HR", "Nhân sự"], ["Finance", "Finance"]] },
            { id: "contract", label: "Loại hợp đồng", value: contractFilter, setter: setContractFilter,
              opts: [["", "Tất cả loại HĐ"], ["FullTime", "Chính thức"], ["PartTime", "Bán thời gian"], ["Contract", "Hợp đồng"], ["Intern", "Thực tập"]] },
            { id: "location", label: "Địa điểm", value: locationFilter, setter: setLocationFilter,
              opts: [["", "Tất cả địa điểm"], ["HCM", "HCM"], ["HN", "Hà Nội"], ["DN", "Đà Nẵng"], ["Remote", "Remote"]] },
          ].map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>{f.label}</label>
              <select value={f.value} onChange={(e) => f.setter(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[150px]"
                style={{ borderColor: "#e2ede9", color: "#203430" }}>
                {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div className="flex gap-2 items-end flex-1 min-w-[200px]">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Tìm kiếm</label>
              <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên, mã NV, email..."
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                style={{ borderColor: "#e2ede9", color: "#203430" }} />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: "#1DB87A" }}>
              <Search size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="bg-white rounded-xl border px-4 py-2.5 flex items-center justify-between"
        style={{ borderColor: "#e2ede9" }}>
        <span className="text-sm" style={{ color: "#6b7f78" }}>
          Đã chọn: <strong style={{ color: "#203430" }}>{selectedIds.length}</strong> nhân viên
        </span>
        <div className="flex gap-2 items-center">
          <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <option value="">Thao tác hàng loạt</option>
            <option value="export">Export danh sách</option>
            <option value="updateLeave">Cập nhật phép năm</option>
            <option value="sendNotification">Gửi thông báo</option>
            <option value="deactivate">Vô hiệu hóa</option>
          </select>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            Thực hiện
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2">
            <Table2 size={15} style={{ color: "#1DB87A" }} />
            <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Danh sách nhân viên</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => {}} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2ede9" }}>
              <RefreshCw size={13} style={{ color: "#6b7f78" }} />
            </button>
            <button onClick={() => setViewMode("table")}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors`}
              style={{ borderColor: viewMode === "table" ? "#1DB87A" : "#e2ede9", background: viewMode === "table" ? "#D3F2E7" : undefined }}>
              <Table2 size={13} style={{ color: viewMode === "table" ? "#0E474E" : "#6b7f78" }} />
            </button>
            <button onClick={() => setViewMode("card")}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors`}
              style={{ borderColor: viewMode === "card" ? "#1DB87A" : "#e2ede9", background: viewMode === "card" ? "#D3F2E7" : undefined }}>
              <LayoutGrid size={13} style={{ color: viewMode === "card" ? "#0E474E" : "#6b7f78" }} />
            </button>
          </div>
        </div>

        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#203430" }}>
                  <th className="px-3 py-3">
                    <input type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={toggleAll} className="accent-[#1DB87A]" />
                  </th>
                  {["Mã NV", "Họ tên", "Email", "Phòng ban", "Chức vụ", "Line Manager", "Ngày vào", "Phép còn lại", "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const rowBg = emp.highlight ? ROW_HIGHLIGHT[emp.highlight] : (emp.status === "terminated" ? "#fafafa" : "#ffffff");
                  const isSelected = selectedIds.includes(emp.id);
                  return (
                    <tr key={emp.id}
                      className="border-b last:border-0 hover:brightness-95 transition-all cursor-pointer"
                      style={{ background: isSelected ? "#f0fdf9" : rowBg, opacity: emp.status === "terminated" ? 0.65 : 1 }}
                      onClick={() => toggleSelect(emp.id)}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(emp.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-[#1DB87A]" />
                      </td>
                      <td className="px-3 py-3 font-bold" style={{ color: "#203430" }}>{emp.code}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}>
                            {emp.initials}
                          </div>
                          <div>
                            <p className="font-semibold whitespace-nowrap" style={{ color: "#203430" }}>
                              {emp.name}
                              {emp.highlight === "birthday" && <span className="ml-1">&#x1F382;</span>}
                              {emp.highlight === "new" && <span className="ml-1 text-blue-400">&#9733;</span>}
                            </p>
                            <p className="text-xs" style={{ color: "#6b7f78" }}>{emp.team}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{ color: "#6b7f78" }}>{emp.email}</td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{ background: emp.dept.bg, color: emp.dept.color }}>
                          {emp.dept.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#203430" }}>{emp.title}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#6b7f78" }}>{emp.manager}</td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#6b7f78" }}>{emp.joinDate}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold" style={{ color: "#1DB87A" }}>{emp.leaveBalance}</p>
                        {emp.compoff && <p className="text-xs" style={{ color: "#6b7f78" }}>Comp-off: {emp.compoff}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[emp.status].badge}`}>
                          {emp.statusNote || STATUS_CONFIG[emp.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-blue-50" title="Xem">
                            <Eye size={13} style={{ color: "#3b82f6" }} />
                          </button>
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50" title="Sửa">
                            <Pencil size={13} style={{ color: "#f59e0b" }} />
                          </button>
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50" title="Quyền">
                            <Shield size={13} style={{ color: "#1DB87A" }} />
                          </button>
                          <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50" title="Xóa">
                            <Trash2 size={13} style={{ color: "#ef4444" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {filtered.map((emp) => (
              <div key={emp.id} className="rounded-xl border p-4 hover:shadow-md transition-all"
                style={{ borderColor: "#e2ede9", borderLeft: `4px solid ${emp.dept.color}` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}>
                    {emp.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "#203430" }}>{emp.name}</p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>{emp.title}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[emp.status].badge}`}>
                    {STATUS_CONFIG[emp.status].label}
                  </span>
                </div>
                <div className="space-y-1 text-xs" style={{ color: "#6b7f78" }}>
                  <p>{emp.email}</p>
                  <p>Phòng ban: <span className="font-medium" style={{ color: emp.dept.color }}>{emp.dept.label}</span></p>
                  <p>Manager: <span style={{ color: "#203430" }}>{emp.manager}</span></p>
                  <p>Phép còn lại: <span className="font-bold" style={{ color: "#1DB87A" }}>{emp.leaveBalance}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#e2ede9" }}>
          <p className="text-xs" style={{ color: "#6b7f78" }}>
            Hiện thị 1-{filtered.length} trong tổng số <strong>156 nhân viên</strong>
          </p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2ede9" }}>
              <ChevronLeft size={14} style={{ color: "#6b7f78" }} />
            </button>
            {[1, 2, 3].map((p) => (
              <button key={p} onClick={() => setCurrentPage(p)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium border transition-colors"
                style={{ borderColor: p === currentPage ? "#1DB87A" : "#e2ede9", background: p === currentPage ? "#1DB87A" : undefined, color: p === currentPage ? "white" : "#6b7f78" }}>
                {p}
              </button>
            ))}
            <button className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2ede9" }}>
              <ChevronRight size={14} style={{ color: "#6b7f78" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom: department distribution + activity feed */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Department distribution */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} style={{ color: "#1DB87A" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Phân bố theo phòng ban</h3>
          </div>
          <div className="space-y-3">
            {DEPT_DIST.map((d) => (
              <div key={d.code} className="flex items-center gap-3">
                <span className="text-xs font-bold text-white px-2 py-0.5 rounded w-20 text-center flex-shrink-0"
                  style={{ background: d.color }}>
                  {d.code}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "#203430" }}>{d.label}</span>
                    <span className="font-semibold" style={{ color: "#6b7f78" }}>{d.count} người ({d.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                    <div className="h-full rounded-full" style={{ width: `${d.pct * 3}%`, background: d.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} style={{ color: "#1DB87A" }} />
            <h3 className="font-semibold text-sm" style={{ color: "#203430" }}>Hoạt động gần đây</h3>
          </div>
          <div className="relative pl-5">
            <div className="absolute left-2 top-0 bottom-0 w-0.5" style={{ background: "#e2ede9" }} />
            {ACTIVITIES.map((a, i) => (
              <div key={i} className="relative mb-4 last:mb-0">
                <div className="absolute -left-3.5 top-1 w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: a.color }} />
                <p className="text-xs font-semibold" style={{ color: "#6b7f78" }}>{a.time}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#203430" }}>{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

