"use client";

import { useState } from "react";
import {
  Users, UserCheck, CalendarOff, Cake,
  UserPlus, FileDown, Upload, RefreshCw,
  Search, Eye, Pencil, Trash2, Shield,
  ChevronLeft, ChevronRight, LayoutGrid, Table2,
  Building2, Clock, X, Check,
} from "lucide-react";

// Types based on users table schema
interface Employee {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  system_role: string;
  team_id: number;
  status: "active" | "inactive" | "terminated";
  role_id: number | null;
  role?: string | null;
  created_at: string;
  updated_at: string;
  is_countable: boolean;
  company_join_date: string | null;
}

// Mock data matching the database schema
const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "c5643cfe-c036-431d-b47c-b9e6f905999e",
    email: "minhlq.ot@gmail.com",
    first_name: "Minh",
    last_name: "Le Quang",
    profile_image_url: null,
    system_role: "member",
    team_id: 3,
    status: "active",
    role: "Senior Developer",
    role_id: 1,
    created_at: "2026-02-04 09:06:32.522555",
    updated_at: "2026-02-24 07:55:06.098",
    is_countable: true,
    company_join_date: "2024-03-15",
  },
  {
    id: "a1234567-89ab-cdef-1234-567890abcdef",
    email: "dang.tv@company.com",
    first_name: "Trần",
    last_name: "Văn Đăng",
    profile_image_url: null,
    system_role: "member",
    team_id: 2,
    status: "active",
    role: "Marketing Manager",
    role_id: 2,
    created_at: "2026-01-10 10:00:00",
    updated_at: "2026-02-20 15:30:00",
    is_countable: true,
    company_join_date: "2023-07-01",
  },
  {
    id: "b2345678-90ab-cdef-2345-678901abcdef",
    email: "anh.nt@company.com",
    first_name: "Nguyễn",
    last_name: "Thị Anh",
    profile_image_url: null,
    system_role: "member",
    team_id: 4,
    status: "active",
    role: "HR Specialist",
    role_id: 3,
    created_at: "2026-01-01 08:00:00",
    updated_at: "2026-02-10 12:00:00",
    is_countable: true,
    company_join_date: "2024-01-10",
  },
];

// Team mapping
const TEAMS: Record<number, string> = {
  1: "Engineering",
  2: "Marketing",
  3: "Operations",
  4: "HR",
  5: "Sales",
};

// Role mapping
const ROLES: Record<number, string> = {
  1: "Senior Developer",
  2: "Marketing Manager",
  3: "HR Specialist",
  4: "Junior Developer",
  5: "Product Manager",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: "Đang làm việc", badge: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  inactive: { label: "Tạm nghỉ", badge: "bg-gray-100 text-gray-600 border border-gray-200" },
  terminated: { label: "Đã nghỉ việc", badge: "bg-red-100 text-red-600 border border-red-200" },
};

