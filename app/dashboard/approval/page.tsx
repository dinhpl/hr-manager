"use client";

import { useState } from "react";
import {
  CheckCircle2, RefreshCw, Clock, AlertTriangle, CheckCircle,
  Users, Eye, MessageSquare, Download, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import LeaveDetailModal, { LeaveDetailData } from "@/components/leave-detail-modal";
import ConfirmDialog from "@/components/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalRequest {
  id: string;
  status: "overdue" | "pending" | "hr_confirm" | "waiting";
  overdueBy?: number;
  employee: { name: string; code: string; team: string; dept: string; initials: string };
  leaveType: { code: string; color: string };
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  handover: string;
  submittedAt: string;
  leaveBalance?: string;
  usedThisYear?: number;
  wfhUsed?: string;
  wfhMax?: string;
  lastWFH?: string;
  fileAttachment?: string;
  approvedBy?: string;
  approvedAt?: string;
  needsHRNote?: string;
  isMedical?: boolean;
}

const REQUESTS: ApprovalRequest[] = [
  {
    id: "001", status: "overdue", overdueBy: 2,
    employee: { name: "Phạm Long Đĩnh", code: "DINHPL", team: "Backend Team", dept: "IT", initials: "PL" },
    leaveType: { code: "AL", color: "#3b82f6" },
    fromDate: "25/02/2026", toDate: "27/02/2026", days: 3,
    reason: "Nghỉ phép thăm gia đình", handover: "Trần Bình",
    submittedAt: "20/02/2026 09:12", leaveBalance: "9/12", usedThisYear: 3,
  },
  {
    id: "002", status: "pending",
    employee: { name: "Trần Văn Đăng", code: "DANGTV", team: "Marketing Team", dept: "Marketing", initials: "TV" },
    leaveType: { code: "WFH", color: "#8b5cf6" },
    fromDate: "28/02/2026", toDate: "28/02/2026", days: 1,
    reason: "Làm việc từ xa do thời tiết xấu", handover: "Nguyễn An",
    submittedAt: "26/02/2026 14:30", wfhUsed: "5", wfhMax: "10", lastWFH: "15/02/2026",
  },
  {
    id: "003", status: "hr_confirm",
    employee: { name: "Nguyễn Thị Anh", code: "ANHNT", team: "Recruitment", dept: "HR", initials: "NT" },
    leaveType: { code: "ML", color: "#f97316" },
    fromDate: "01/03/2026", toDate: "30/05/2026", days: 90,
    reason: "Nghỉ thai sản", handover: "Lê Thị Bình",
    submittedAt: "25/01/2026 10:15", fileAttachment: "Giấy khám",
    approvedBy: "Trương Hữu Đạt", approvedAt: "25/02/2026",
    needsHRNote: "Yêu cầu này đã được Line Manager duyệt và cần HR xác nhận cuối cùng.",
    isMedical: true,
  },
  {
    id: "004", status: "waiting",
    employee: { name: "Lê Văn Bình", code: "BINHLV", team: "QA Team", dept: "IT", initials: "LV" },
    leaveType: { code: "SL", color: "#10b981" },
    fromDate: "01/03/2026", toDate: "02/03/2026", days: 2,
    reason: "Nghỉ ốm do sốt cao", handover: "Nguyễn Văn C",
    submittedAt: "28/02/2026 18:45", leaveBalance: "2/5", fileAttachment: "Có",
  },
];

const CARD_HEADER: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  overdue: { bg: "#dc2626", text: "white", icon: <AlertTriangle size={14} />, label: "Quá hạn duyệt" },
  pending: { bg: "#06b6d4", text: "white", icon: <Clock size={14} />, label: "Chờ duyệt" },
  hr_confirm: { bg: "#0E474E", text: "white", icon: <Users size={14} />, label: "Cần HR xác nhận" },
  waiting: { bg: "#f59e0b", text: "white", icon: <Clock size={14} />, label: "Chờ duyệt" },
};

