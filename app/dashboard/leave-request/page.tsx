"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Info,
  Tag,
  CalendarDays,
  Clock,
  MessageSquare,
  Users2,
  Paperclip,
  CloudUpload,
  Save,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  FileText,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, apiClient } from "@/lib/api-client";
import { numberValue, toIsoDateTime } from "@/lib/hr-utils";

type DurationMode = "FULL_DAY" | "HALF_DAY" | "HOURLY";

interface LeaveTypeOption {
  id: string;
  code: string;
  name: string;
  color?: string;
}

interface LeaveBalanceRecord {
  id: string;
  totalDays: number | string;
  usedDays: number | string;
  leaveType: {
    code: string;
    name: string;
    color?: string;
  };
}

interface UserDropdownItem {
  id: string;
  fullName: string;
  username: string;
  department?: string | null;
}

function countWorkingDays(fromDate: string, toDate: string): number {
  if (!fromDate || !toDate) return 0;
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function LeaveRequestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [handoverPersons, setHandoverPersons] = useState<UserDropdownItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("FULL_DAY");
  const [fromTime, setFromTime] = useState("08:00");
  const [toTime, setToTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [handoverPerson, setHandoverPerson] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "submitting" | "success">("idle");
  const [alert, setAlert] = useState<{ type: "warning" | "info" | "success"; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<LeaveTypeOption[]>("/api/leave-types"),
      apiClient.get<LeaveBalanceRecord[]>("/api/leave-balances"),
      apiClient.get<UserDropdownItem[]>("/api/users/dropdown"),
    ])
      .then(([leaveTypeRes, balanceRes, handoverRes]) => {
        setLeaveTypes(leaveTypeRes.data);
        setBalances(balanceRes.data);
        setHandoverPersons(handoverRes.data);
      })
      .catch((err) => {
        setAlert({
          type: "warning",
          message: err instanceof Error ? err.message : "Không tải được dữ liệu biểu mẫu.",
        });
      })
      .finally(() => setLoadingOptions(false));
  }, []);

  // Calculate days
  const calcDays = (): number => {
    if (!fromDate || !toDate) return 0;
    const base = countWorkingDays(fromDate, toDate);
    if (durationMode === "HALF_DAY") return base * 0.5;
    if (durationMode === "HOURLY") {
      if (!fromTime || !toTime) return 0;
      const start = new Date(`2000-01-01T${fromTime}`);
      const end = new Date(`2000-01-01T${toTime}`);
      const hours = (end.getTime() - start.getTime()) / 3600000;
      return Math.max(0, hours / 8);
    }
    return base;
  };

  const days = calcDays();
  const selectedLeaveType = leaveTypes.find((item) => item.code === leaveType);
  const annualBalance = balances.find((item) => item.leaveType.code === "AL");
  const compOffBalance = balances.find((item) => item.leaveType.code === "CO");
  const leaveBalanceSummary = {
    granted: numberValue(annualBalance?.totalDays),
    used: numberValue(annualBalance?.usedDays),
    remaining:
      numberValue(annualBalance?.totalDays) - numberValue(annualBalance?.usedDays),
    compOffHours:
      (numberValue(compOffBalance?.totalDays) - numberValue(compOffBalance?.usedDays)) * 8,
  };

  const checkBalance = () => {
    if (!selectedLeaveType || days === 0) return null;
    if (selectedLeaveType.code === "AL" && days > leaveBalanceSummary.remaining) {
      return `Cảnh báo: Bạn chỉ còn ${leaveBalanceSummary.remaining} ngày phép năm. Yêu cầu ${days} ngày sẽ vượt quá số phép hiện có.`;
    }
    if (selectedLeaveType.code === "CO" && days * 8 > leaveBalanceSummary.compOffHours) {
      return `Cảnh báo: Bạn chỉ còn ${leaveBalanceSummary.compOffHours} giờ comp-off. Yêu cầu ${days * 8} giờ sẽ vượt quá.`;
    }
    return null;
  };

  const balanceWarning = checkBalance();

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setAlert({ type: "warning", message: "Định dạng file không hỗ trợ. Vui lòng chọn PDF, DOC, DOCX, JPG hoặc PNG." });
      return;
    }
    if (file.size > maxSize) {
      setAlert({ type: "warning", message: "File vượt quá 5MB. Vui lòng chọn file nhỏ hơn." });
      return;
    }
    setAttachedFile(file);
    setAlert(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, []);

  const resetForm = () => {
    setLeaveType("");
    setFromDate("");
    setToDate("");
    setDurationMode("FULL_DAY");
    setFromTime("08:00");
    setToTime("17:00");
    setReason("");
    setHandoverPerson("");
    setAttachedFile(null);
    setDragging(false);
  };

  const handleSubmit = async () => {
    if (!selectedLeaveType || !fromDate || !toDate || !reason.trim()) {
      setAlert({
        type: "warning",
        message: "Vui lòng điền đầy đủ các trường bắt buộc (*).",
      });
      return;
    }

    const handoverName =
      handoverPersons.find((item) => item.id === handoverPerson)?.fullName ?? "";

    const composedReason = [
      reason.trim(),
      durationMode !== "FULL_DAY"
        ? `Hình thức nghỉ: ${
            durationMode === "HALF_DAY" ? "Nửa ngày" : "Theo giờ"
          }`
        : null,
      durationMode === "HOURLY" ? `Khung giờ: ${fromTime} - ${toTime}` : null,
      handoverName ? `Người bàn giao: ${handoverName}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const formData = new FormData();
    formData.append("leaveTypeId", selectedLeaveType.id);
    formData.append("fromDate", toIsoDateTime(fromDate));
    formData.append("toDate", toIsoDateTime(toDate, true));
    formData.append("totalDays", String(days));
    formData.append("reason", composedReason);
    if (attachedFile) {
      formData.append("attachment", attachedFile);
    }

    setAlert(null);
    setSubmitState("submitting");

    try {
      await apiRequest({
        url: "/api/leave-requests",
        method: "POST",
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSubmitState("success");
      setAlert({
        type: "success",
        message: "Yêu cầu nghỉ phép đã được gửi thành công! Đang chờ phê duyệt.",
      });

      setTimeout(() => {
        router.push("/dashboard/leave-history");
      }, 1200);
    } catch (err) {
      setSubmitState("idle");
      setAlert({
        type: "warning",
        message:
          err instanceof Error ? err.message : "Không thể gửi yêu cầu nghỉ phép.",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
          <PlusCircle size={20} style={{ color: "#1DB87A" }} />
        </div>
        <div>
          <h1 className="font-bold text-lg" style={{ color: "#203430" }}>Đăng ký nghỉ phép mới</h1>
          <p className="text-xs text-muted-foreground">Điền đầy đủ thông tin để gửi yêu cầu</p>
        </div>
      </div>

      {/* Leave balance info */}
      <div className="rounded-xl p-4 mb-5" style={{ background: "#f0f9f5", border: "1px solid #D3F2E7" }}>
        <div className="flex items-center gap-2 mb-3">
          <Info size={15} style={{ color: "#1DB87A" }} />
          <span className="text-sm font-semibold" style={{ color: "#0E474E" }}>Thông tin phép hiện tại</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Phép năm được cấp", value: leaveBalanceSummary.granted },
            { label: "Đã sử dụng", value: leaveBalanceSummary.used },
            { label: "Còn lại", value: leaveBalanceSummary.remaining },
            { label: "Comp-off (giờ)", value: leaveBalanceSummary.compOffHours },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-2xl font-bold" style={{ color: "#1DB87A" }}>{item.value}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alert */}
          {alert && (
        <div
              className="flex items-start gap-3 px-4 py-3 rounded-lg mb-4 text-sm"
          style={
            alert.type === "warning"
              ? { background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e" }
              : alert.type === "success"
              ? { background: "#d1fae5", border: "1px solid #6ee7b7", color: "#065f46" }
              : { background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e3a8a" }
          }
        >
          {alert.type === "warning" ? <AlertTriangle size={15} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
          {alert.message}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl shadow-sm p-6" style={{ border: "1px solid #e2ede9" }}>
        <div className="space-y-5">
          {/* Leave type */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
              <Tag size={14} style={{ color: "#1DB87A" }} /> Loại nghỉ phép <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <Select
              value={leaveType || "placeholder"}
              onValueChange={(value) => setLeaveType(value === "placeholder" ? "" : value)}
              disabled={loadingOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Chọn loại nghỉ --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">-- Chọn loại nghỉ --</SelectItem>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.code}>
                    {`${t.code} - ${t.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
                <CalendarDays size={14} style={{ color: "#1DB87A" }} /> Từ ngày <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <DatePicker value={fromDate} onChange={setFromDate} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
                <CalendarDays size={14} style={{ color: "#1DB87A" }} /> Đến ngày <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <DatePicker value={toDate} onChange={setToDate} />
            </div>
          </div>

          {/* Duration mode */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
              <Clock size={14} style={{ color: "#1DB87A" }} /> Hình thức nghỉ <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div className="flex gap-3 flex-wrap">
              {(["FULL_DAY", "HALF_DAY", "HOURLY"] as DurationMode[]).map((mode) => {
                const labels: Record<DurationMode, string> = { FULL_DAY: "Cả ngày", HALF_DAY: "Nửa ngày", HOURLY: "Theo giờ" };
                const isSelected = durationMode === mode;
                return (
                  <label
                    key={mode}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all select-none"
                    style={
                      isSelected
                        ? { background: "#D3F2E7", color: "#0E474E", border: "2px solid #1DB87A" }
                        : { background: "#f7f7f7", color: "#6b7f78", border: "2px solid transparent" }
                    }
                  >
                    <input
                      type="radio"
                      name="durationMode"
                      value={mode}
                      checked={isSelected}
                      onChange={() => setDurationMode(mode)}
                      className="hidden"
                    />
                    <span
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: isSelected ? "#1DB87A" : "#c4d4cf" }}
                    >
                      {isSelected && <span className="w-2 h-2 rounded-full" style={{ background: "#1DB87A" }} />}
                    </span>
                    {labels[mode]}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Time fields (hourly) */}
          {durationMode === "HOURLY" && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ background: "#f7f7f7", border: "1px dashed #D3F2E7" }}>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#203430" }}>Từ giờ</label>
                <TimePicker value={fromTime} onChange={setFromTime} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "#203430" }}>Đến giờ</label>
                <TimePicker value={toTime} onChange={setToTime} />
              </div>
            </div>
          )}

          {/* Calculation */}
          {days > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}>
              <Calculator size={16} style={{ color: "#d97706" }} />
              <span className="text-sm" style={{ color: "#92400e" }}>
                Số ngày nghỉ tính toán: <strong>{days}</strong> ngày
                {durationMode === "HOURLY" && ` (${days * 8} giờ)`}
              </span>
            </div>
          )}

          {/* Balance warning */}
          {balanceWarning && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
              <AlertTriangle size={15} style={{ color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
              <span className="text-sm" style={{ color: "#dc2626" }}>{balanceWarning}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
              <MessageSquare size={14} style={{ color: "#1DB87A" }} /> Lý do nghỉ <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do nghỉ phép..."
              className="resize-none"
            />
          </div>

          {/* Handover person */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
              <Users2 size={14} style={{ color: "#1DB87A" }} /> Người bàn giao/hỗ trợ khi cần
            </label>
            <Select
              value={handoverPerson || "placeholder"}
              onValueChange={(value) => setHandoverPerson(value === "placeholder" ? "" : value)}
              disabled={loadingOptions}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Chọn người bàn giao --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">-- Chọn người bàn giao --</SelectItem>
                {handoverPersons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File attachment */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: "#203430" }}>
              <Paperclip size={14} style={{ color: "#1DB87A" }} /> File đính kèm (nếu có)
            </label>
            {attachedFile ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#f0f9f5", border: "1px solid #D3F2E7" }}>
                <FileText size={16} style={{ color: "#1DB87A" }} />
                <span className="text-sm font-medium flex-1 truncate" style={{ color: "#203430" }}>{attachedFile.name}</span>
                <span className="text-xs text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                className="rounded-lg p-6 text-center cursor-pointer transition-all"
                style={{
                  border: `2px dashed ${dragging ? "#1DB87A" : "#D3F2E7"}`,
                  background: dragging ? "#f0f9f5" : "#fafffe",
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <CloudUpload size={28} className="mx-auto mb-2" style={{ color: "#1DB87A" }} />
                <p className="text-sm font-medium" style={{ color: "#203430" }}>Nhấp để chọn file hoặc kéo thả file vào đây</p>
                <p className="text-xs mt-1 text-muted-foreground">Hỗ trợ: PDF, DOC, DOCX, JPG, PNG (Tối đa 5MB)</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid #e2ede9" }}>
            <button
              type="button"
              onClick={resetForm}
              disabled={submitState === "submitting" || submitState === "success"}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-70"
              style={{ background: "#f7f7f7", color: "#6b7f78", border: "1px solid #e2ede9" }}
            >
              <Save size={15} />
              Đặt lại
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitState !== "idle" || loadingOptions}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)" }}
            >
              <Send size={15} />
              {submitState === "submitting" ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ml-auto"
              style={{ background: "#f7f7f7", color: "#6b7f78", border: "1px solid #e2ede9" }}
            >
              <X size={15} /> Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