const TEAM_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: "#3b82f6", bg: "#eff6ff" },
  2: { color: "#f59e0b", bg: "#fffbeb" },
  3: { color: "#1DB87A", bg: "#f0fdf9" },
  4: { color: "#06b6d4", bg: "#ecfeff" },
  5: { color: "#8b5cf6", bg: "#f5f3ff" },
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [statusFilter, setStatusFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"role_id" | "team_id" | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const filtered = employees.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (teamFilter && e.team_id !== parseInt(teamFilter)) return false;
    if (searchInput) {
      const q = searchInput.toLowerCase();
      const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
      if (!fullName.includes(q) && !e.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll = () =>
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((e) => e.id));

  const handleCellEdit = (empId: string, field: "role_id" | "team_id", value: string) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === empId
          ? { ...emp, [field]: parseInt(value) }
          : emp
      )
    );
    setEditingCellId(null);
    setEditingField(null);
  };

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
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Tổng nhân viên", value: employees.length.toString(), icon: Users, color: "#3b82f6", bg: "#eff6ff" },
          { label: "Đang làm việc", value: employees.filter((e) => e.status === "active").length.toString(), icon: UserCheck, color: "#1DB87A", bg: "#f0fdf9" },
          { label: "Đã nghỉ việc", value: employees.filter((e) => e.status === "terminated").length.toString(), icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>Trạng thái</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[150px]"
              style={{ borderColor: "#e2ede9", color: "#203430" }}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang làm việc</option>
              <option value="inactive">Tạm nghỉ</option>
              <option value="terminated">Đã nghỉ việc</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>Phòng ban</label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm focus:outline-none min-w-[150px]"
              style={{ borderColor: "#e2ede9", color: "#203430" }}>
              <option value="">Tất cả phòng ban</option>
              {Object.entries(TEAMS).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end flex-1 min-w-[200px]">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Tìm kiếm</label>
              <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên, email..."
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

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2">
            <Table2 size={15} style={{ color: "#1DB87A" }} />
            <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Danh sách nhân viên ({filtered.length})</h2>
          </div>
          <div className="flex gap-1">
            <button onClick={() => {}} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50"
              style={{ borderColor: "#e2ede9" }}>
              <RefreshCw size={13} style={{ color: "#6b7f78" }} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#203430" }}>
                <th className="px-3 py-3">
                  <input type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="accent-[#1DB87A]" />
                </th>
                {["Avatar", "Họ tên", "Email", "Phòng ban", "Chức vụ", "Ngày tham gia", "Trạng thái", "Thao tác"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                const initials = (emp.first_name.charAt(0) + emp.last_name.charAt(0)).toUpperCase();
                const teamColor = TEAM_COLORS[emp.team_id] || { color: "#6b7f78", bg: "#f3f4f6" };
                
                return (
                  <tr key={emp.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-all cursor-pointer"
                    style={{ background: isSelected ? "#f0fdf9" : undefined, opacity: emp.status === "terminated" ? 0.65 : 1 }}
                    onClick={() => toggleSelect(emp.id)}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected}
                        onChange={() => toggleSelect(emp.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-[#1DB87A]" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ background: emp.profile_image_url ? `url(${emp.profile_image_url})` : "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}>
                        {!emp.profile_image_url && initials}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-semibold whitespace-nowrap" style={{ color: "#203430" }}>
                          {emp.first_name} {emp.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>{emp.email}</td>
                    <td className="px-3 py-3 min-w-[140px]">
                      {editingCellId === emp.id && editingField === "team_id" ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <select value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                            className="px-2 py-1 rounded border text-xs flex-1"
                            style={{ borderColor: "#e2ede9", color: "#203430" }}>
                            {Object.entries(TEAMS).map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                            ))}
                          </select>
                          <button onClick={() => handleCellEdit(emp.id, "team_id", editingValue)}
                            className="px-1.5 py-1 rounded bg-green-100 hover:bg-green-200 transition-colors">
                            <Check size={12} style={{ color: "#059669" }} />
                          </button>
                          <button onClick={() => setEditingCellId(null)}
                            className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors">
                            <X size={12} style={{ color: "#6b7f78" }} />
                          </button>
                        </div>
                      ) : (
                        <div onClick={(e) => { e.stopPropagation(); setEditingCellId(emp.id); setEditingField("team_id"); setEditingValue(emp.team_id.toString()); }}
                          className="px-2 py-1 rounded cursor-pointer hover:bg-gray-100 inline-flex items-center gap-1"
                          style={{ background: teamColor.bg }}>
                          <span className="text-xs font-semibold" style={{ color: teamColor.color }}>
                            {TEAMS[emp.team_id]}
                          </span>
                          <Pencil size={10} style={{ color: teamColor.color }} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 min-w-[140px]">
                      {editingCellId === emp.id && editingField === "role_id" ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <select value={editingValue} onChange={(e) => setEditingValue(e.target.value)}
                            className="px-2 py-1 rounded border text-xs flex-1"
                            style={{ borderColor: "#e2ede9", color: "#203430" }}>
                            {Object.entries(ROLES).map(([id, name]) => (
                              <option key={id} value={id}>{name}</option>
                            ))}
                          </select>
                          <button onClick={() => handleCellEdit(emp.id, "role_id", editingValue)}
                            className="px-1.5 py-1 rounded bg-green-100 hover:bg-green-200 transition-colors">
                            <Check size={12} style={{ color: "#059669" }} />
                          </button>
                          <button onClick={() => setEditingCellId(null)}
                            className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors">
                            <X size={12} style={{ color: "#6b7f78" }} />
                          </button>
                        </div>
                      ) : (
                        <div onClick={(e) => { e.stopPropagation(); setEditingCellId(emp.id); setEditingField("role_id"); setEditingValue((emp.role_id || 1).toString()); }}
                          className="px-2 py-1 rounded cursor-pointer hover:bg-blue-50 text-xs inline-flex items-center gap-1"
                          style={{ color: "#203430" }}>
                          {ROLES[emp.role_id || 1]}
                          <Pencil size={10} style={{ color: "#3b82f6" }} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: "#6b7f78" }}>
                      {emp.company_join_date ? new Date(emp.company_join_date).toLocaleDateString('vi-VN') : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[emp.status].badge}`}>
                        {STATUS_CONFIG[emp.status].label}
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
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#e2ede9" }}>
              <h2 className="font-bold text-base" style={{ color: "#203430" }}>Thêm nhân viên</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <AddEmployeeForm onSuccess={() => {
              setIsAddModalOpen(false);
              // Reload data would happen here
            }} onClose={() => setIsAddModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Add Employee Form Component
function AddEmployeeForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role_id: "1",
    team_id: "1",
    company_join_date: "",
    status: "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = "Họ là bắt buộc";
    if (!formData.last_name.trim()) newErrors.last_name = "Tên là bắt buộc";
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = "Email không hợp lệ";
    if (!formData.password) newErrors.password = "Mật khẩu là bắt buộc";
    if (formData.password.length < 6) newErrors.password = "Mật khẩu phải ít nhất 6 ký tự";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("[v0] Submitting new employee:", formData);
      // Here you would normally call an API to create the user
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Họ</label>
          <input type="text" name="first_name" value={formData.first_name} onChange={handleChange}
            placeholder="Ví dụ: Phạm"
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: errors.first_name ? "#ef4444" : "#e2ede9", color: "#203430" }} />
          {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Tên</label>
          <input type="text" name="last_name" value={formData.last_name} onChange={handleChange}
            placeholder="Ví dụ: Long Đĩnh"
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: errors.last_name ? "#ef4444" : "#e2ede9", color: "#203430" }} />
          {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange}
          placeholder="example@company.com"
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
          style={{ borderColor: errors.email ? "#ef4444" : "#e2ede9", color: "#203430" }} />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Mật khẩu</label>
        <input type="password" name="password" value={formData.password} onChange={handleChange}
          placeholder="Tối thiểu 6 ký tự"
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
          style={{ borderColor: errors.password ? "#ef4444" : "#e2ede9", color: "#203430" }} />
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Chức vụ</label>
          <select name="role_id" value={formData.role_id} onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            {Object.entries(ROLES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Phòng ban</label>
          <select name="team_id" value={formData.team_id} onChange={handleChange}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            {Object.entries(TEAMS).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Ngày tham gia công ty</label>
        <input type="date" name="company_join_date" value={formData.company_join_date} onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
          style={{ borderColor: "#e2ede9", color: "#203430" }} />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Trạng thái</label>
        <select name="status" value={formData.status} onChange={handleChange}
          className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
          style={{ borderColor: "#e2ede9", color: "#203430" }}>
          <option value="active">Đang làm việc</option>
          <option value="inactive">Tạm nghỉ</option>
          <option value="terminated">Đã nghỉ việc</option>
        </select>
      </div>

      <div className="flex gap-3 pt-4">
        <button type="submit"
          className="flex-1 px-4 py-2 rounded-lg font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "#1DB87A" }}>
          Thêm nhân viên
        </button>
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg font-semibold border"
          style={{ borderColor: "#e2ede9", color: "#203430" }}>
          Hủy
        </button>
      </div>
    </form>
  );
}
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

