'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  Building2,
  Eye,
  FileDown,
  FilePieChart,
  FileText,
  Minus,
  Search,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Tooltip as PieTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient, getApiBaseUrl, getStoredToken } from '@/lib/api-client';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type LeaveTrendRow = {
  month: string;
  annual: number;
  sick: number;
  wfh: number;
};

type OvertimeReportRow = {
  month: string;
  totalHours: number;
  count: number;
};

type DepartmentReportRow = {
  department: string | null;
  totalDays: number;
  employeeCount: number;
  otHours: number;
};

type TopUserRow = {
  rank: number;
  name: string;
  department: string | null;
  days: number;
  total: number;
  pct: number;
};

const DEPARTMENT_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#1DB87A',
  '#06b6d4',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
];

const DEPARTMENT_BACKGROUNDS = [
  '#eff6ff',
  '#fffbeb',
  '#f0fdf9',
  '#ecfeff',
  '#f5f3ff',
  '#fef2f2',
  '#f0fdfa',
];

function formatHours(value?: number | string | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(1)}h`;
}

function monthLabel(monthValue: string) {
  return `T${monthValue}`;
}

function getDepartmentColor(index: number) {
  return DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length];
}

function getDepartmentBg(index: number) {
  return DEPARTMENT_BACKGROUNDS[index % DEPARTMENT_BACKGROUNDS.length];
}

function trendMeta(current: number, previous: number) {
  if (current > previous) {
    const delta = previous ? Math.round(((current - previous) / previous) * 100) : 100;
    return { trend: 'up' as const, sub: `+${delta}% so với tháng trước` };
  }

  if (current < previous) {
    const delta = current ? Math.round(((previous - current) / previous) * 100) : 100;
    return { trend: 'down' as const, sub: `-${delta}% so với tháng trước` };
  }

  return { trend: 'neutral' as const, sub: 'Không đổi so với tháng trước' };
}

function trendColor(trend: 'up' | 'down' | 'neutral', dark = true) {
  if (!dark) {
    if (trend === 'up') return '#059669';
    if (trend === 'down') return '#dc2626';
    return '#6b7280';
  }
  return 'rgba(255,255,255,0.9)';
}

function rateColor(rate: number) {
  if (rate >= 75) return '#1DB87A';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function ReportsPage() {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  const [reportType, setReportType] = useState('leave-summary');
  const [fromDate, setFromDate] = useState(`${currentYear}-01-01`);
  const [toDate, setToDate] = useState(`${currentYear}-12-31`);
  const [deptFilter, setDeptFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [leaveTrend, setLeaveTrend] = useState<LeaveTrendRow[]>([]);
  const [overtimeTrend, setOvertimeTrend] = useState<OvertimeReportRow[]>([]);
  const [departmentRows, setDepartmentRows] = useState<DepartmentReportRow[]>([]);
  const [topUsers, setTopUsers] = useState<TopUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const selectedYear = useMemo(() => {
    const endDate = new Date(`${toDate}T00:00:00`);
    if (!Number.isNaN(endDate.getTime())) return endDate.getFullYear();

    const startDate = new Date(`${fromDate}T00:00:00`);
    if (!Number.isNaN(startDate.getTime())) return startDate.getFullYear();

    return currentYear;
  }, [currentYear, fromDate, toDate]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [leaveResponse, overtimeResponse, departmentResponse, topUsersResponse] =
        await Promise.all([
          apiClient.get<LeaveTrendRow[]>('/api/reports/leave', {
            params: { year: selectedYear, department: deptFilter || undefined },
          }),
          apiClient.get<OvertimeReportRow[]>('/api/reports/overtime', {
            params: { year: selectedYear },
          }),
          apiClient.get<DepartmentReportRow[]>('/api/reports/department', {
            params: { year: selectedYear },
          }),
          apiClient.get<TopUserRow[]>('/api/reports/top-users', {
            params: { year: selectedYear, limit: 10 },
          }),
        ]);

      setLeaveTrend(leaveResponse.data ?? []);
      setOvertimeTrend(overtimeResponse.data ?? []);
      setDepartmentRows(departmentResponse.data ?? []);
      setTopUsers(topUsersResponse.data ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai du lieu bao cao.');
    } finally {
      setIsLoading(false);
    }
  }, [deptFilter, selectedYear]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const chartData = useMemo(
    () =>
      leaveTrend.map((row) => ({
        ...row,
        monthLabel: monthLabel(row.month),
      })),
    [leaveTrend],
  );

  const filteredDepartments = useMemo(() => {
    const rows = departmentRows.filter((row) =>
      deptFilter ? (row.department ?? '') === deptFilter : true,
    );

    return rows.map((row, index) => {
      const color = getDepartmentColor(index);
      const bg = getDepartmentBg(index);
      const avgDays = row.employeeCount
        ? Number((row.totalDays / row.employeeCount).toFixed(1))
        : 0;

      return {
        ...row,
        label: row.department ?? 'Khác',
        color,
        bg,
        avgDays,
      };
    });
  }, [departmentRows, deptFilter]);

  const pieData = useMemo(
    () =>
      filteredDepartments.map((row) => ({
        name: row.label,
        value: row.totalDays,
        color: row.color,
      })),
    [filteredDepartments],
  );

  const filteredTopUsers = useMemo(
    () => topUsers.filter((user) => (deptFilter ? (user.department ?? '') === deptFilter : true)),
    [deptFilter, topUsers],
  );

  const leaveTotals = useMemo(() => {
    const annual = leaveTrend.reduce((sum, row) => sum + Number(row.annual ?? 0), 0);
    const sick = leaveTrend.reduce((sum, row) => sum + Number(row.sick ?? 0), 0);
    const wfh = leaveTrend.reduce((sum, row) => sum + Number(row.wfh ?? 0), 0);
    const total = annual + sick + wfh;

    return {
      annual,
      sick,
      wfh,
      total,
      types: [
        { code: 'AL', label: 'Nghỉ phép năm', days: annual, color: '#3b82f6' },
        { code: 'SL', label: 'Nghỉ ốm', days: sick, color: '#10b981' },
        { code: 'WFH', label: 'Làm việc tại nhà', days: wfh, color: '#8b5cf6' },
      ].map((item) => ({
        ...item,
        pct: total ? Math.round((item.days / total) * 100) : 0,
      })),
    };
  }, [leaveTrend]);

  const overtimeTotals = useMemo(() => {
    const totalHours = overtimeTrend.reduce((sum, row) => sum + Number(row.totalHours ?? 0), 0);
    const totalCount = overtimeTrend.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    return { totalHours, totalCount };
  }, [overtimeTrend]);

  const kpiCards = useMemo(() => {
    const latestLeave = chartData.at(-1);
    const previousLeave = chartData.at(-2);
    const latestOt = overtimeTrend.at(-1);
    const previousOt = overtimeTrend.at(-2);

    const leaveMeta = trendMeta(
      (latestLeave?.annual ?? 0) + (latestLeave?.sick ?? 0) + (latestLeave?.wfh ?? 0),
      (previousLeave?.annual ?? 0) + (previousLeave?.sick ?? 0) + (previousLeave?.wfh ?? 0),
    );
    const annualMeta = trendMeta(latestLeave?.annual ?? 0, previousLeave?.annual ?? 0);
    const overtimeMeta = trendMeta(latestOt?.totalHours ?? 0, previousOt?.totalHours ?? 0);
    const departmentMeta = trendMeta(filteredDepartments.length, departmentRows.length);

    return [
      {
        label: 'Tổng yêu cầu nghỉ',
        value: String(leaveTotals.total),
        ...leaveMeta,
        gradFrom: '#0E474E',
        gradTo: '#1DB87A',
        dark: true,
      },
      {
        label: 'Nghỉ phép năm',
        value: String(leaveTotals.annual),
        ...annualMeta,
        gradFrom: '#059669',
        gradTo: '#34d399',
        dark: true,
      },
      {
        label: 'Tổng overtime',
        value: formatHours(overtimeTotals.totalHours),
        ...overtimeMeta,
        gradFrom: '#d97706',
        gradTo: '#fbbf24',
        dark: false,
      },
      {
        label: 'Phòng ban có dữ liệu',
        value: String(filteredDepartments.length),
        ...departmentMeta,
        gradFrom: '#0891b2',
        gradTo: '#a5f3fc',
        dark: false,
      },
    ];
  }, [
    chartData,
    departmentRows.length,
    filteredDepartments.length,
    leaveTotals.annual,
    leaveTotals.total,
    overtimeTotals.totalHours,
    overtimeTrend,
  ]);

  const monthlyTable = useMemo(() => {
    return leaveTrend.map((row) => {
      const overtimeRow = overtimeTrend.find((item) => item.month === row.month);
      const totalRequests = Number(row.annual ?? 0) + Number(row.sick ?? 0) + Number(row.wfh ?? 0);
      const dominantType = [
        { label: 'Phép năm', value: row.annual },
        { label: 'Nghỉ ốm', value: row.sick },
        { label: 'WFH', value: row.wfh },
      ].sort((a, b) => Number(b.value) - Number(a.value))[0];
      const annualRate = totalRequests
        ? Math.round((Number(row.annual ?? 0) / totalRequests) * 100)
        : 0;

      return {
        month: `${row.month.padStart(2, '0')}/${selectedYear}`,
        annual: Number(row.annual ?? 0),
        sick: Number(row.sick ?? 0),
        wfh: Number(row.wfh ?? 0),
        totalRequests,
        otHours: Number(overtimeRow?.totalHours ?? 0),
        otCount: Number(overtimeRow?.count ?? 0),
        dominantType: dominantType.label,
        annualRate,
      };
    });
  }, [leaveTrend, overtimeTrend, selectedYear]);

  const exportCsv = async () => {
    setIsExporting(true);
    setErrorMessage(null);

    try {
      const token = getStoredToken();
      const response = await fetch(`${getApiBaseUrl()}/api/reports/export?year=${selectedYear}`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Khong the export file CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leave-report-${selectedYear}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      setNoticeMessage(`Đã tải báo cáo CSV cho năm ${selectedYear}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: '#D3F2E7' }}
          >
            <BarChart2 size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Báo cáo &amp; Thống kê
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadReports()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: '#1DB87A' }}
          >
            <FileText size={14} /> Tạo báo cáo
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <FileDown size={14} /> {isExporting ? 'Đang export CSV' : 'Export CSV'}
          </button>
          <button
            type="button"
            disabled
            title="Backend hiện chưa có endpoint export PDF/Excel."
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold opacity-60"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            <FilePieChart size={14} /> Export PDF
          </button>
        </div>
      </div>

      {(errorMessage || noticeMessage) && (
        <div
          className="rounded-xl border p-3 text-sm"
          style={{
            background: errorMessage ? '#fff5f5' : '#f7fffb',
            color: errorMessage ? '#b91c1c' : '#0E474E',
            borderColor: errorMessage ? '#fecaca' : '#D3F2E7',
          }}
        >
          {errorMessage ?? noticeMessage}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
        <div className="mb-3 flex items-center gap-2">
          <BarChart2 size={14} style={{ color: '#1DB87A' }} />
          <span className="text-sm font-semibold" style={{ color: '#203430' }}>
            Bộ lọc báo cáo
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Loại báo cáo
            </label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="min-w-[200px]">
                <SelectValue placeholder="Chọn loại báo cáo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leave-summary">Tổng quan nghỉ phép</SelectItem>
                <SelectItem value="leave-detail">Chi tiết nghỉ phép</SelectItem>
                <SelectItem value="overtime-summary">Tổng quan overtime</SelectItem>
                <SelectItem value="department-analysis">Phân tích theo phòng ban</SelectItem>
                <SelectItem value="employee-performance">Hiệu suất nhân viên</SelectItem>
                <SelectItem value="leave-trend">Xu hướng nghỉ phép</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Từ ngày
            </label>
            <DatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Đến ngày
            </label>
            <DatePicker value={toDate} onChange={setToDate} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Phòng ban
            </label>
            <Select
              value={deptFilter || 'all'}
              onValueChange={(value) => setDeptFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="Chọn phòng ban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {departmentRows
                  .map((row) => row.department)
                  .filter((department): department is string => Boolean(department))
                  .map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: '#6b7f78' }}>
              Nhóm
            </label>
            <Select
              value={teamFilter || 'all'}
              onValueChange={(value) => setTeamFilter(value === 'all' ? '' : value)}
              disabled
            >
              <SelectTrigger className="min-w-[130px]">
                <SelectValue placeholder="Chọn nhóm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => void loadReports()}
            className="self-end h-[36px] rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#1DB87A' }}
          >
            <Search size={14} />
          </button>
        </div>
        <p className="mt-3 text-xs" style={{ color: '#6b7f78' }}>
          Dữ liệu chart và bảng đang lấy theo năm {selectedYear}. Bộ lọc nhóm hiện chưa có endpoint
          backend nên chỉ giữ ở trạng thái an toàn.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 text-white"
            style={{
              background: `linear-gradient(135deg, ${card.gradFrom} 0%, ${card.gradTo} 100%)`,
            }}
          >
            <p
              className="mb-2 text-3xl font-bold"
              style={{ color: card.dark === false ? '#1f2937' : 'white' }}
            >
              {isLoading ? '...' : card.value}
            </p>
            <div className="flex items-center gap-1.5">
              {card.trend === 'up' && <TrendingUp size={14} className="text-green-200" />}
              {card.trend === 'down' && <TrendingDown size={14} className="text-red-300" />}
              {card.trend === 'neutral' && <Minus size={14} className="opacity-70" />}
              <span
                className="text-xs opacity-80"
                style={{
                  color: card.dark === false ? '#374151' : 'rgba(255,255,255,0.85)',
                }}
              >
                {card.label}
              </span>
              <span
                className="ml-1 text-xs font-semibold"
                style={{ color: trendColor(card.trend, card.dark !== false) }}
              >
                {card.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div
          className="rounded-xl border bg-white p-5 lg:col-span-2"
          style={{ borderColor: '#e2ede9' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={15} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Xu hướng nghỉ phép 12 tháng
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f2" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7f78' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7f78' }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2ede9', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="annual"
                name="Nghỉ phép năm"
                stroke="#1DB87A"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sick"
                name="Nghỉ ốm"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="wfh"
                name="WFH"
                stroke="#9ca3af"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="mb-4 flex items-center gap-2">
            <FilePieChart size={15} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Phân bố theo phòng ban
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                dataKey="value"
                paddingAngle={3}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <PieTooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2ede9', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {pieData.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: '#6b7f78' }}
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: item.color }}
                />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
        <div className="mb-4 flex items-center gap-2">
          <Building2 size={15} style={{ color: '#1DB87A' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
            Phân tích chi tiết theo phòng ban
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDepartments.length > 0 ? (
            filteredDepartments.map((department) => {
              const usage = Math.min(
                100,
                department.employeeCount
                  ? Math.round((department.avgDays / Math.max(department.avgDays, 1)) * 100)
                  : 0,
              );

              return (
                <div
                  key={department.label}
                  className="rounded-xl border p-4 transition-all hover:shadow-sm"
                  style={{
                    borderColor: '#e2ede9',
                    borderLeft: `4px solid ${department.color}`,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{ background: department.color }}
                      >
                        {department.label.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: '#203430' }}>
                        {department.label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: '#6b7f78' }}>
                      {department.employeeCount} nhân viên
                    </span>
                  </div>
                  <div className="mb-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      {
                        val: department.totalDays.toFixed(1),
                        label: 'Ngày nghỉ',
                        color: department.color,
                      },
                      {
                        val: formatHours(department.otHours),
                        label: 'Overtime',
                        color: '#1DB87A',
                      },
                      {
                        val: String(department.employeeCount),
                        label: 'Nhân sự',
                        color: '#f59e0b',
                      },
                      {
                        val: department.avgDays.toFixed(1),
                        label: 'Ngày/NV',
                        color: '#06b6d4',
                      },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <p className="text-lg font-bold" style={{ color: metric.color }}>
                          {metric.val}
                        </p>
                        <p className="text-xs" style={{ color: '#6b7f78' }}>
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs" style={{ color: '#6b7f78' }}>
                      <span>Mức tải nghỉ phép / nhân sự</span>
                      <span className="font-semibold">{department.avgDays.toFixed(1)} ngày</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full"
                      style={{ background: '#f0f4f2' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(10, usage)}%`,
                          background: department.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="rounded-xl border p-6 text-center text-sm md:col-span-2"
              style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
            >
              {isLoading ? 'Đang tải dữ liệu phòng ban...' : 'Không có dữ liệu phòng ban.'}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={15} style={{ color: '#f59e0b' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Top 10 nhân viên nghỉ phép nhiều nhất
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f7f7f7' }}>
                {['#', 'Nhân viên', 'Phòng ban', 'Số ngày', '%'].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2.5 text-left text-xs font-semibold"
                    style={{ color: '#6b7f78' }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTopUsers.length > 0 ? (
                filteredTopUsers.map((user, index) => {
                  const color = getDepartmentColor(index);
                  const bg = getDepartmentBg(index);

                  return (
                    <tr
                      key={`${user.rank}-${user.name}`}
                      className="border-b last:border-0"
                      style={{ borderColor: '#f0f4f2' }}
                    >
                      <td
                        className="px-3 py-3 text-xs font-bold"
                        style={{ color: user.rank <= 3 ? '#f59e0b' : '#6b7f78' }}
                      >
                        {user.rank}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium" style={{ color: '#203430' }}>
                        {user.name}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="rounded px-2 py-0.5 text-xs font-bold"
                          style={{ background: bg, color }}
                        >
                          {user.department ?? 'Chưa rõ'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-bold" style={{ color: '#203430' }}>
                        {user.days}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full"
                            style={{ background: '#f0f4f2' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${user.pct}%`, background: '#1DB87A' }}
                            />
                          </div>
                          <span
                            className="min-w-[32px] text-xs font-semibold"
                            style={{ color: '#203430' }}
                          >
                            {user.pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    {isLoading ? 'Đang tải top users...' : 'Không có dữ liệu top users.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-white p-5" style={{ borderColor: '#e2ede9' }}>
          <div className="mb-4 flex items-center gap-2">
            <BarChart2 size={15} style={{ color: '#1DB87A' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
              Phân tích theo loại nghỉ phép
            </h3>
          </div>
          <div className="space-y-3">
            {leaveTotals.types.map((type) => (
              <div key={type.code} className="flex items-center gap-3">
                <span
                  className="w-12 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold text-white"
                  style={{ background: type.color }}
                >
                  {type.code}
                </span>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-xs">
                    <span style={{ color: '#203430' }}>{type.label}</span>
                    <span className="font-semibold" style={{ color: '#203430' }}>
                      {type.days} lượt ({type.pct}%)
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ background: '#f0f4f2' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(type.pct, 4)}%`, background: type.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs" style={{ color: '#6b7f78' }}>
            Báo cáo hiện lấy trực tiếp từ endpoint `leave`, nên các loại nghỉ chưa có trong API tổng
            hợp sẽ chưa hiển thị ở khối này.
          </p>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: '#e2ede9' }}
      >
        <div
          className="flex items-center gap-2 border-b px-5 py-3"
          style={{ borderColor: '#e2ede9' }}
        >
          <BarChart2 size={15} style={{ color: '#1DB87A' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#203430' }}>
            Báo cáo chi tiết theo tháng
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#203430' }}>
                {[
                  'Tháng',
                  'Phép năm',
                  'Nghỉ ốm',
                  'WFH',
                  'Tổng lượt',
                  'Overtime (h)',
                  'Phiếu OT',
                  'Loại chính',
                  'Thao tác',
                ].map((header) => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-white"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyTable.length > 0 ? (
                monthlyTable.map((row) => (
                  <tr
                    key={row.month}
                    className="border-b transition-colors last:border-0 hover:bg-gray-50"
                    style={{ borderColor: '#f0f4f2' }}
                  >
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: '#203430' }}>
                      {row.month}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                      {row.annual}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                      {row.sick}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                      {row.wfh}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: '#1DB87A' }}>
                      {row.totalRequests}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                      {row.otHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#203430' }}>
                      {row.otCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-2 py-1 text-xs font-bold text-white"
                        style={{ background: rateColor(row.annualRate) }}
                      >
                        {row.dominantType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled
                        title="Backend hiện chưa có endpoint chi tiết theo tháng."
                        className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg border opacity-60"
                        style={{ borderColor: '#e2ede9' }}
                      >
                        <Eye size={13} style={{ color: '#3b82f6' }} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: '#6b7f78' }}
                  >
                    {isLoading ? 'Đang tải bảng tổng hợp...' : 'Chưa có dữ liệu theo tháng.'}
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
