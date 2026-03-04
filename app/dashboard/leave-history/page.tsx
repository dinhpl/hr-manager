"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History, PlusCircle, FileDown, Printer, Filter,
  ChevronUp, ChevronDown, Eye, Pencil, X, Download,
  CheckCircle, Clock, XCircle, List, ChevronLeft, ChevronRight, RotateCcw, Send,
} from "lucide-react";
import LeaveDetailModal, { LeaveDetailData } from "@/components/leave-detail-modal";
import ConfirmDialog from "@/components/confirm-dialog";

/** Leave type code → color mapping (used for localStorage-sourced records) */
const TYPE_COLORS: Record<string, string> = {
  AL: "#3b82f6", SL: "#10b981", ML: "#f97316",
  WFH: "#8b5cf6", CO: "#1DB87A", PL: "#6b7280",
  CSL: "#ec4899", UL: "#f59e0b", BT: "#0ea5e9",
};

interface LeaveRecord {
  id: string;
  type: { code: string; color: string };
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  handover: string;
  status: "draft" | "pending" | "approved" | "rejected" | "hr_confirm";
  submittedAt: string;
  approver: string;
  approverRole: string;
  approvedAt: string;
  actions: string[];
}

const RECORDS: LeaveRecord[] = [
  { id: "001", type: { code: "AL", color: "#3b82f6" }, fromDate: "25/02/2026", toDate: "27/02/2026", days: 3,
    reason: "Nghỉ phép thăm gia đình...", handover: "Trần Bình",
    status: "pending", submittedAt: "20/02/2026 09:12", approver: "Trương Hữu Đạt", approverRole: "Line Manager", approvedAt: "-",
    actions: ["view", "edit", "cancel"] },
  { id: "002", type: { code: "SL", color: "#10b981" }, fromDate: "20/02/2026", toDate: "21/02/2026", days: 2,
    reason: "Nghỉ ốm do cảm cúm", handover: "Nguyễn An",
    status: "approved", submittedAt: "19/02/2026 14:30", approver: "Trương Hữu Đạt", approverRole: "Line Manager", approvedAt: "19/02/2026 16:45",
    actions: ["view", "download"] },
  { id: "003", type: { code: "WFH", color: "#8b5cf6" }, fromDate: "15/02/2026", toDate: "15/02/2026", days: 1,
    reason: "Làm việc từ xa do thời tiết...", handover: "Lê Vương",
    status: "rejected", submittedAt: "14/02/2026 16:45", approver: "Trương Hữu Đạt", approverRole: "Line Manager", approvedAt: "15/02/2026 08:30",
    actions: ["view", "resubmit"] },
  { id: "004", type: { code: "ML", color: "#f97316" }, fromDate: "01/02/2026", toDate: "30/04/2026", days: 90,
    reason: "Nghỉ thai sản", handover: "Lê Thị Bình",
    status: "hr_confirm", submittedAt: "25/01/2026 10:15", approver: "Lê Thị Bình", approverRole: "HR Manager", approvedAt: "26/01/2026 14:20",
    actions: ["view", "download", "print"] },
  { id: "005", type: { code: "CO", color: "#1DB87A" }, fromDate: "10/02/2026", toDate: "10/02/2026", days: 0.5,
    reason: "Sử dụng comp-off từ OT n...", handover: "-",
    status: "approved", submittedAt: "08/02/2026 11:20", approver: "Trương Hữu Đạt", approverRole: "Line Manager", approvedAt: "08/02/2026 13:45",
    actions: ["view", "link"] },
  { id: "006", type: { code: "PL", color: "#6b7280" }, fromDate: "05/03/2026", toDate: "05/03/2026", days: 1,
    reason: "Đi làm giấy tờ cá nhân", handover: "Trần Bình",
    status: "draft", submittedAt: "28/02/2026 15:30", approver: "-", approverRole: "", approvedAt: "-",
    actions: ["edit", "submit", "delete"] },
];

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "Nháp", badge: "bg-gray-100 text-gray-500 border border-gray-200" },
  pending: { label: "Chờ duyệt", badge: "bg-amber-50 text-amber-600 border border-amber-200" },
  approved: { label: "Đã duyệt", badge: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
  rejected: { label: "Từ chối", badge: "bg-red-50 text-red-500 border border-red-200" },
  hr_confirm: { label: "HR xác nhận", badge: "bg-blue-50 text-blue-600 border border-blue-200" },
};