/** Map ApprovalRequest to normalized modal shape */
function toDetailData(r: ApprovalRequest): LeaveDetailData {
  return {
    id: r.id,
    typeCode: r.leaveType.code,
    typeColor: r.leaveType.color,
    fromDate: r.fromDate,
    toDate: r.toDate,
    days: r.days,
    reason: r.reason,
    handover: r.handover,
    status: r.status === "hr_confirm" ? "hr_confirm" : r.status === "overdue" || r.status === "pending" || r.status === "waiting" ? "pending" : r.status,
    submittedAt: r.submittedAt,
    employeeName: r.employee.name,
    employeeCode: r.employee.code,
    employeeTeam: `${r.employee.team} | ${r.employee.dept}`,
    leaveBalance: r.leaveBalance,
    fileAttachment: r.fileAttachment,
    approver: r.approvedBy,
    approvedAt: r.approvedAt,
  };
}

export default function ApprovalPage() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hrNotes, setHrNotes] = useState<Record<string, string>>({});
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState<LeaveDetailData | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const handleApprove = (id: string) => {
    setApprovedIds((p) => [...p, id]);
    setRejectedIds((p) => p.filter((x) => x !== id));
  };
  const handleReject = (id: string) => {
    setRejectedIds((p) => [...p, id]);
    setApprovedIds((p) => p.filter((x) => x !== id));
  };
  const handleHRConfirm = (id: string) => { handleApprove(id); };
  const handleHRReject = (id: string) => { handleReject(id); };

  const toggleSelect = (id: string) => {
    setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  };

  /** Bulk approve all selected requests that haven't been decided yet */
  const executeBulkApprove = () => {
    const pending = selectedIds.filter(
      (id) => !approvedIds.includes(id) && !rejectedIds.includes(id)
    );
    setApprovedIds((p) => [...p, ...pending]);
    setSelectedIds([]);
    setBulkConfirmOpen(false);
  };

  const handleRefresh = () => {
    setNotes({});
    setHrNotes({});
    setApprovedIds([]);
    setRejectedIds([]);
    setSelectedIds([]);
    setStatusFilter("");
    setDeptFilter("");
    setTypeFilter("");
    setPriorityFilter("");
    setSearchInput("");
    setCurrentPage(1);
    setSelectedDetail(null);
    setBulkConfirmOpen(false);
  };

  const filtered = REQUESTS.filter((r) => {
    if (statusFilter === "overdue" && r.status !== "overdue") return false;
    if (statusFilter === "hr" && r.status !== "hr_confirm") return false;
    if (deptFilter && r.employee.dept !== deptFilter) return false;
    if (typeFilter && r.leaveType.code !== typeFilter) return false;
    if (searchInput && !r.employee.name.toLowerCase().includes(searchInput.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <CheckCircle2 size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Duyệt yêu cầu nghỉ phép</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => selectedIds.length > 0 && setBulkConfirmOpen(true)}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "#1DB87A", color: "#1DB87A" }}
          >
            <CheckCircle size={14} />
            Duyệt hàng loạt
            {selectedIds.length > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-xs text-white font-bold"
                style={{ background: "#1DB87A" }}
              >
                {selectedIds.length}
              </span>
            )}
          </button>
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chờ duyệt", value: "8", icon: Clock, color: "#f59e0b", bg: "#fffbeb" },
          { label: "Quá hạn duyệt", value: "3", icon: AlertTriangle, color: "#ef4444", bg: "#fef2f2" },
          { label: "Đã duyệt tuần này", value: "25", icon: CheckCircle, color: "#1DB87A", bg: "#f0fdf9" },
          { label: "Cần HR xác nhận", value: "2", icon: Users, color: "#3b82f6", bg: "#eff6ff" },
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

      {/* Filter bar */}
      <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#e2ede9" }}>
        <div className="flex flex-wrap gap-3 items-end">
          {[
            { id: "status", label: "Trạng thái", value: statusFilter, setter: setStatusFilter,
              opts: [["", "Tất cả"], ["overdue", "Quá hạn"], ["hr", "Cần HR"]] },
            { id: "dept", label: "Phòng ban", value: deptFilter, setter: setDeptFilter,
              opts: [["", "Tất cả phòng ban"], ["IT", "IT"], ["Marketing", "Marketing"], ["HR", "HR"], ["Sales", "Sales"]] },
            { id: "type", label: "Loại nghỉ", value: typeFilter, setter: setTypeFilter,
              opts: [["", "Tất cả loại"], ["AL", "Phép năm"], ["SL", "Phép ốm"], ["WFH", "WFH"], ["ML", "Thai sản"]] },
            { id: "priority", label: "Độ ưu tiên", value: priorityFilter, setter: setPriorityFilter,
              opts: [["", "Tất cả"], ["high", "Ưu tiên cao"], ["normal", "Bình thường"]] },
          ].map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: "#6b7f78" }}>{f.label}</label>
              <Select
                value={f.value || `all-${f.id}`}
                onValueChange={(value) => f.setter(value.startsWith("all-") ? "" : value)}
              >
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                  {f.opts.map(([v, l], idx) => {
                    const itemValue = v === "" ? `all-${f.id}` : v;
                    return <SelectItem key={`${f.id}-${idx}`} value={itemValue}>{l}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex gap-2 items-end flex-1 min-w-[200px]">
            <div className="flex-1">
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>Tìm nhân viên</label>
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên nhân viên..."
              />
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: "#1DB87A" }}>
              <Search size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Request cards grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        {filtered.map((req) => {
          const header = CARD_HEADER[req.status];
          const isApproved = approvedIds.includes(req.id);
          const isRejected = rejectedIds.includes(req.id);
          return (
            <div key={req.id}
              className="bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md"
              style={{
                borderColor: "#e2ede9",
                opacity: isApproved || isRejected ? 0.7 : 1,
                borderLeft: `4px solid ${header.bg}`,
              }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: header.bg, color: header.text }}>
                <div className="flex items-center gap-2">
                  {header.icon}
                  <span className="font-semibold text-sm">{header.label} - ID: #{req.id}</span>
                  {req.overdueBy && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold animate-pulse"
                      style={{ background: "rgba(255,255,255,0.25)" }}>
                      Quá hạn {req.overdueBy} ngày
                    </span>
                  )}
                </div>
                <Checkbox
                  checked={selectedIds.includes(req.id)}
                  onCheckedChange={() => toggleSelect(req.id)}
                  className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0E474E]"
                />
              </div>

              <div className="p-4 space-y-3">
                {/* Employee info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}>
                    {req.employee.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#203430" }}>
                      {req.employee.name} ({req.employee.code})
                    </p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      {req.employee.team} | {req.employee.dept}
                    </p>
                  </div>
                </div>

                {/* Leave details */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs text-white font-bold"
                        style={{ background: req.leaveType.color }}>{req.leaveType.code}</span>
                      <span className="font-semibold text-sm" style={{ color: "#203430" }}>
                        {req.fromDate} {req.days > 1 ? `- ${req.toDate}` : ""} ({req.days} ngày)
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      <strong style={{ color: "#203430" }}>Lý do:</strong> {req.reason}
                    </p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      <strong style={{ color: "#203430" }}>Người bàn giao:</strong> {req.handover}
                    </p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>Gửi: {req.submittedAt}</p>
                    {req.fileAttachment && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "#3b82f6" }}>
                        <Download size={11} />
                        <span>File đính kèm: {req.fileAttachment}</span>
                      </div>
                    )}
                  </div>
                  {/* Balance info */}
                  <div className="flex-shrink-0 text-center min-w-[80px]">
                    {req.leaveBalance && (
                      <>
                        <p className="text-xs" style={{ color: "#6b7f78" }}>Phép còn lại</p>
                        <p className="text-lg font-bold" style={{ color: "#1DB87A" }}>{req.leaveBalance} ngày</p>
                        <p className="text-xs" style={{ color: "#6b7f78" }}>Đã dùng năm nay</p>
                        <p className="text-base font-semibold" style={{ color: "#203430" }}>{req.usedThisYear} ngày</p>
                      </>
                    )}
                    {req.wfhUsed && (
                      <>
                        <p className="text-xs" style={{ color: "#6b7f78" }}>WFH đã dùng</p>
                        <p className="text-lg font-bold" style={{ color: "#1DB87A" }}>{req.wfhUsed}/{req.wfhMax} ngày</p>
                        <p className="text-xs" style={{ color: "#6b7f78" }}>Lần WFH gần nhất</p>
                        <p className="text-xs font-medium" style={{ color: "#203430" }}>{req.lastWFH}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Approved by (for HR confirm) */}
                {req.approvedBy && (
                  <p className="text-xs" style={{ color: "#1DB87A" }}>
                    Đã duyệt bởi: {req.approvedBy} ({req.approvedAt})
                  </p>
                )}

                {/* HR note */}
                {req.needsHRNote && (
                  <div className="p-2.5 rounded-lg text-xs" style={{ background: "#f0fdf9", color: "#0E474E", border: "1px solid #D3F2E7" }}>
                    {req.needsHRNote}
                  </div>
                )}

                {/* Note textarea */}
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7f78" }}>
                    {req.status === "hr_confirm" ? "Ghi chú HR:" : "Ghi chú duyệt:"}
                  </label>
                  <Textarea
                    rows={2}
                    placeholder={req.status === "hr_confirm" ? "Nhập ghi chú xác nhận..." : "Nhập ghi chú (tùy chọn)..."}
                    value={req.status === "hr_confirm" ? (hrNotes[req.id] || "") : (notes[req.id] || "")}
                    onChange={(e) => req.status === "hr_confirm"
                      ? setHrNotes((p) => ({ ...p, [req.id]: e.target.value }))
                      : setNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                    className="text-xs resize-none"
                  />
                </div>

                {/* Action buttons */}
                {isApproved ? (
                  <div className="text-sm font-semibold text-center py-2 rounded-lg" style={{ background: "#D3F2E7", color: "#0E474E" }}>
                    Đã duyệt
                  </div>
                ) : isRejected ? (
                  <div className="text-sm font-semibold text-center py-2 rounded-lg" style={{ background: "#fef2f2", color: "#ef4444" }}>
                    Đã từ chối
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {req.status === "hr_confirm" ? (
                      <>
                        <button onClick={() => handleHRConfirm(req.id)}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                          style={{ background: "#1DB87A" }}>
                          <CheckCircle size={14} /> HR Xác nhận
                        </button>
                        <button onClick={() => handleHRReject(req.id)}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                          style={{ background: "#ef4444" }}>
                          HR Từ chối
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleApprove(req.id)}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                          style={{ background: "#1DB87A" }}>
                          <CheckCircle size={14} /> Duyệt
                        </button>
                        <button onClick={() => handleReject(req.id)}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1.5"
                          style={{ background: "#ef4444" }}>
                          Từ chối
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedDetail(toDetailData(req))}
                      className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-blue-50 transition-colors flex-shrink-0"
                      style={{ borderColor: "#e2ede9" }}
                      title="Xem chi tiết"
                    >
                      <Eye size={15} style={{ color: "#3b82f6" }} />
                    </button>
                    <button
                      className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
                      style={{ borderColor: "#e2ede9" }}
                      title="Ghi chú"
                    >
                      <MessageSquare size={15} style={{ color: "#6b7f78" }} />
                    </button>
                    {req.fileAttachment && (
                      <button
                        className="w-9 h-9 rounded-lg border flex items-center justify-center hover:bg-emerald-50 transition-colors flex-shrink-0"
                        style={{ borderColor: "#e2ede9" }}
                        title="Tải file đính kèm"
                      >
                        <Download size={15} style={{ color: "#1DB87A" }} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave detail modal */}
      <LeaveDetailModal data={selectedDetail} onClose={() => setSelectedDetail(null)} />

      {/* Bulk approve confirm */}
      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Duyệt hàng loạt"
        message={`Bạn có chắc muốn duyệt ${selectedIds.length} yêu cầu đã chọn?`}
        confirmLabel="Duyệt tất cả"
        onConfirm={executeBulkApprove}
        onCancel={() => setBulkConfirmOpen(false)}
      />

      {/* Pagination */}
      <div className="flex items-center justify-center gap-1">
        <button className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
          style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
          <ChevronLeft size={14} /> Trước
        </button>
        {[1, 2, 3].map((p) => (
          <button key={p} onClick={() => setCurrentPage(p)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium border transition-colors"
            style={{ borderColor: p === currentPage ? "#1DB87A" : "#e2ede9", background: p === currentPage ? "#1DB87A" : undefined, color: p === currentPage ? "white" : "#6b7f78" }}>
            {p}
          </button>
        ))}
        <button className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50"
          style={{ borderColor: "#e2ede9", color: "#6b7f78" }}>
          Sau <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
