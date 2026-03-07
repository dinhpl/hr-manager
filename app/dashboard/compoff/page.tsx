'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Calculator,
  CheckCircle,
  Clock,
  FileDown,
  History,
  PlusCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { formatDateVN, getStatusLabel } from '@/lib/hr-utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CompOffSummary = {
  totalHours: number;
  expiredHours: number;
  expiringHours: number;
  availableHours: number;
};

type CompOffApiItem = {
  id: string | number;
  status?: string | null;
  toDate: string;
  totalHours: number;
  expireDays: number;
  derivedStatus?: string | null;
  createdAt?: string;
  approvedAt?: string | null;
  overtime?: {
    id?: string | number;
    date?: string;
    hours?: number | string;
  } | null;
};

type TimelineItem = {
  id: string;
  date: string;
  text: string;
  type: 'earn' | 'expire' | 'pending' | 'reject';
};

const OT_TYPE_LABEL: Record<string, string> = {
  weekday: 'Ngày thường',
  weekend: 'Cuối tuần',
  holiday: 'Ngày lễ',
};

const OT_TYPE_COLOR: Record<string, string> = {
  weekday: 'bg-blue-50 text-blue-600 border border-blue-200',
  weekend: 'bg-purple-50 text-purple-600 border border-purple-200',
  holiday: 'bg-orange-50 text-orange-600 border border-orange-200',
};

const STATUS_BORDER: Record<string, string> = {
  available: '#1DB87A',
  expiring: '#f59e0b',
  expired: '#ef4444',
  pending: '#f59e0b',
  rejected: '#9ca3af',
};

const STATUS_BG: Record<string, string> = {
  available: '#f0fdf9',
  expiring: '#fffbeb',
  expired: '#fff5f5',
  pending: '#fffaf0',
  rejected: '#f9fafb',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Có sẵn',
  expiring: 'Sắp hết hạn',
  expired: 'Đã hết hạn',
  pending: 'Chờ duyệt',
  rejected: 'Từ chối',
};

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  expiring: 'bg-amber-50 text-amber-600 border border-amber-200',
  expired: 'bg-red-50 text-red-500 border border-red-200',
  pending: 'bg-amber-50 text-amber-600 border border-amber-200',
  rejected: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const RATE: Record<string, number> = { weekday: 1, weekend: 1.5, holiday: 2 };