const ROW_BG: Record<string, string> = {
  draft: "#ffffff",
  pending: "#fffbf0",
  approved: "#f0fdf9",
  rejected: "#fff5f5",
  hr_confirm: "#eff6ff",
};

/** Map a LeaveRecord to the normalized modal shape */
function toDetailData(r: LeaveRecord): LeaveDetailData {
  return {
    id: r.id,
    typeCode: r.type.code,
    typeColor: r.type.color,
    fromDate: r.fromDate,
    toDate: r.toDate,
    days: r.days,
    reason: r.reason,
    handover: r.handover,
    status: r.status,
    submittedAt: r.submittedAt,
    approver: r.approver,
    approverRole: r.approverRole,
    approvedAt: r.approvedAt,
  };
}

export default function LeaveHistoryPage() {
  const router = useRouter();

  // ── State ───────────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<LeaveRecord[]>(RECORDS);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "submit_draft" | "resubmit";
    id: string;
    label: string;
  } | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("thisMonth");
  const [fromDate, setFromDate] = useState("2026-02-01");
  const [toDate, setToDate] = useState("2026-02-28");
  const [searchInput, setSearchInput] = useState("");
  const [approverFilter, setApproverFilter] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [pageSize, setPageSize] = useState("25");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // On mount: load any requests saved from the Leave Request page
  useEffect(() => {
    try {
      const stored: Array<{
        id: string; typeCode: string; fromDate: string; toDate: string;
        days: number; reason: string; handoverPerson: string;
        status: "draft" | "pending"; submittedAt: string;
      }> = JSON.parse(localStorage.getItem("hr_leave_requests") ?? "[]");

      if (stored.length > 0) {
        const existingIds = new Set(RECORDS.map((r) => r.id));
        const newRecords: LeaveRecord[] = stored
          .filter((r) => !existingIds.has(r.id))
          .map((r) => ({
            id: r.id,
            type: { code: r.typeCode, color: TYPE_COLORS[r.typeCode] ?? "#6b7280" },
            fromDate: r.fromDate,
            toDate: r.toDate,
            days: r.days,
            reason: r.reason,
            handover: r.handoverPerson || "-",
            status: r.status,
            submittedAt: r.submittedAt,
            approver: "-",
            approverRole: "",
            approvedAt: "-",
            actions: r.status === "draft" ? ["edit", "submit", "delete"] : ["view", "cancel"],
          }));
        if (newRecords.length > 0) {
          setRecords((prev) => [...newRecords, ...prev]);
        }
      }
    } catch {
      // localStorage unavailable or invalid JSON — skip
    }
  }, []);

  // ── Row action handlers ──────────────────────────────────────────────────────

  /** Open detail modal */
  const handleView = (r: LeaveRecord) => setSelectedDetail(toDetailData(r));

  /** Navigate to leave request page for re-editing a draft */
  const handleEdit = (r: LeaveRecord) => {
    router.push(`/dashboard/leave-request`);
  };

  /** Ask confirmation then remove the record (cancel or delete draft) */
  const handleCancelOrDelete = (r: LeaveRecord) => {
    setConfirmAction({
      type: "cancel",
      id: r.id,
      label: r.status === "draft" ? "xóa nháp" : "hủy yêu cầu",
    });
  };

  /** Ask confirmation then change draft → pending */
  const handleSubmitDraft = (r: LeaveRecord) => {
    setConfirmAction({ type: "submit_draft", id: r.id, label: "gửi yêu cầu" });
  };

  /** Ask confirmation then change rejected → pending */
  const handleResubmit = (r: LeaveRecord) => {
    setConfirmAction({ type: "resubmit", id: r.id, label: "gửi lại yêu cầu" });
  };

  /** Execute the confirmed action */
  const executeConfirm = () => {
    if (!confirmAction) return;
    const { type, id } = confirmAction;

    if (type === "cancel") {
      // Remove from visible list
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } else if (type === "submit_draft") {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "pending" as const, actions: ["view", "cancel"] }
            : r
        )
      );
    } else if (type === "resubmit") {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "pending" as const, actions: ["view", "cancel"] }
            : r
        )
      );
    }

    setConfirmAction(null);
  };

  const filtered = records.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (typeFilter && r.type.code !== typeFilter) return false;
    if (searchInput && !r.id.includes(searchInput) && !r.reason.toLowerCase().includes(searchInput.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map((r) => r.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <History size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Lịch sử nghỉ phép</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/leave-request"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#1DB87A" }}>
            <PlusCircle size={14} /> Đăng ký mới
          </Link>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <FileDown size={14} /> Export Excel
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <Printer size={14} /> In báo cáo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng yêu cầu", value: "28", icon: List, color: "#3b82f6", bg: "#eff6ff" },
          { label: "Đã duyệt", value: "24", icon: CheckCircle, color: "#1DB87A", bg: "#f0fdf9" },
          { label: "Chờ duyệt", value: "2", icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
          { label: "Từ chối", value: "2", icon: XCircle, color: "#ef4444", bg: "#fef2f2" },
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

      {/* Advanced Filters */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#e2ede9" }}>
          <div className="flex items-center gap-2">
            <Filter size={15} style={{ color: "#1DB87A" }} />
            <span className="font-semibold text-sm" style={{ color: "#203430" }}>Bộ lọc nâng cao</span>
          </div>
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
            {filtersOpen ? <><ChevronUp size={13} /> Thu gọn</> : <><ChevronDown size={13} /> Mở rộng</>}
          </button>
        </div>
        {filtersOpen && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Trạng thái</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="">Tất cả</option>
                  <option value="draft">Nháp</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="hr_confirm">HR xác nhận</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Loại nghỉ</label>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="">Tất cả</option>
                  <option value="AL">Phép năm</option>
                  <option value="SL">Phép ốm</option>
                  <option value="ML">Thai sản</option>
                  <option value="CO">Nghỉ bù</option>
                  <option value="WFH">WFH</option>
                  <option value="PL">Việc riêng</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Thời gian</label>
                <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="thisWeek">Tuần này</option>
                  <option value="thisMonth">Tháng này</option>
                  <option value="lastMonth">Tháng trước</option>
                  <option value="thisYear">Năm nay</option>
                  <option value="">Tùy chọn</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Từ ngày</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Đến ngày</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Số ngày</label>
                <select className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="">Tất cả</option>
                  <option value="1">1 ngày</option>
                  <option value="2-3">2-3 ngày</option>
                  <option value="4-7">4-7 ngày</option>
                  <option value="8+">8+ ngày</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Tìm kiếm</label>
                <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo ID, lý do, người duyệt..."
                  className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Người duyệt</label>
                <select value={approverFilter} onChange={(e) => setApproverFilter(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="">Tất cả</option>
                  <option value="TRUONGDAT">Trương Hữu Đạt</option>
                  <option value="LETHIBINH">Lê Thị Bình</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6b7f78" }}>Sắp xếp</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="date_desc">Ngày gửi (mới nhất)</option>
                  <option value="date_asc">Ngày gửi (cũ nhất)</option>
                  <option value="status">Trạng thái</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>Hiển thị</label>
                <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border text-xs focus:outline-none" style={{ borderColor: "#e2ede9", color: "#203430" }}>
                  <option value="10">10 dòng</option>
                  <option value="25">25 dòng</option>
                  <option value="50">50 dòng</option>
                </select>
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#1DB87A" }}>
                Lọc
              </button>
              <button onClick={() => { setStatusFilter(""); setTypeFilter(""); setSearchInput(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
                <X size={13} /> Xóa lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border" style={{ background: "#f0fdf9", borderColor: "#D3F2E7" }}>
          <span className="text-sm font-medium" style={{ color: "#0E474E" }}>Đã chọn {selectedIds.length} yêu cầu</span>
          <button className="ml-auto text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#1DB87A" }}>
            Thao tác hàng loạt
          </button>
          <button onClick={() => setSelectedIds([])}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "#e2ede9" }}>
          <List size={15} style={{ color: "#1DB87A" }} />
          <h2 className="font-semibold text-sm" style={{ color: "#203430" }}>Danh sách yêu cầu nghỉ phép</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#203430" }}>
                <th className="px-3 py-3 text-left">
                  <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="accent-[#1DB87A]" />
                </th>
                {["ID", "Loại", "Từ ngày", "Đến ngày", "Số ngày", "Lý do", "Người bàn giao", "Trạng thái", "Ngày gửi", "Người duyệt", "Ngày duyệt", "Thao tác"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-white whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={{ background: ROW_BG[row.status] }}
                  className="border-b last:border-0 hover:brightness-95 transition-all" onClick={() => toggleSelect(row.id)}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelect(row.id)} onClick={(e) => e.stopPropagation()} className="accent-[#1DB87A]" />
                  </td>
                  <td className="px-3 py-3 font-bold" style={{ color: "#203430" }}>#{row.id}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded text-white font-bold text-xs"
                      style={{ background: row.type.color }}>{row.type.code}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#203430" }}>{row.fromDate}</td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#203430" }}>{row.toDate}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-bold text-white"
                      style={{ background: row.days >= 30 ? "#f97316" : row.days >= 2 ? "#3b82f6" : "#1DB87A" }}>
                      {row.days}
                    </span>
                  </td>
                  <td className="px-3 py-3 max-w-[160px] truncate" style={{ color: "#6b7f78" }}>{row.reason}</td>
                  <td className="px-3 py-3" style={{ color: "#6b7f78" }}>{row.handover}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_CONFIG[row.status].badge}`}>
                      {STATUS_CONFIG[row.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#6b7f78" }}>
                    <div>{row.submittedAt.split(" ")[0]}</div>
                    <div className="text-xs opacity-70">{row.submittedAt.split(" ")[1]}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-medium" style={{ color: "#203430" }}>{row.approver}</div>
                    {row.approverRole && <div style={{ color: "#6b7f78" }}>{row.approverRole}</div>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap" style={{ color: "#6b7f78" }}>{row.approvedAt}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {row.actions.includes("view") && (
                        <button
                          onClick={() => handleView(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-blue-50"
                          title="Xem"
                        >
                          <Eye size={13} style={{ color: "#3b82f6" }} />
                        </button>
                      )}
                      {row.actions.includes("edit") && (
                        <button
                          onClick={() => handleEdit(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50"
                          title="Sửa"
                        >
                          <Pencil size={13} style={{ color: "#f59e0b" }} />
                        </button>
                      )}
                      {row.actions.includes("submit") && (
                        <button
                          onClick={() => handleSubmitDraft(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50"
                          title="Gửi"
                        >
                          <Send size={13} style={{ color: "#1DB87A" }} />
                        </button>
                      )}
                      {row.actions.includes("cancel") && (
                        <button
                          onClick={() => handleCancelOrDelete(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"
                          title="Hủy"
                        >
                          <X size={13} style={{ color: "#ef4444" }} />
                        </button>
                      )}
                      {row.actions.includes("delete") && (
                        <button
                          onClick={() => handleCancelOrDelete(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"
                          title="Xóa nháp"
                        >
                          <X size={13} style={{ color: "#ef4444" }} />
                        </button>
                      )}
                      {row.actions.includes("download") && (
                        <button
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50"
                          title="Tải xuống"
                        >
                          <Download size={13} style={{ color: "#1DB87A" }} />
                        </button>
                      )}
                      {row.actions.includes("resubmit") && (
                        <button
                          onClick={() => handleResubmit(row)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50"
                          title="Gửi lại"
                        >
                          <RotateCcw size={13} style={{ color: "#f59e0b" }} />
                        </button>
                      )}
                      {row.actions.includes("print") && (
                        <button
                          onClick={() => window.print()}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                          title="In"
                        >
                          <Printer size={13} style={{ color: "#6b7280" }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: "#e2ede9" }}>
          <p className="text-xs" style={{ color: "#6b7f78" }}>
            Hiện thị 1-{filtered.length} trong tổng số <strong>28 yêu cầu</strong> &nbsp;|&nbsp; Tổng: <strong>45.5 ngày</strong> nghỉ trong năm 2026
          </p>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-gray-50" style={{ borderColor: "#e2ede9" }}>
              <ChevronLeft size={14} style={{ color: "#6b7f78" }} />
            </button>
            {[1, 2, 3, "...", 5].map((p, i) => (
              <button key={i} onClick={() => typeof p === "number" && setCurrentPage(p)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium border transition-colors ${p === currentPage ? "text-white" : "hover:bg-gray-50"}`}
                style={{ borderColor: p === currentPage ? "#1DB87A" : "#e2ede9", background: p === currentPage ? "#1DB87A" : undefined, color: p === currentPage ? "white" : "#6b7f78" }}>
                {p}
              </button>
            ))}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-gray-50" style={{ borderColor: "#e2ede9" }}>
              <ChevronRight size={14} style={{ color: "#6b7f78" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Leave detail modal */}
      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      {/* Confirm dialog for row actions */}
      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.type === "cancel"
            ? "Xác nhận hủy"
            : confirmAction?.type === "submit_draft"
            ? "Xác nhận gửi yêu cầu"
            : "Xác nhận gửi lại"
        }
        message={
          confirmAction?.type === "cancel"
            ? `Bạn có chắc muốn ${confirmAction.label} này? Hành động không thể hoàn tác.`
            : confirmAction?.type === "submit_draft"
            ? "Yêu cầu sẽ được gửi đến người duyệt. Bạn có chắc muốn gửi?"
            : "Yêu cầu sẽ được gửi lại để chờ duyệt. Bạn có chắc?"
        }
        danger={confirmAction?.type === "cancel"}
        confirmLabel={
          confirmAction?.type === "cancel"
            ? "Hủy yêu cầu"
            : confirmAction?.type === "submit_draft"
            ? "Gửi ngay"
            : "Gửi lại"
        }
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Bottom summary: two columns */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Annual leave usage */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>Tổng quan sử dụng phép năm 2026</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Được cấp", val: 12, color: "#3b82f6" },
              { label: "Đã sử dụng", val: 3, color: "#ef4444" },
              { label: "Còn lại", val: 9, color: "#1DB87A" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-xs mt-0.5" style={{ color: "#6b7f78" }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex h-3 rounded-full overflow-hidden mb-2" style={{ background: "#f0f4f2" }}>
            <div className="h-full" style={{ width: "25%", background: "#ef4444" }} />
            <div className="h-full" style={{ width: "75%", background: "#1DB87A" }} />
          </div>
          <div className="space-y-1 text-xs" style={{ color: "#6b7f78" }}>
            <div className="flex justify-between">
              <span>Phép chuyển từ 2025:</span><span className="font-medium" style={{ color: "#203430" }}>0 ngày</span>
            </div>
            <div className="flex justify-between">
              <span>Comp-off khả dụng:</span><span className="font-medium" style={{ color: "#1DB87A" }}>16.5 giờ</span>
            </div>
          </div>
        </div>

        {/* Type breakdown */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: "#e2ede9" }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>Thống kê theo loại nghỉ</h3>
          <div className="space-y-3">
            {[
              { code: "AL", label: "Phép năm", days: "2 ngày", pct: 36, color: "#3b82f6" },
              { code: "SL", label: "Phép ốm", days: "2 ngày", pct: 36, color: "#10b981" },
              { code: "CO", label: "Nghỉ bù", days: "0.5 ngày", pct: 9, color: "#1DB87A" },
              { code: "WFH", label: "Làm từ xa", days: "1 ngày", pct: 18, color: "#8b5cf6" },
            ].map((t) => (
              <div key={t.code} className="flex items-center gap-3">
                <span className="w-10 text-xs font-bold text-white px-1 py-0.5 rounded text-center flex-shrink-0"
                  style={{ background: t.color }}>{t.code}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: "#203430" }}>{t.label}</span>
                    <span className="font-semibold" style={{ color: "#203430" }}>{t.days}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4 text-right font-medium" style={{ color: "#6b7f78" }}>
            Tổng cộng: <strong style={{ color: "#203430" }}>5.5 ngày</strong> đã sử dụng
          </p>
        </div>
      </div>
    </div>
  );
}
