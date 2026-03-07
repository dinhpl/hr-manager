"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BedDouble,
  Calculator,
  Clock,
  History,
  MinusCircle,
  PlusCircle,
  Save,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { formatDateVN, getStatusLabel } from "@/lib/hr-utils";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";

type OvertimeApiItem = {
  id: string | number;
  date: string;
  hours: number | string;
  status?: string | null;
  otType?: "weekday" | "weekend" | "holiday" | null;
  compOffHours?: number | string | null;
};

type CompOffApiItem = {
  id: string | number;
  toDate: string;
  totalHours?: number;
  expireDays?: number;
  derivedStatus?: string;
  overtime?: {
    date?: string;
    hours?: number | string;
  } | null;
};

type CompOffSummary = {
  totalHours: number;
  expiredHours: number;
  expiringHours: number;
  availableHours: number;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  rejected: "bg-red-50 text-red-500 border border-red-200",
  available: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  expiring: "bg-amber-50 text-amber-600 border border-amber-200",
  expired: "bg-red-50 text-red-500 border border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  available: "Có sẵn",
  expiring: "Sắp hết hạn",
  expired: "Đã hết hạn",
};

const RATE: Record<string, number> = { weekday: 1, weekend: 1.5, holiday: 2 };

const RATE_LABEL: Record<string, string> = {
  weekday: "Ngày thường (x1.0)",
  weekend: "Cuối tuần (x1.5)",
  holiday: "Ngày lễ (x2.0)",
};

function toMins(timeValue: string) {
  if (!timeValue) return 0;
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatHours(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "--";
  return `${numeric.toFixed(1)}h`;
}

function detectOtType(dateValue?: string | null) {
  if (!dateValue) return "weekday";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "weekday";
  const day = date.getDay();
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

function getOtTypeLabel(type?: string | null) {
  switch (type) {
    case "weekend":
      return "Cuối tuần";
    case "holiday":
      return "Ngày lễ";
    default:
      return "Ngày thường";
  }
}

function getMonthRange(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return getMonthRange(now.toISOString().slice(0, 10));
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    fromDate: start.toISOString(),
    toDate: new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23,
      59,
      59,
      999
    ).toISOString(),
  };
}

function toApiDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