function formatHours(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(1)}h`;
}

function detectOtType(dateValue?: string | null) {
  if (!dateValue) return 'weekday';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'weekday';
  const day = date.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

function getDisplayStatus(item: CompOffApiItem) {
  const rawStatus = getStatusLabel(item.status);
  if (rawStatus === 'pending' || rawStatus === 'rejected') {
    return rawStatus;
  }
  return item.derivedStatus ?? 'available';
}

function getProgressPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export default function CompoffPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('expiry_asc');
  const [calcHours, setCalcHours] = useState('');
  const [calcType, setCalcType] = useState('weekday');
  const [calcResult, setCalcResult] = useState<number | null>(null);
  const [items, setItems] = useState<CompOffApiItem[]>([]);
  const [summary, setSummary] = useState<CompOffSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [listResponse, summaryResponse] = await Promise.all([
        apiClient.get<CompOffApiItem[]>('/api/comp-off', {
          params: { page: 1, limit: 30, sortBy },
        }),
        apiClient.get<CompOffSummary>('/api/comp-off/summary'),
      ]);

      setItems(listResponse.data ?? []);
      setSummary(summaryResponse.data ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai du lieu comp-off.');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const displayStatus = getDisplayStatus(item);
      const otType = detectOtType(item.overtime?.date);

      if (statusFilter && displayStatus !== statusFilter) return false;
      if (typeFilter && otType !== typeFilter) return false;
      return true;
    });
  }, [items, statusFilter, typeFilter]);

  const progressData = useMemo(() => {
    const total = summary?.totalHours ?? 0;
    const available = summary?.availableHours ?? 0;
    const expiring = summary?.expiringHours ?? 0;
    const expired = summary?.expiredHours ?? 0;

    return {
      total,
      available,
      expiring,
      expired,
      availablePct: getProgressPercent(available, total),
      expiringPct: getProgressPercent(expiring, total),
      expiredPct: getProgressPercent(expired, total),
    };
  }, [summary]);

  const timeline = useMemo<TimelineItem[]>(() => {
    return items
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.approvedAt ?? a.createdAt ?? a.toDate).getTime();
        const bTime = new Date(b.approvedAt ?? b.createdAt ?? b.toDate).getTime();
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((item) => {
        const displayStatus = getDisplayStatus(item);
        const dateValue = item.approvedAt ?? item.createdAt ?? item.toDate;
        const otType = detectOtType(item.overtime?.date);

        if (displayStatus === 'expired') {
          return {
            id: `expired-${item.id}`,
            date: formatDateVN(item.toDate),
            text: `${formatHours(item.totalHours)} comp-off đã hết hạn.`,
            type: 'expire',
          };
        }

        if (displayStatus === 'pending') {
          return {
            id: `pending-${item.id}`,
            date: formatDateVN(dateValue),
            text: `Yêu cầu nghỉ bù ${formatHours(item.totalHours)} đang chờ duyệt.`,
            type: 'pending',
          };
        }

        if (displayStatus === 'rejected') {
          return {
            id: `rejected-${item.id}`,
            date: formatDateVN(dateValue),
            text: `Yêu cầu nghỉ bù ${formatHours(item.totalHours)} đã bị từ chối.`,
            type: 'reject',
          };
        }

        return {
          id: `earn-${item.id}`,
          date: formatDateVN(dateValue),
          text: `Tích lũy ${formatHours(item.totalHours)} từ ${formatHours(
            item.overtime?.hours,
          )} OT ${OT_TYPE_LABEL[otType]}.`,
          type: 'earn',
        };
      });
  }, [items]);

  const quickStats = useMemo(() => {
    const sourceOtHours = items.reduce((sum, item) => sum + Number(item.overtime?.hours ?? 0), 0);
    const approvedCount = items.filter((item) => getStatusLabel(item.status) === 'approved').length;
    const pendingCount = items.filter((item) => getStatusLabel(item.status) === 'pending').length;

    return {
      sourceOtHours,
      approvedCount,
      pendingCount,
      expiredHours: summary?.expiredHours ?? 0,
    };
  }, [items, summary?.expiredHours]);

  const showActionUnavailable = () => {
    setActionMessage(
      'Chức năng này chưa có endpoint backend tương ứng nên đang được giữ ở trạng thái an toàn.',
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: '#D3F2E7' }}
          >
            <CalendarCheck size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Quản lý nghỉ bù (Comp-off)
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            title="Trang này chưa có form tạo yêu cầu nghỉ bù."
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white opacity-60"
            style={{ background: '#1DB87A' }}
          >
            <PlusCircle size={14} /> Đăng ký nghỉ bù
          </button>
          <button
            type="button"
            disabled
            title="Backend chưa có endpoint export comp-off."
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold opacity-60"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <FileDown size={14} /> Export
          </button>
          <button
            type="button"
            onClick={() =>
              setActionMessage('Khối tính toán ở cột phải chỉ dùng để ước tính nhanh.')
            }
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <Calculator size={14} /> Tính toán
          </button>
        </div>
      </div>

      {(errorMessage || actionMessage) && (
        <div
          className="rounded-xl border p-3 text-sm"
          style={{
            background: errorMessage ? '#fff5f5' : '#f7fffb',
            color: errorMessage ? '#b91c1c' : '#0E474E',
            borderColor: errorMessage ? '#fecaca' : '#D3F2E7',
          }}
        >
          {errorMessage ?? actionMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: 'Tổng tích lũy',
            value: formatHours(summary?.totalHours),
            icon: PlusCircle,
            color: '#1DB87A',
            bg: '#f0fdf9',
          },
          {
            label: 'Khả dụng',
            value: formatHours(summary?.availableHours),
            icon: Clock,
            color: '#3b82f6',
            bg: '#eff6ff',
          },
          {
            label: 'Đã hết hạn',
            value: formatHours(summary?.expiredHours),
            icon: CheckCircle,
            color: '#f59e0b',
            bg: '#fffbeb',
          },
          {
            label: 'Sắp hết hạn',
            value: formatHours(summary?.expiringHours),
            icon: AlertTriangle,
            color: '#ef4444',
            bg: '#fef2f2',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: '#e2ede9' }}
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: stat.bg }}
            >
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#203430' }}>
              {isLoading ? '...' : stat.value}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
        <h2 className="mb-4 text-sm font-semibold" style={{ color: '#203430' }}>
          Tình trạng comp-off theo dữ liệu thật
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs" style={{ color: '#6b7f78' }}>
              <span>Khả dụng</span>
              <span className="font-semibold" style={{ color: '#203430' }}>
                {formatHours(progressData.available)} / {formatHours(progressData.total)} (
                {progressData.availablePct}%)
              </span>
            </div>
            <div
              className="flex h-5 overflow-hidden rounded-full"
              style={{ background: '#f0f4f2' }}
            >
              <div
                className="flex h-full items-center justify-center text-xs font-medium text-white"
                style={{ width: `${progressData.availablePct}%`, background: '#1DB87A' }}
              >
                {progressData.availablePct > 10 ? formatHours(progressData.available) : ''}
              </div>
              <div
                className="flex h-full items-center justify-center text-xs font-medium text-white"
                style={{ width: `${progressData.expiringPct}%`, background: '#f59e0b' }}
              >
                {progressData.expiringPct > 10 ? formatHours(progressData.expiring) : ''}
              </div>
              <div
                className="flex h-full items-center justify-center text-xs font-medium text-white"
                style={{ width: `${progressData.expiredPct}%`, background: '#ef4444' }}
              >
                {progressData.expiredPct > 10 ? formatHours(progressData.expired) : ''}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Khả dụng', val: formatHours(progressData.available), color: '#1DB87A' },
                {
                  label: 'Sắp hết hạn',
                  val: formatHours(progressData.expiring),
                  color: '#f59e0b',
                },
                {
                  label: 'Đã hết hạn',
                  val: formatHours(progressData.expired),
                  color: '#ef4444',
                },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-sm font-bold" style={{ color: stat.color }}>
                    {stat.val}
                  </p>
                  <p className="text-xs" style={{ color: '#6b7f78' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4"
            style={{ borderColor: '#1DB87A', background: '#f0fdf9' }}
          >
            <span className="text-xl font-bold" style={{ color: '#0E474E' }}>
              {progressData.availablePct}%
            </span>
            <span className="text-xs" style={{ color: '#6b7f78' }}>
              Khả dụng
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="flex flex-wrap gap-3">
          {[
            {
              id: 'status',
              label: 'Trạng thái',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                ['', 'Tất cả'],
                ['available', 'Có sẵn'],
                ['expiring', 'Sắp hết hạn'],
                ['expired', 'Đã hết hạn'],
                ['pending', 'Chờ duyệt'],
                ['rejected', 'Từ chối'],
              ],
            },
            {
              id: 'type',
              label: 'Loại OT gốc',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                ['', 'Tất cả'],
                ['weekday', 'Ngày thường'],
                ['weekend', 'Cuối tuần'],
              ],
            },
            {
              id: 'sort',
              label: 'Sắp xếp',
              value: sortBy,
              onChange: setSortBy,
              options: [
                ['expiry_asc', 'Hết hạn sớm nhất'],
                ['expiry_desc', 'Hết hạn muộn nhất'],
                ['hours_desc', 'Giờ nhiều nhất'],
              ],
            },
          ].map((filter) => (
            <div key={filter.id} className="flex flex-col gap-1">
              <label className="text-xs font-semibold" style={{ color: '#6b7f78' }}>
                {filter.label}
              </label>
              <Select
                value={filter.value || `all-${filter.id}`}
                onValueChange={(value) => filter.onChange(value.startsWith('all-') ? '' : value)}
              >
                <SelectTrigger className="min-w-[160px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map(([value, label], index) => {
                    const itemValue = value === '' ? `all-${filter.id}` : value;
                    return (
                      <SelectItem key={`${filter.id}-${index}`} value={itemValue}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="ml-auto self-end">
            <button
              type="button"
              onClick={() => void loadData()}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: '#1DB87A' }}
            >
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold" style={{ color: '#203430' }}>
            Chi tiết comp-off
          </h2>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const displayStatus = getDisplayStatus(item);
              const otType = detectOtType(item.overtime?.date);
              const progressWidth =
                displayStatus === 'expired'
                  ? 100
                  : displayStatus === 'expiring'
                    ? 75
                    : displayStatus === 'pending'
                      ? 35
                      : displayStatus === 'rejected'
                        ? 20
                        : 15;

              return (
                <div
                  key={String(item.id)}
                  className="rounded-xl border-l-4 p-4"
                  style={{
                    borderLeftColor: STATUS_BORDER[displayStatus] ?? '#1DB87A',
                    background: STATUS_BG[displayStatus] ?? '#f9fafb',
                    border: '1px solid #e2ede9',
                    borderLeft: `4px solid ${STATUS_BORDER[displayStatus] ?? '#1DB87A'}`,
                    opacity: displayStatus === 'expired' ? 0.8 : 1,
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: STATUS_BORDER[displayStatus] ?? '#1DB87A' }}
                    >
                      {Number(item.totalHours).toFixed(1)}h
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: '#203430' }}>
                          Overtime ngày {formatDateVN(item.overtime?.date)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${OT_TYPE_COLOR[otType] ?? OT_TYPE_COLOR.weekday}`}
                        >
                          {OT_TYPE_LABEL[otType] ?? OT_TYPE_LABEL.weekday}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#6b7f78' }}>
                        {formatHours(item.overtime?.hours)} OT {OT_TYPE_LABEL[otType]} | Comp-off
                        quy đổi: {formatHours(item.totalHours)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[displayStatus] ?? STATUS_BADGE.available}`}
                    >
                      {STATUS_LABEL[displayStatus] ?? 'Có sẵn'}
                    </span>
                  </div>

                  <div className="mb-3 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1" style={{ color: '#6b7f78' }}>
                      <CalendarCheck size={12} />
                      <span>Hạn sử dụng: {formatDateVN(item.toDate)}</span>
                      {item.expireDays >= 0 && (
                        <span
                          className="ml-1 rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            background: item.expireDays < 30 ? '#fffbeb' : '#f0fdf9',
                            color: item.expireDays < 30 ? '#f59e0b' : '#1DB87A',
                          }}
                        >
                          Còn {item.expireDays} ngày
                        </span>
                      )}
                      {item.expireDays < 0 && (
                        <span
                          className="ml-1 rounded px-1.5 py-0.5 text-xs font-medium"
                          style={{ background: '#fef2f2', color: '#ef4444' }}
                        >
                          Hết hạn {Math.abs(item.expireDays)} ngày trước
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs" style={{ color: '#6b7f78' }}>
                      <span>Trạng thái bản ghi</span>
                      <span className="font-medium">{STATUS_LABEL[displayStatus]}</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{ background: '#e2ede9' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progressWidth}%`,
                          background: STATUS_BORDER[displayStatus] ?? '#1DB87A',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={showActionUnavailable}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: '#1DB87A' }}
                    >
                      Sử dụng
                    </button>
                    <button
                      type="button"
                      onClick={showActionUnavailable}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: '#e2ede9', color: '#203430' }}
                    >
                      Lịch sử
                    </button>
                    <button
                      type="button"
                      onClick={showActionUnavailable}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
                    >
                      OT gốc
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="rounded-xl border bg-white p-6 text-center text-sm"
              style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
            >
              {isLoading ? 'Đang tải danh sách comp-off...' : 'Không có bản ghi phù hợp bộ lọc.'}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div
            className="rounded-xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #0E474E 0%, #1DB87A 100%)' }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Calculator size={16} className="text-white" />
              <h3 className="text-sm font-semibold">Tính toán Comp-off</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Giờ overtime
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={calcHours}
                  onChange={(event) => setCalcHours(event.target.value)}
                  placeholder="Nhập số giờ OT"
                  className="border-white/30 bg-white/15 text-white placeholder:text-white/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Loại ngày
                </label>
                <Select value={calcType} onValueChange={setCalcType}>
                  <SelectTrigger className="border-white/30 bg-white/15 text-white">
                    <SelectValue placeholder="Chọn loại ngày" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">Ngày thường (x1.0)</SelectItem>
                    <SelectItem value="weekend">Cuối tuần (x1.5)</SelectItem>
                    <SelectItem value="holiday">Ngày lễ (x2.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="py-2">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Comp-off nhận được:
                </p>
                <p className="text-2xl font-bold">
                  {calcHours ? (parseFloat(calcHours) * RATE[calcType]).toFixed(1) : '0.0'}h
                </p>
                {calcResult !== null && (
                  <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Kết quả đã lưu: {calcResult.toFixed(1)}h
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCalcResult(calcHours ? parseFloat(calcHours) * RATE[calcType] : 0)
                }
                className="w-full rounded-lg py-2 text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                Tính toán
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
            <div className="mb-4 flex items-center gap-2">
              <History size={16} style={{ color: '#1DB87A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
                Lịch sử gần đây
              </h3>
            </div>
            <div className="relative pl-5">
              <div
                className="absolute bottom-0 left-2 top-0 w-0.5"
                style={{ background: '#e2ede9' }}
              />
              {timeline.length > 0 ? (
                timeline.map((event) => (
                  <div key={event.id} className="relative mb-4 last:mb-0">
                    <div
                      className="absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 border-white"
                      style={{
                        background:
                          event.type === 'earn'
                            ? '#1DB87A'
                            : event.type === 'pending'
                              ? '#f59e0b'
                              : '#ef4444',
                      }}
                    />
                    <p className="text-xs font-semibold" style={{ color: '#203430' }}>
                      {event.date}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{
                        color:
                          event.type === 'expire' || event.type === 'reject'
                            ? '#ef4444'
                            : '#6b7f78',
                      }}
                    >
                      {event.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs" style={{ color: '#6b7f78' }}>
                  Chưa có dữ liệu timeline từ backend.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 size={16} style={{ color: '#1DB87A' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
                Thống kê nhanh
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'OT nguồn',
                  val: formatHours(quickStats.sourceOtHours),
                  color: '#1DB87A',
                },
                {
                  label: 'Đã duyệt',
                  val: String(quickStats.approvedCount),
                  color: '#3b82f6',
                },
                {
                  label: 'Chờ duyệt',
                  val: String(quickStats.pendingCount),
                  color: '#f59e0b',
                },
                {
                  label: 'Đã hết hạn',
                  val: formatHours(quickStats.expiredHours),
                  color: '#ef4444',
                },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-xl font-bold" style={{ color: stat.color }}>
                    {isLoading ? '...' : stat.val}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: '#6b7f78' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