export default function OvertimePage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [workDate, setWorkDate] = useState(today);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("13:00");
  const [otType, setOtType] = useState("weekday");
  const [reason, setReason] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<OvertimeApiItem[]>([]);
  const [monthlyItems, setMonthlyItems] = useState<OvertimeApiItem[]>([]);
  const [compOffRows, setCompOffRows] = useState<CompOffApiItem[]>([]);
  const [compOffSummary, setCompOffSummary] = useState<CompOffSummary | null>(null);

  const calc = useMemo(() => {
    if (!startTime || !endTime) return null;

    let total = toMins(endTime) - toMins(startTime);
    if (lunchStart && lunchEnd) {
      total -= toMins(lunchEnd) - toMins(lunchStart);
    }
    if (total <= 0) return null;

    const otHours = total / 60;
    const compoff = otHours * RATE[otType];
    return { otHours, compoff };
  }, [endTime, lunchEnd, lunchStart, otType, startTime]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const monthRange = getMonthRange(workDate);
      const [historyResponse, monthlyResponse, compOffListResponse, compOffSummaryResponse] =
        await Promise.all([
          apiClient.get<OvertimeApiItem[]>("/api/overtime", {
            params: { page: 1, limit: 6 },
          }),
          apiClient.get<OvertimeApiItem[]>("/api/overtime", {
            params: {
              page: 1,
              limit: 100,
              fromDate: monthRange.fromDate,
              toDate: monthRange.toDate,
            },
          }),
          apiClient.get<CompOffApiItem[]>("/api/comp-off", {
            params: { page: 1, limit: 5, sortBy: "expiry_asc", status: "APPROVED" },
          }),
          apiClient.get<CompOffSummary>("/api/comp-off/summary"),
        ]);

      setHistoryItems(historyResponse.data ?? []);
      setMonthlyItems(monthlyResponse.data ?? []);
      setCompOffRows(compOffListResponse.data ?? []);
      setCompOffSummary(compOffSummaryResponse.data ?? null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Khong the tai du lieu overtime."
      );
    } finally {
      setIsLoading(false);
    }
  }, [workDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const monthlyTotalHours = useMemo(
    () => monthlyItems.reduce((sum, item) => sum + Number(item.hours ?? 0), 0),
    [monthlyItems]
  );

  const monthlyPendingHours = useMemo(
    () =>
      monthlyItems
        .filter((item) => getStatusLabel(item.status) === "pending")
        .reduce((sum, item) => sum + Number(item.hours ?? 0), 0),
    [monthlyItems]
  );

  const backendDetectedType = useMemo(() => detectOtType(workDate), [workDate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!calc) {
      setSubmittedMessage(null);
      setErrorMessage("Thoi gian OT khong hop le. Vui long kiem tra lai.");
      return;
    }

    setIsSubmitting(true);
    setSubmittedMessage(null);
    setErrorMessage(null);

    try {
      await apiClient.post("/api/overtime", {
        date: toApiDateTime(workDate, startTime),
        hours: Number(calc.otHours.toFixed(1)),
        reason: reason.trim(),
      });

      setSubmittedMessage("Da gui dang ky OT thanh cong.");
      setEndTime("");
      setReason("");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Khong the gui dang ky OT."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "#D3F2E7" }}
        >
          <Clock size={18} style={{ color: "#0E474E" }} />
        </div>
        <h1 className="text-xl font-bold" style={{ color: "#203430" }}>
          Quản lý làm thêm giờ (Overtime)
        </h1>
      </div>

      {(errorMessage || submittedMessage) && (
        <div
          className="rounded-xl border p-3 text-sm font-medium"
          style={{
            background: submittedMessage ? "#D3F2E7" : "#fff5f5",
            color: submittedMessage ? "#0E474E" : "#b91c1c",
            borderColor: submittedMessage ? "#9fdcc4" : "#fecaca",
          }}
        >
          {submittedMessage ?? errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Tổng OT tháng này",
            value: formatHours(monthlyTotalHours),
            icon: Clock,
            color: "#3b82f6",
            bg: "#eff6ff",
          },
          {
            label: "OT chờ duyệt",
            value: formatHours(monthlyPendingHours),
            icon: Clock,
            color: "#f59e0b",
            bg: "#fffbeb",
          },
          {
            label: "Comp-off tích lũy",
            value: formatHours(compOffSummary?.totalHours),
            icon: PlusCircle,
            color: "#1DB87A",
            bg: "#f0fdf4",
          },
          {
            label: "Comp-off đã dùng",
            value: "--",
            icon: MinusCircle,
            color: "#ef4444",
            bg: "#fef2f2",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "#e2ede9" }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: stat.bg }}
            >
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "#203430" }}>
              {isLoading ? "..." : stat.value}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "#6b7f78" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#e2ede9" }}>
          <div
            className="mb-5 flex items-center gap-2 border-b pb-4"
            style={{ borderColor: "#e2ede9" }}
          >
            <PlusCircle size={17} style={{ color: "#1DB87A" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#203430" }}>
              Đăng ký làm thêm giờ
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: "#203430" }}
              >
                Ngày làm việc *
              </label>
              <DatePicker value={workDate} onChange={setWorkDate} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "#203430" }}
                >
                  Giờ bắt đầu *
                </label>
                <TimePicker value={startTime} onChange={setStartTime} required />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "#203430" }}
                >
                  Giờ kết thúc *
                </label>
                <TimePicker value={endTime} onChange={setEndTime} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "#6b7f78" }}
                >
                  Nghỉ trưa từ
                </label>
                <TimePicker value={lunchStart} onChange={setLunchStart} />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "#6b7f78" }}
                >
                  Nghỉ trưa đến
                </label>
                <TimePicker value={lunchEnd} onChange={setLunchEnd} />
              </div>
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-semibold"
                style={{ color: "#203430" }}
              >
                Loại overtime
              </label>
              <RadioGroup
                value={otType}
                onValueChange={setOtType}
                className="flex flex-wrap gap-4"
              >
                {[
                  { val: "weekday", label: "Ngày thường" },
                  { val: "weekend", label: "Cuối tuần" },
                  { val: "holiday", label: "Ngày lễ" },
                ].map((option) => (
                  <label
                    key={option.val}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: "#203430" }}
                  >
                    <RadioGroupItem value={option.val} id={`ot-type-${option.val}`} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
              <p className="mt-2 text-xs" style={{ color: "#6b7f78" }}>
                Backend hiện xác định loại OT theo ngày làm việc thực tế. Dự đoán từ ngày
                đã chọn: <strong>{getOtTypeLabel(backendDetectedType)}</strong>.
              </p>
            </div>

            {calc && (
              <div
                className="rounded-lg border p-3"
                style={{ background: "#f0fdf9", borderColor: "#D3F2E7" }}
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <Calculator size={14} style={{ color: "#0E474E" }} />
                  <span className="text-xs font-semibold" style={{ color: "#0E474E" }}>
                    Tính toán OT
                  </span>
                </div>
                <div className="flex items-center justify-between text-center">
                  <div>
                    <p className="text-xl font-bold" style={{ color: "#1DB87A" }}>
                      {calc.otHours.toFixed(1)}h
                    </p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      Giờ OT
                    </p>
                  </div>
                  <p className="px-2 text-xs font-medium" style={{ color: "#0E474E" }}>
                    {RATE_LABEL[otType]}
                  </p>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "#0E474E" }}>
                      {calc.compoff.toFixed(1)}h
                    </p>
                    <p className="text-xs" style={{ color: "#6b7f78" }}>
                      Comp-off ước tính
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: "#203430" }}
              >
                Lý do làm thêm giờ *
              </label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Nhập lý do làm thêm giờ..."
                className="resize-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "#1DB87A" }}
              >
                <PlusCircle size={15} /> {isSubmitting ? "Đang gửi..." : "Gửi đăng ký OT"}
              </button>
              <button
                type="button"
                disabled
                title="Backend hiện chưa hỗ trợ lưu nháp."
                className="flex cursor-not-allowed items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold opacity-60"
                style={{ borderColor: "#e2ede9", color: "#203430" }}
              >
                <Save size={15} /> Lưu nháp
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#e2ede9" }}>
          <div
            className="mb-5 flex items-center justify-between border-b pb-4"
            style={{ borderColor: "#e2ede9" }}
          >
            <div className="flex items-center gap-2">
              <History size={17} style={{ color: "#1DB87A" }} />
              <h2 className="text-sm font-semibold" style={{ color: "#203430" }}>
                Lịch sử OT gần đây
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: "#D3F2E7", color: "#0E474E" }}
            >
              Làm mới
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                {["Ngày", "Giờ OT", "Loại", "Trạng thái"].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2.5 text-left text-xs font-semibold"
                    style={{ color: "#6b7f78" }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyItems.length > 0 ? (
                historyItems.map((row) => {
                  const statusKey = getStatusLabel(row.status);
                  const otTypeLabel = getOtTypeLabel(row.otType ?? detectOtType(row.date));

                  return (
                    <tr
                      key={String(row.id)}
                      className="border-b last:border-0"
                      style={{ borderColor: "#f0f4f2" }}
                    >
                      <td
                        className="px-3 py-3 text-xs font-medium"
                        style={{ color: "#203430" }}
                      >
                        {formatDateVN(row.date)}
                      </td>
                      <td className="px-3 py-3 text-xs font-bold" style={{ color: "#203430" }}>
                        {formatHours(row.hours)}
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>
                        {otTypeLabel}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[statusKey] ?? STATUS_STYLE.pending}`}
                        >
                          {STATUS_LABEL[statusKey] ?? row.status ?? "Chờ cập nhật"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm"
                    style={{ color: "#6b7f78" }}
                  >
                    {isLoading ? "Đang tải dữ liệu OT..." : "Chưa có dữ liệu overtime."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#e2ede9" }}>
        <div
          className="mb-4 flex items-center justify-between border-b pb-4"
          style={{ borderColor: "#e2ede9" }}
        >
          <div className="flex items-center gap-2">
            <BedDouble size={17} style={{ color: "#1DB87A" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#203430" }}>
              Tổng quan Comp-off
            </h2>
          </div>
          <Link
            href="/dashboard/compoff"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: "#D3F2E7", color: "#0E474E" }}
          >
            Quản lý chi tiết
          </Link>
        </div>
        <div
          className="mb-4 rounded-lg border p-3 text-xs"
          style={{ background: "#f0fdf9", color: "#0E474E", borderColor: "#D3F2E7" }}
        >
          <strong>Quy tắc tính Comp-off:</strong> Ngày thường: 1h OT = 1h nghỉ bù |
          Cuối tuần: 1h OT = 1.5h nghỉ bù | Ngày lễ: 1h OT = 2h nghỉ bù
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {[
            { label: "Khả dụng", value: formatHours(compOffSummary?.availableHours) },
            { label: "Sắp hết hạn", value: formatHours(compOffSummary?.expiringHours) },
            { label: "Đã hết hạn", value: formatHours(compOffSummary?.expiredHours) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border p-3"
              style={{ borderColor: "#e2ede9", background: "#fafdfb" }}
            >
              <p className="text-lg font-bold" style={{ color: "#203430" }}>
                {isLoading ? "..." : item.value}
              </p>
              <p className="text-xs" style={{ color: "#6b7f78" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f7f7f7" }}>
                {[
                  "Ngày OT",
                  "Giờ OT",
                  "Loại",
                  "Comp-off tích lũy",
                  "Hạn sử dụng",
                  "Trạng thái",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2.5 text-left text-xs font-semibold"
                    style={{ color: "#6b7f78" }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compOffRows.length > 0 ? (
                compOffRows.map((row) => {
                  const otType = detectOtType(row.overtime?.date);
                  return (
                    <tr
                      key={String(row.id)}
                      className="border-b last:border-0"
                      style={{ borderColor: "#f0f4f2" }}
                    >
                      <td
                        className="px-3 py-3 text-xs font-medium"
                        style={{ color: "#203430" }}
                      >
                        {formatDateVN(row.overtime?.date)}
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>
                        {formatHours(row.overtime?.hours)}
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>
                        {getOtTypeLabel(otType)}
                      </td>
                      <td
                        className="px-3 py-3 text-xs font-bold"
                        style={{ color: "#1DB87A" }}
                      >
                        {formatHours(row.totalHours)}
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>
                        {formatDateVN(row.toDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[row.derivedStatus ?? "available"] ?? STATUS_STYLE.available}`}
                        >
                          {STATUS_LABEL[row.derivedStatus ?? "available"] ?? "Có sẵn"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm"
                    style={{ color: "#6b7f78" }}
                  >
                    {isLoading
                      ? "Đang tải dữ liệu comp-off..."
                      : "Chưa có bản ghi comp-off đã duyệt."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
