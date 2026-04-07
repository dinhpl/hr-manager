'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { apiClient, getStoredUser } from '@/lib/api-client';
import {
  AlertCircle,
  BarChart2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────
type RecruitmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'INTERVIEWING'
  | 'OFFER_SENT'
  | 'HIRED'
  | 'ON_HOLD'
  | 'CANCELLED';

type CandidateStage =
  | 'APPLIED'
  | 'HR_SCREEN'
  | 'LEADER_INTERVIEW'
  | 'CEO_INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED';

type Priority = 'A' | 'B' | 'C';

interface Candidate {
  id: string;
  positionId: string;
  fullName: string;
  email: string;
  phone: string;
  source: CandidateSource;
  currentStage: CandidateStage;
  note: string;
  appliedAt: string;
}

interface WeeklyData {
  stage: CandidateStage;
  kpi: [number, number, number, number];
  actual: [number, number, number, number];
}

interface Position {
  id: string;
  title: string;
  level: string;
  domain: string;
  priority: Priority;
  headcount: number;
  status: RecruitmentStatus;
  note: string;
  blocker: string;
  openedAt: string;
  candidates: Candidate[];
  weekly: WeeklyData[];
}

// ─── Constants ─────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_CONFIG: Record<RecruitmentStatus, { label: string; bg: string; text: string }> = {
  NOT_STARTED: { label: 'Not started', bg: '#F3F4F6', text: '#6B7280' },
  IN_PROGRESS: { label: 'In progress', bg: '#FEF3C7', text: '#92400E' },
  INTERVIEWING: { label: 'Interviewing', bg: '#DBEAFE', text: '#1D4ED8' },
  OFFER_SENT: { label: 'Offer sent', bg: '#D1FAE5', text: '#065F46' },
  HIRED: { label: 'Hired / Onboarded', bg: '#BBF7D0', text: '#065F46' },
  ON_HOLD: { label: 'On hold', bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED: { label: 'Cancelled', bg: '#E5E7EB', text: '#6B7280' },
};

const STAGE_CONFIG: Record<
  CandidateStage,
  { label: string; short: string; bg: string; text: string; color: string }
> = {
  APPLIED: { label: 'Applied', short: 'Applied', bg: '#EFF6FF', text: '#1D4ED8', color: '#3b82f6' },
  HR_SCREEN: { label: 'HR Screen', short: 'HR', bg: '#FEF3C7', text: '#92400E', color: '#f59e0b' },
  LEADER_INTERVIEW: {
    label: 'Leader Interview',
    short: 'Leader',
    bg: '#F0FDF4',
    text: '#166534',
    color: '#22c55e',
  },
  CEO_INTERVIEW: {
    label: 'CEO Interview',
    short: 'CEO',
    bg: '#F5F3FF',
    text: '#5B21B6',
    color: '#8b5cf6',
  },
  OFFER: { label: 'Offer', short: 'Offer', bg: '#ECFDF5', text: '#065F46', color: '#10b981' },
  HIRED: { label: 'Hired', short: 'Hired', bg: '#BBF7D0', text: '#065F46', color: '#16a34a' },
  REJECTED: {
    label: 'Rejected',
    short: 'Rejected',
    bg: '#F9FAFB',
    text: '#6B7280',
    color: '#9ca3af',
  },
};

const DOMAINS = ['NC', 'Web/App', 'AI/ML', 'AI/Product', 'Mobile', 'DevOps', 'QA', 'Design'];
const SOURCES: CandidateSource[] = [
  'LINKEDIN',
  'REFERRAL',
  'HEADHUNT',
  'WEBSITE',
  'AGENCY',
  'OTHER',
];
type CandidateSource = 'LINKEDIN' | 'REFERRAL' | 'HEADHUNT' | 'WEBSITE' | 'AGENCY' | 'OTHER';

const SOURCE_LABELS: Record<CandidateSource, string> = {
  LINKEDIN: 'LinkedIn',
  REFERRAL: 'Referral',
  HEADHUNT: 'HeadHunt',
  WEBSITE: 'Website',
  AGENCY: 'Agency',
  OTHER: 'Other',
};
const FUNNEL_STAGES: CandidateStage[] = [
  'APPLIED',
  'HR_SCREEN',
  'LEADER_INTERVIEW',
  'CEO_INTERVIEW',
];

// ─── API types ───────────────────────────────────────────────
interface ApiCandidate {
  id: string;
  positionId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource;
  currentStage: CandidateStage;
  note: string | null;
  appliedAt: string;
}

interface ApiWeeklyKpi {
  id: string;
  positionId: string;
  year: number;
  month: number;
  week: number;
  stage: CandidateStage;
  kpiTarget: number;
  actual: number;
}

interface ApiPosition {
  id: string;
  title: string;
  level: string;
  domain: string;
  priority: Priority;
  headcount: number;
  status: RecruitmentStatus;
  note: string | null;
  blocker: string | null;
  openedAt: string;
  candidates: ApiCandidate[];
  weeklyStats: ApiWeeklyKpi[];
}

function transformPosition(api: ApiPosition): Position {
  // Build WeeklyData[] from flat weeklyStats
  const weekly: WeeklyData[] = FUNNEL_STAGES.map((stage) => {
    const rows = api.weeklyStats.filter((w) => w.stage === stage);
    const kpi: [number, number, number, number] = [0, 0, 0, 0];
    const actual: [number, number, number, number] = [0, 0, 0, 0];
    rows.forEach((r) => {
      const idx = r.week - 1;
      if (idx >= 0 && idx < 4) {
        kpi[idx] = r.kpiTarget;
        actual[idx] = r.actual;
      }
    });
    return { stage, kpi, actual };
  });

  const candidates: Candidate[] = api.candidates.map((c) => ({
    id: c.id,
    positionId: c.positionId,
    fullName: c.fullName,
    email: c.email ?? '',
    phone: c.phone ?? '',
    source: c.source as CandidateSource,
    currentStage: c.currentStage,
    note: c.note ?? '',
    appliedAt: c.appliedAt ? c.appliedAt.slice(0, 10) : '',
  }));

  return {
    id: api.id,
    title: api.title,
    level: api.level,
    domain: api.domain,
    priority: api.priority,
    headcount: api.headcount,
    status: api.status,
    note: api.note ?? '',
    blocker: api.blocker ?? '',
    openedAt: api.openedAt ? api.openedAt.slice(0, 10) : '',
    candidates,
    weekly,
  };
}

// ─── Helpers ────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function sumArr(arr: number[]) {
  return arr.reduce((s, v) => s + v, 0);
}

// ─── Sub-components ─────────────────────────────────────────

function StatusBadge({ status }: { status: RecruitmentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: CandidateStage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cls =
    priority === 'A'
      ? 'bg-amber-100 text-amber-800'
      : priority === 'B'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${cls}`}>
      {priority}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  alertClass,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  alertClass?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-[#e8ecf0] p-3 ${alertClass ?? ''}`}>
      <p className="text-[9.5px] font-medium uppercase tracking-wide text-[#9aa5b4]">{label}</p>
      <p className="text-[21px] font-bold text-[#1a2332] leading-tight mt-0.5">{value}</p>
      <p className="text-[10px] text-[#9aa5b4] mt-1">{sub}</p>
    </div>
  );
}

// ─── Candidate chip ─────────────────────────────────────────
function CandidateChip({
  candidate,
  onRemove,
  onClick,
}: {
  candidate: Candidate;
  onRemove?: () => void;
  onClick?: () => void;
}) {
  const cfg = STAGE_CONFIG[candidate.currentStage];
  return (
    <div
      className="inline-flex items-center gap-1.5 bg-white border border-[#e2ede9] rounded-lg px-2 py-1 m-0.5 text-xs cursor-pointer hover:border-[#1DB87A] hover:bg-[#ecfdf5] transition-colors group"
      onClick={onClick}
    >
      <div className="w-5 h-5 rounded-full bg-[#1DB87A] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
        {getInitials(candidate.fullName)}
      </div>
      <span className="font-medium text-[#1a2332] text-[11px]">{candidate.fullName}</span>
      <span
        className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        {cfg.short}
      </span>
      {candidate.note && (
        <span className="text-[#9aa5b4] text-[10px] max-w-[120px] truncate">{candidate.note}</span>
      )}
      {onRemove && (
        <button
          className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Funnel card ────────────────────────────────────────────
function FunnelCard({ positions }: { positions: Position[] }) {
  const totals = FUNNEL_STAGES.map((_, si) =>
    positions.reduce((sum, p) => {
      if (si === 0) {
        return sum + p.candidates.length;
      }
      return (
        sum +
        p.candidates.filter((c) => {
          const idx = FUNNEL_STAGES.indexOf(c.currentStage as CandidateStage);
          return idx >= si;
        }).length
      );
    }, 0),
  );
  const kpis = FUNNEL_STAGES.map((stage) =>
    positions.reduce((sum, p) => {
      const stageData = p.weekly.find((w) => w.stage === stage);
      return sum + (stageData ? sumArr(stageData.kpi) : 0);
    }, 0),
  );
  const maxVal = Math.max(...kpis, 1);
  const COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6'];

  return (
    <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f0f2f5] flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-[#1a2332] flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#9aa5b4]" />
          Funnel
        </span>
        <span className="text-[10px] text-[#9aa5b4]">KPI vs Actual</span>
      </div>
      <div className="py-1">
        {FUNNEL_STAGES.map((stage, i) => {
          const cfg = STAGE_CONFIG[stage];
          const kpPct = Math.min(Math.round((kpis[i] / maxVal) * 100), 100);
          const actPct = Math.min(Math.round((totals[i] / maxVal) * 100), 100);
          const rate =
            i > 0 && totals[i - 1] > 0 ? Math.round((totals[i] / totals[i - 1]) * 100) : null;
          return (
            <div
              key={stage}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f8f9fb] last:border-b-0"
            >
              <div className="min-w-[110px] text-[11px] font-medium" style={{ color: COLORS[i] }}>
                {cfg.short === 'Applied' ? 'Applied' : cfg.label}
              </div>
              <div className="flex-1 relative h-2 bg-[#f0f2f5] rounded">
                <div
                  className="absolute left-0 top-0 h-full rounded bg-[#e2e6ea]"
                  style={{ width: `${kpPct}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded transition-all"
                  style={{ width: `${actPct}%`, background: COLORS[i] }}
                />
              </div>
              <span className="min-w-[28px] text-right text-[11px] font-semibold text-[#1a2332]">
                {totals[i]}
              </span>
              <span className="min-w-[36px] text-right text-[10px] text-[#9aa5b4]">
                {rate !== null ? `${rate}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 bg-[#fafbfc] border-t border-[#f0f2f5] flex gap-2 flex-wrap">
        {FUNNEL_STAGES.map((s, i) => (
          <span key={s} className="flex items-center gap-1 text-[10.5px] text-[#5a6a7e]">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: COLORS[i] }} />
            {STAGE_CONFIG[s].short === 'Applied' ? 'Applied' : STAGE_CONFIG[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Trend chart ─────────────────────────────────────────────
function TrendCard({ positions }: { positions: Position[] }) {
  const detectedWeeks = positions.reduce((max, p) => {
    const stageData = p.weekly[0];
    const stageLen = Math.max(stageData?.actual.length ?? 0, stageData?.kpi.length ?? 0);
    return Math.max(max, stageLen);
  }, 0);
  const WEEKS = Math.min(8, Math.max(4, detectedWeeks));
  const weekLabels = Array.from({ length: WEEKS }, (_, i) => `W${i + 1}`);

  // Compute applied actuals from candidate applied dates (source of truth for real pipeline volume)
  const appliedActual: number[] = positions.reduce(
    (acc, p) => {
      p.candidates.forEach((c) => {
        const d = new Date(c.appliedAt);
        if (Number.isNaN(d.getTime())) return;
        const weekIdx = Math.min(WEEKS - 1, Math.floor((d.getDate() - 1) / 7));
        acc[weekIdx] += 1;
      });
      return acc;
    },
    Array.from({ length: WEEKS }, () => 0),
  );

  // KPI = sum of all weekly KPI targets for APPLIED stage
  const appliedKpi: number[] = Array.from({ length: WEEKS }, (_, wi) =>
    positions.reduce((sum, p) => {
      const stageData = p.weekly[0];
      return sum + (stageData?.kpi[wi] ?? 0);
    }, 0),
  );

  const allValues = [...appliedActual, ...appliedKpi];
  const maxVal = Math.max(...allValues, 1);

  const totalActual = appliedActual.reduce((s, v) => s + v, 0);
  const totalKpi = appliedKpi.reduce((s, v) => s + v, 0);
  const attainmentPct = totalKpi > 0 ? Math.round((totalActual / totalKpi) * 100) : null;
  const avgActual =
    appliedActual.filter((v) => v > 0).length > 0
      ? Math.round(totalActual / appliedActual.filter((v) => v > 0).length)
      : 0;
  const peakWeekIdx = appliedActual.indexOf(Math.max(...appliedActual));
  const lastActual = appliedActual[WEEKS - 1] ?? 0;
  const prevActual = appliedActual[WEEKS - 2] ?? 0;
  const wowChange = prevActual > 0 ? lastActual - prevActual : 0;
  const chartData = weekLabels.map((week, i) => ({
    week,
    actual: appliedActual[i] ?? 0,
    kpi: appliedKpi[i] ?? 0,
  }));
  const chartConfig = {
    actual: { label: 'Actual', color: '#1DB87A' },
    kpi: { label: 'KPI', color: '#9AA5B4' },
  } satisfies ChartConfig;

  return (
    <div className="bg-white rounded-2xl border border-[#e8ecf0] overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#f0f2f5] flex items-start justify-between gap-3 bg-[linear-gradient(180deg,#fff_0%,#fcfdff_100%)]">
        <div className="min-w-0">
          <span className="text-[13px] font-semibold text-[#111827]">
            Trend — Weekly Applications
          </span>
          <p className="text-[10.5px] text-[#7b8797] mt-0.5">
            Theo dõi số lượng ứng viên ứng tuyển theo từng tuần
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="flex items-center gap-1.5 text-[#5a6a7e]">
              <span className="w-6 h-[2px] rounded-full bg-[#1DB87A] inline-block" />
              Actual
            </span>
            <span className="flex items-center gap-1.5 text-[#5a6a7e]">
              <span
                className="w-6 h-[2px] rounded-full bg-dashed border-t border-t-[#9aa5b4] inline-block"
                style={{ borderStyle: 'dashed' }}
              />
              KPI
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              attainmentPct === null
                ? 'bg-[#f3f4f6] text-[#6b7280]'
                : attainmentPct >= 100
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {attainmentPct === null ? 'No KPI' : `${attainmentPct}% KPI attained`}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#f0f2f5] border-b border-[#f0f2f5]">
        {[
          { label: 'Tổng ứng viên', value: totalActual, sub: `/${totalKpi} KPI` },
          { label: 'Trung bình/tuần', value: avgActual, sub: 'ứng viên' },
          {
            label: 'Tuần cao nhất',
            value: appliedActual[peakWeekIdx],
            sub: weekLabels[peakWeekIdx],
          },
          {
            label: 'Tuần này',
            value: lastActual,
            sub: wowChange !== 0 ? `${wowChange > 0 ? '+' : ''}${wowChange} vs tuần trước` : '—',
            highlight:
              wowChange !== 0
                ? wowChange > 0
                  ? 'text-green-600'
                  : 'text-red-500'
                : 'text-[#111827]',
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-3 text-center ${i > 1 ? 'border-t border-[#f0f2f5] lg:border-t-0' : ''}`}
          >
            <p className="text-[9.5px] text-[#96a2b1] mb-0.5">{s.label}</p>
            <p className={`text-[19px] font-bold leading-tight ${s.highlight ?? 'text-[#111827]'}`}>
              {s.value}
            </p>
            <p className={`text-[10px] mt-0.5 ${s.highlight ?? 'text-[#7b8797]'}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Compact area chart */}
      <div className="pl-8 pr-3 pb-2.5 pt-2">
        <ChartContainer config={chartConfig} className="h-[170px] w-full aspect-auto">
          <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="recruitment-actual-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#EEF2F6" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: '#96A2B1', fontSize: 10 }}
            />
            <YAxis
              width={32}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#96A2B1', fontSize: 10 }}
              domain={[0, Math.max(1, maxVal)]}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} cursor={false} />
            <Area
              type="monotone"
              dataKey="kpi"
              stroke="var(--color-kpi)"
              strokeWidth={1.4}
              strokeDasharray="4 3"
              fill="transparent"
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="var(--color-actual)"
              strokeWidth={2}
              fill="url(#recruitment-actual-fill)"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Compact week summary */}
      <div className="px-4 pb-3 pt-1 flex justify-between border-t border-[#f7f8fa]">
        {weekLabels.map((w, i) => {
          const delta = i > 0 ? appliedActual[i] - (appliedActual[i - 1] ?? 0) : 0;
          return (
            <span
              key={w}
              className={`text-[9px] ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-[#9aa5b4]'}`}
            >
              {w}: {appliedActual[i]}
              {i > 0 && delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Highlights & Blockers ───────────────────────────────────
function HBCard({
  positions,
  canEdit = false,
  onAddHighlight,
  onAddBlocker,
}: {
  positions: Position[];
  canEdit?: boolean;
  onAddHighlight?: () => void;
  onAddBlocker?: () => void;
}) {
  const highlights = positions.filter((p) => p.note).map((p) => ({ title: p.title, text: p.note }));
  const blockers = positions
    .filter((p) => p.blocker)
    .map((p) => ({ title: p.title, text: p.blocker }));

  return (
    <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="p-4 border-r border-[#f0f2f5]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold text-[#1a2332] flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-[9px]">
                ✓
              </span>
              Highlights ({highlights.length})
            </h3>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={onAddHighlight}
              >
                <Plus className="w-3 h-3 mr-1" />
                Thêm
              </Button>
            )}
          </div>
          {highlights.length === 0 ? (
            <p className="text-[11px] text-[#bbb] italic">Chưa có điểm nổi bật</p>
          ) : (
            <div className="space-y-2">
              {highlights.map((h, i) => (
                <div key={i} className="flex gap-2 pb-2 border-b border-[#f8f9fb] last:border-b-0">
                  <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11.5px] text-[#2d3a4a]">{h.text}</p>
                    <p className="text-[10px] text-[#9aa5b4] mt-0.5">{h.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[12px] font-semibold text-[#1a2332] flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-[9px]">
                !
              </span>
              Blockers ({blockers.length})
            </h3>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={onAddBlocker}
              >
                <Plus className="w-3 h-3 mr-1" />
                Thêm
              </Button>
            )}
          </div>
          {blockers.length === 0 ? (
            <p className="text-[11px] text-[#bbb] italic">Không có blocker</p>
          ) : (
            <div className="space-y-2">
              {blockers.map((b, i) => (
                <div key={i} className="flex gap-2 pb-2 border-b border-[#f8f9fb] last:border-b-0">
                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11.5px] text-[#2d3a4a]">{b.text}</p>
                    <p className="text-[10px] text-[#9aa5b4] mt-0.5">{b.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightDialog({
  open,
  kind,
  positions,
  onClose,
  onSave,
}: {
  open: boolean;
  kind: 'note' | 'blocker';
  positions: Position[];
  onClose: () => void;
  onSave: (data: { positionId: string; text: string }) => void | Promise<void>;
}) {
  const [positionId, setPositionId] = useState<string>('');
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) return;
    setPositionId(positions[0]?.id ?? '');
    setText('');
  }, [open, positions]);

  const isBlocker = kind === 'blocker';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionId) {
      toast.error('Vui lòng chọn vị trí');
      return;
    }
    if (!text.trim()) {
      toast.error(`Vui lòng nhập ${isBlocker ? 'blocker' : 'highlight'}`);
      return;
    }
    onSave({ positionId, text: text.trim() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isBlocker ? 'Thêm Blocker' : 'Thêm Highlight'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Vị trí</label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn vị trí" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
              Nội dung {isBlocker ? 'blocker' : 'highlight'}
            </label>
            <Textarea
              rows={3}
              placeholder={
                isBlocker
                  ? 'VD: Chậm feedback từ hiring manager...'
                  : 'VD: Tăng tốc sourcing, nhiều CV chất lượng...'
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" size="sm">
              Thêm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Weekly KPI Modal ────────────────────────────────────────
function WeeklyKpiModal({ position, onClose }: { position: Position | null; onClose: () => void }) {
  if (!position) return null;

  function numCls(kpi: number, act: number) {
    if (act === 0) return 'text-[#d1d5db]';
    if (kpi > 0 && act >= kpi) return 'text-green-600 font-semibold';
    return 'text-amber-600 font-semibold';
  }

  const toWeekIndex = (appliedAt: string) => {
    const d = new Date(appliedAt);
    if (Number.isNaN(d.getTime())) return null;
    return Math.max(0, Math.min(3, Math.floor((d.getDate() - 1) / 7)));
  };

  const funnelIdxFromStage = (stage: CandidateStage) => {
    const idx = FUNNEL_STAGES.indexOf(stage);
    if (idx >= 0) return idx;
    if (stage === 'OFFER' || stage === 'HIRED') return FUNNEL_STAGES.length - 1;
    if (stage === 'REJECTED') return 0;
    return -1;
  };

  const liveActualByStage = FUNNEL_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = [0, 0, 0, 0];
      return acc;
    },
    {} as Record<CandidateStage, number[]>,
  );

  position.candidates.forEach((c) => {
    const wi = toWeekIndex(c.appliedAt);
    if (wi === null) return;
    const stageIdx = funnelIdxFromStage(c.currentStage);
    if (stageIdx < 0) return;
    FUNNEL_STAGES.forEach((stage, si) => {
      if (si <= stageIdx) {
        liveActualByStage[stage][wi] += 1;
      }
    });
  });

  const mergedActual = FUNNEL_STAGES.reduce(
    (acc, stage) => {
      const weekly = position.weekly.find((w) => w.stage === stage);
      acc[stage] = [0, 1, 2, 3].map((wi) => {
        const base = weekly?.actual[wi] ?? 0;
        const live = liveActualByStage[stage][wi] ?? 0;
        return Math.max(base, live);
      });
      return acc;
    },
    {} as Record<CandidateStage, number[]>,
  );

  const totals = FUNNEL_STAGES.map((stage) => {
    const d = position.weekly.find((w) => w.stage === stage);
    return { kpi: d ? sumArr(d.kpi) : 0, actual: sumArr(mergedActual[stage]) };
  });

  return (
    <Dialog
      open={Boolean(position)}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#1DB87A]" />
            Weekly KPI — {position.title}
          </DialogTitle>
        </DialogHeader>

        {/* Position meta */}
        <div className="flex items-center gap-2 -mt-1 mb-1">
          <span className="text-[10px] bg-[#f0f2f5] text-[#5a6a7e] px-1.5 py-0.5 rounded">
            {position.domain}
          </span>
          <span className="text-[10px] text-[#9aa5b4]">{position.level}</span>
          <PriorityBadge priority={position.priority} />
          <StatusBadge status={position.status} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#fafbfc]">
                <th className="py-2 px-3 text-left text-[9.5px] text-[#9aa5b4] font-medium w-[60px]">
                  Week
                </th>
                {FUNNEL_STAGES.map((stage) => (
                  <th
                    key={stage}
                    colSpan={2}
                    className="py-2 px-3 text-center font-semibold whitespace-nowrap border-l border-[#f0f2f5]"
                    style={{ color: STAGE_CONFIG[stage].text }}
                  >
                    {STAGE_CONFIG[stage].short === 'Applied'
                      ? 'Applied'
                      : STAGE_CONFIG[stage].label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-[#f0f2f5]">
                <th />
                {FUNNEL_STAGES.map((stage) => (
                  <>
                    <th
                      key={`${stage}-kpi`}
                      className="px-3 pb-2 text-center text-[9px] text-[#bbb] font-normal border-l border-[#f0f2f5]"
                    >
                      KPI
                    </th>
                    <th
                      key={`${stage}-act`}
                      className="px-3 pb-2 text-center text-[9px] text-[#bbb] font-normal"
                    >
                      Act
                    </th>
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((wi) => (
                <tr key={wi} className="border-b border-[#f8f9fb] hover:bg-[#fafbfc]">
                  <td className="py-2 px-3 text-[#9aa5b4] font-medium">W{wi + 1}</td>
                  {FUNNEL_STAGES.map((stage) => {
                    const d = position.weekly.find((w) => w.stage === stage);
                    const k = d?.kpi[wi] ?? 0;
                    const a = mergedActual[stage][wi] ?? 0;
                    return (
                      <>
                        <td
                          key={`${stage}-kpi-${wi}`}
                          className="py-2 px-3 text-center text-[#bbb] border-l border-[#f8f9fb]"
                        >
                          {k || '—'}
                        </td>
                        <td
                          key={`${stage}-act-${wi}`}
                          className={`py-2 px-3 text-center ${numCls(k, a)}`}
                        >
                          {a || '—'}
                        </td>
                      </>
                    );
                  })}
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-[#fafbfc] border-t border-[#e8ecf0]">
                <td className="py-2 px-3 text-[10px] font-semibold text-[#5a6a7e]">Total</td>
                {FUNNEL_STAGES.map((stage, si) => (
                  <>
                    <td
                      key={`${stage}-kpi-total`}
                      className="py-2 px-3 text-center text-[#9aa5b4] font-semibold border-l border-[#f0f2f5]"
                    >
                      {totals[si].kpi || '—'}
                    </td>
                    <td
                      key={`${stage}-act-total`}
                      className={`py-2 px-3 text-center font-semibold ${numCls(totals[si].kpi, totals[si].actual)}`}
                    >
                      {totals[si].actual || '—'}
                    </td>
                  </>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mini bar chart per stage */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          {FUNNEL_STAGES.map((stage, si) => {
            const { kpi, actual } = totals[si];
            const maxV = Math.max(kpi, actual, 1);
            const kpiPct = Math.round((kpi / maxV) * 100);
            const actPct = Math.round((actual / maxV) * 100);
            const cfg = STAGE_CONFIG[stage];
            return (
              <div key={stage} className="bg-[#fafbfc] rounded-lg p-2.5">
                <p className="text-[9px] font-medium mb-1.5" style={{ color: cfg.text }}>
                  {cfg.short === 'Applied' ? 'Applied' : cfg.label}
                </p>
                <div className="space-y-1">
                  <div>
                    <div className="flex justify-between text-[9px] text-[#bbb] mb-0.5">
                      <span>KPI</span>
                      <span>{kpi}</span>
                    </div>
                    <div className="h-1.5 bg-[#e8ecf0] rounded">
                      <div
                        className="h-full rounded bg-[#e2e6ea]"
                        style={{ width: `${kpiPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div
                      className="flex justify-between text-[9px] mb-0.5"
                      style={{ color: cfg.color }}
                    >
                      <span>Actual</span>
                      <span>{actual}</span>
                    </div>
                    <div className="h-1.5 bg-[#e8ecf0] rounded">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${actPct}%`, background: cfg.color }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Position Row ─────────────────────────────────────────────
function PositionRow({
  position,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
}: {
  position: Position;
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
}) {
  // Compute per-stage totals for last week (w4) in display
  const stageActuals = FUNNEL_STAGES.map((_, si) => {
    if (si === 0) return position.candidates.length;
    return position.candidates.filter((c) => {
      const idx = FUNNEL_STAGES.indexOf(c.currentStage as CandidateStage);
      return idx >= si;
    }).length;
  });
  const stageKpis = FUNNEL_STAGES.map((stage) => {
    const d = position.weekly.find((w) => w.stage === stage);
    return d ? d.kpi[3] : 0; // use W4 KPI as monthly target
  });

  // Highest active stage
  const highestIdx = [...stageActuals].reverse().findIndex((v) => v > 0);
  const currentStageIdx = highestIdx >= 0 ? FUNNEL_STAGES.length - 1 - highestIdx : 0;
  const currentStage = FUNNEL_STAGES[currentStageIdx];

  // Progress pct (applied actual vs kpi)
  const pct =
    stageKpis[0] > 0 ? Math.min(Math.round((stageActuals[0] / stageKpis[0]) * 100), 100) : 0;
  const pfill =
    stageActuals[0] >= stageKpis[0] && stageKpis[0] > 0
      ? '#22c55e'
      : stageActuals[0] > 0
        ? '#f59e0b'
        : '#e2e6ea';

  function numCls(kpi: number, act: number) {
    if (act === 0) return 'text-[#d1d5db]';
    if (kpi > 0 && act >= kpi) return 'text-green-600 font-semibold';
    return 'text-amber-600 font-semibold';
  }

  return (
    <tr className="border-b border-[#f8f9fb] hover:bg-[#fafbfc]">
      {/* Position name */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <div>
            <div className="text-[12.5px] font-medium text-[#1a2332]">{position.title}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[9px] bg-[#f0f2f5] text-[#5a6a7e] px-1.5 py-0.5 rounded">
                {position.domain}
              </span>
              <span className="text-[10px] text-[#9aa5b4]">{position.level}</span>
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-1 mt-1 max-w-[110px]">
              <div className="flex-1 h-[3px] rounded bg-[#f0f2f5] overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${pct}%`, background: pfill }}
                />
              </div>
              <span className="text-[9px]" style={{ color: pfill }}>
                {pct}%
              </span>
            </div>
          </div>
        </div>
      </td>
      {/* Priority */}
      <td className="py-2 px-2 text-center">
        <PriorityBadge priority={position.priority} />
      </td>
      {/* Current stage */}
      <td className="py-2 px-2 text-center">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap cursor-pointer hover:opacity-80"
          style={{
            background: STAGE_CONFIG[currentStage].bg,
            color: STAGE_CONFIG[currentStage].text,
          }}
          onClick={() => onWeeklyKpiClick(position)}
          title="Xem chi tiết KPI"
        >
          {STAGE_CONFIG[currentStage].label}
        </span>
      </td>
      {/* KPI / Actual per stage */}
      {FUNNEL_STAGES.map((stage, si) => (
        <td key={stage} className="py-2 px-2 text-center text-[11.5px]">
          <span className="text-[#bbb] text-[10px]">{stageKpis[si]}</span>
          <span className="text-[#bbb] mx-0.5">/</span>
          <span className={numCls(stageKpis[si], stageActuals[si])}>{stageActuals[si]}</span>
        </td>
      ))}
      {/* Status — select only */}
      <td className="py-2 px-3">
        {canEdit ? (
          <Select
            value={position.status}
            onValueChange={(v) => onStatusChange(position.id, v as RecruitmentStatus)}
          >
            <SelectTrigger className="h-6 text-[10px] max-w-[130px] border-[#e2e6ea]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_CONFIG) as RecruitmentStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[10px] text-[#9aa5b4]">{STATUS_CONFIG[position.status].label}</span>
        )}
      </td>
      {/* Weekly KPI icon */}
      <td className="py-2 px-2 text-center">
        <button
          className="w-7 h-7 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-blue-50 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center transition-colors mx-auto"
          onClick={() => onWeeklyKpiClick(position)}
          title="Xem chi tiết KPI tuần"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </td>
      {/* Actions */}
      {canEdit && (
        <td className="py-2 px-2">
          <div className="flex items-center gap-1 justify-center">
            <button
              className="w-7 h-7 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-[#f0f2f5] flex items-center justify-center transition-colors"
              onClick={() => onAddCandidate(position)}
              title="Thêm ứng viên"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-7 h-7 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-[#f0f2f5] flex items-center justify-center transition-colors"
              onClick={() => onEdit(position)}
              title="Sửa"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="w-7 h-7 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"
              onClick={() => onDelete(position.id)}
              title="Xóa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Positions table ─────────────────────────────────────────
function PositionsTable({
  positions,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
}: {
  positions: Position[];
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#fafbfc]">
            <th className="text-left px-3 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide min-w-[200px]">
              Vị trí
            </th>
            <th className="text-center px-2 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide">
              Pri
            </th>
            <th className="text-center px-2 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide min-w-[110px]">
              Stage
            </th>
            {FUNNEL_STAGES.map((stage) => (
              <th
                key={stage}
                className="text-center px-2 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide whitespace-nowrap"
              >
                {STAGE_CONFIG[stage].short === 'Applied' ? 'Applied' : STAGE_CONFIG[stage].label}
              </th>
            ))}
            <th className="text-center px-3 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide min-w-[130px]">
              Status
            </th>
            <th className="text-center px-2 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide w-[50px]">
              <Eye className="w-3.5 h-3.5 mx-auto" />
            </th>
            {canEdit && (
              <th className="text-center px-2 py-2.5 text-[10px] font-medium text-[#9aa5b4] uppercase tracking-wide">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 10 : 9} className="py-14 text-center text-sm text-[#9aa5b4]">
                Chưa có vị trí nào.
              </td>
            </tr>
          ) : (
            positions.map((p) => (
              <PositionRow
                key={p.id}
                position={p}
                canEdit={canEdit}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddCandidate={onAddCandidate}
                onCandidateClick={onCandidateClick}
                onWeeklyKpiClick={onWeeklyKpiClick}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pipeline view (Kanban) ───────────────────────────────────
function PipelineView({
  positions,
  onCandidateClick,
}: {
  positions: Position[];
  onCandidateClick: (c: Candidate) => void;
}) {
  const allCandidates = positions.flatMap((p) => p.candidates);
  const columns: CandidateStage[] = [
    'APPLIED',
    'HR_SCREEN',
    'LEADER_INTERVIEW',
    'CEO_INTERVIEW',
    'OFFER',
    'HIRED',
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((stage) => {
        const cands = allCandidates.filter((c) => c.currentStage === stage);
        const cfg = STAGE_CONFIG[stage];
        return (
          <div key={stage} className="flex-shrink-0 w-48">
            <div
              className="flex items-center justify-between px-3 py-2 rounded-t-lg mb-0.5"
              style={{ background: cfg.bg }}
            >
              <span className="text-[11px] font-semibold" style={{ color: cfg.text }}>
                {cfg.label}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: cfg.text + '22', color: cfg.text }}
              >
                {cands.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {cands.map((c) => {
                const pos = positions.find((p) => p.id === c.positionId);
                return (
                  <div
                    key={c.id}
                    className="bg-white border border-[#e2ede9] rounded-lg p-2.5 cursor-pointer hover:border-[#1DB87A] hover:shadow-sm transition-all"
                    onClick={() => onCandidateClick(c)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#1DB87A] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                        {getInitials(c.fullName)}
                      </div>
                      <span className="text-[12px] font-medium text-[#1a2332] truncate">
                        {c.fullName}
                      </span>
                    </div>
                    {pos && (
                      <span className="text-[9px] bg-[#f0f2f5] text-[#5a6a7e] px-1.5 py-0.5 rounded inline-block mb-1 truncate max-w-full">
                        {pos.title}
                      </span>
                    )}
                    {c.note && <p className="text-[10px] text-[#9aa5b4] truncate">{c.note}</p>}
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-[9px] text-[#9aa5b4]">
                        {SOURCE_LABELS[c.source] ?? c.source}
                      </span>
                      <span className="text-[#ddd]">·</span>
                      <span className="text-[9px] text-[#9aa5b4]">{c.appliedAt}</span>
                    </div>
                  </div>
                );
              })}
              {cands.length === 0 && (
                <div className="py-8 text-center text-[11px] text-[#ccc] italic">Không có</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add / Edit Position Dialog ──────────────────────────────
function PositionDialog({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Position | null;
  onClose: () => void;
  onSave: (data: Partial<Position>) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    level: editing?.level ?? '',
    domain: editing?.domain ?? '',
    priority: (editing?.priority ?? 'B') as Priority,
    headcount: editing?.headcount ?? 1,
    note: editing?.note ?? '',
    blocker: editing?.blocker ?? '',
  });

  // Reset when editing changes
  const resetForm = useCallback(() => {
    setForm({
      title: editing?.title ?? '',
      level: editing?.level ?? '',
      domain: editing?.domain ?? '',
      priority: (editing?.priority ?? 'B') as Priority,
      headcount: editing?.headcount ?? 1,
      note: editing?.note ?? '',
      blocker: editing?.blocker ?? '',
    });
  }, [editing]);

  // Reset on open
  useState(() => {
    resetForm();
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Vui lòng nhập tên vị trí');
      return;
    }
    onSave(form);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editing ? 'Sửa vị trí' : 'Tạo vị trí tuyển dụng'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
              Tên vị trí *
            </label>
            <Input
              placeholder="VD: Senior .NET System Engineer"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Level</label>
              <Input
                placeholder="Senior / Middle / Lead"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Domain</label>
              <Select
                value={form.domain}
                onValueChange={(v) => setForm((f) => ({ ...f, domain: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Priority</label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Urgent</SelectItem>
                  <SelectItem value="B">B — Normal</SelectItem>
                  <SelectItem value="C">C — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Headcount</label>
              <Input
                type="number"
                min={1}
                value={form.headcount}
                onChange={(e) => setForm((f) => ({ ...f, headcount: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Note</label>
            <Textarea
              rows={2}
              placeholder="Ghi chú thêm về vị trí..."
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Blocker</label>
            <Textarea
              rows={2}
              placeholder="Vấn đề đang chặn tiến độ..."
              value={form.blocker}
              onChange={(e) => setForm((f) => ({ ...f, blocker: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" size="sm">
              {editing ? 'Cập nhật' : 'Tạo vị trí'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add / Edit Candidate Dialog ─────────────────────────────
function CandidateDialog({
  open,
  editing,
  positionId,
  positionTitle,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Candidate | null;
  positionId: string;
  positionTitle: string;
  onClose: () => void;
  onSave: (data: Partial<Candidate>) => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: editing?.fullName ?? '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    source: editing?.source ?? 'LINKEDIN',
    currentStage: (editing?.currentStage ?? 'APPLIED') as CandidateStage,
    note: editing?.note ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên ứng viên');
      return;
    }
    onSave({ ...form, positionId });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editing ? 'Sửa ứng viên' : 'Thêm ứng viên'}
          </DialogTitle>
        </DialogHeader>
        {positionTitle && (
          <div className="bg-[#f5f7fa] border border-[#e8ecf0] rounded-lg px-3 py-2 text-xs text-[#5a6a7e] -mt-1 mb-1">
            Vị trí: <strong className="text-[#1a2332]">{positionTitle}</strong>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Họ tên *</label>
            <Input
              placeholder="Nguyễn Văn A"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Email</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
                Số điện thoại
              </label>
              <Input
                placeholder="0901234567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Nguồn</label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v as CandidateSource }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Stage</label>
              <Select
                value={form.currentStage}
                onValueChange={(v) => setForm((f) => ({ ...f, currentStage: v as CandidateStage }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAGE_CONFIG) as CandidateStage[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAGE_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Ghi chú</label>
            <Textarea
              rows={2}
              placeholder="VD: Strong portfolio, Referral từ Minh..."
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" size="sm">
              {editing ? 'Cập nhật' : 'Thêm ứng viên'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Candidate Detail Dialog ─────────────────────────────────
function CandidateDetailDialog({
  candidate,
  position,
  onClose,
  onEdit,
  onStageChange,
}: {
  candidate: Candidate | null;
  position: Position | null;
  onClose: () => void;
  onEdit: (c: Candidate) => void;
  onStageChange: (candidateId: string, stage: CandidateStage) => void | Promise<void>;
}) {
  if (!candidate) return null;
  const stages: CandidateStage[] = [
    'APPLIED',
    'HR_SCREEN',
    'LEADER_INTERVIEW',
    'CEO_INTERVIEW',
    'OFFER',
    'HIRED',
  ];
  const currentIdx = stages.indexOf(candidate.currentStage);

  return (
    <Dialog
      open={Boolean(candidate)}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Chi tiết ứng viên</DialogTitle>
        </DialogHeader>
        {/* Profile header */}
        <div className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded-full bg-[#1DB87A] text-white text-lg font-bold flex items-center justify-center flex-shrink-0">
            {getInitials(candidate.fullName)}
          </div>
          <div>
            <p className="font-semibold text-[#1a2332] text-[15px]">{candidate.fullName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StageBadge stage={candidate.currentStage} />
              <span className="text-[10px] text-[#9aa5b4]">
                {SOURCE_LABELS[candidate.source] ?? candidate.source}
              </span>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { label: 'Email', value: candidate.email || '—' },
            { label: 'SĐT', value: candidate.phone || '—' },
            { label: 'Vị trí', value: position?.title || '—' },
            { label: 'Apply lúc', value: candidate.appliedAt || '—' },
          ].map((row) => (
            <div key={row.label} className="bg-[#f5f7fa] rounded-lg px-3 py-2">
              <p className="text-[10px] text-[#9aa5b4] mb-0.5">{row.label}</p>
              <p className="font-medium text-[#1a2332] truncate">{row.value}</p>
            </div>
          ))}
        </div>

        {/* Stage stepper */}
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-wide text-[#9aa5b4] mb-2">
            Pipeline
          </p>
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {stages.map((s, i) => {
              const cfg = STAGE_CONFIG[s];
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div key={s} className="flex items-center">
                  <button
                    className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-colors ${
                      isActive ? '' : 'opacity-40 hover:opacity-70'
                    }`}
                    onClick={() => onStageChange(candidate.id, s)}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${isDone ? 'ring-2 ring-offset-1' : ''}`}
                      style={{ background: isActive || isDone ? cfg.color : '#e5e7eb' }}
                    />
                    <span
                      className="text-[9px] whitespace-nowrap"
                      style={{ color: isActive ? cfg.text : undefined }}
                    >
                      {cfg.short}
                    </span>
                  </button>
                  {i < stages.length - 1 && (
                    <div
                      className={`w-4 h-[1px] ${i < currentIdx ? 'bg-[#1DB87A]' : 'bg-[#e5e7eb]'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Note */}
        {candidate.note && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
            <strong>Note:</strong> {candidate.note}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onEdit(candidate);
              onClose();
            }}
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Sửa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Monthly Tracker view ─────────────────────────────────────
function MonthlyTrackerView({
  positions,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
  onAddHighlight,
  onAddBlocker,
}: {
  positions: Position[];
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
  onAddHighlight: () => void;
  onAddBlocker: () => void;
}) {
  return (
    <div className="space-y-3.5">
      {/* Status strip */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Tổng', count: positions.length, dot: '#9aa5b4' },
          { label: 'On Track', count: positions.filter((p) => !p.blocker).length, dot: '#22c55e' },
          { label: 'At Risk', count: positions.filter((p) => p.blocker).length, dot: '#ef4444' },
          {
            label: 'Offer/Hired',
            count: positions.filter((p) => p.status === 'OFFER_SENT' || p.status === 'HIRED')
              .length,
            dot: '#8b5cf6',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e2e6ea] bg-white text-sm text-[#5a6a7e]"
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: s.dot }}
            />
            <span className="font-semibold text-[#1a2332]">{s.count}</span>
            {s.label}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0f2f5]">
          <span className="text-[12.5px] font-semibold text-[#1a2332] flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-[#9aa5b4]" />
            Monthly Tracker — Active Positions ({positions.length})
          </span>
        </div>
        <PositionsTable
          positions={positions}
          canEdit={canEdit}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddCandidate={onAddCandidate}
          onCandidateClick={onCandidateClick}
          onWeeklyKpiClick={onWeeklyKpiClick}
        />
      </div>
      <HBCard
        positions={positions}
        canEdit={canEdit}
        onAddHighlight={onAddHighlight}
        onAddBlocker={onAddBlocker}
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
type ViewerUser = { id?: string; role?: string; systemRole?: string | null };

export default function RecruitmentPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewer] = useState<ViewerUser | null>(() => getStoredUser<ViewerUser>());
  const [activeView, setActiveView] = useState<'dashboard' | 'tracker' | 'pipeline'>('dashboard');
  const [curMonth, setCurMonth] = useState(new Date().getMonth());
  const [curYear, setCurYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const canEdit =
    viewer?.role?.toUpperCase() === 'HR' ||
    viewer?.role?.toUpperCase() === 'ADMIN' ||
    viewer?.systemRole?.toUpperCase() === 'ADMIN';

  // Dialogs
  const [positionDialog, setPositionDialog] = useState<{ open: boolean; editing: Position | null }>(
    { open: false, editing: null },
  );
  const [candidateDialog, setCandidateDialog] = useState<{
    open: boolean;
    editing: Candidate | null;
    position: Position | null;
  }>({ open: false, editing: null, position: null });
  const [candidateDetail, setCandidateDetail] = useState<Candidate | null>(null);
  const [weeklyKpiModal, setWeeklyKpiModal] = useState<Position | null>(null);
  const [insightDialog, setInsightDialog] = useState<{ open: boolean; kind: 'note' | 'blocker' }>({
    open: false,
    kind: 'note',
  });

  // Fetch positions from API
  const fetchPositions = useCallback(async (year: number, month: number) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<ApiPosition[]>(
        `/api/recruitment/positions?year=${year}&month=${month + 1}&limit=200`,
      );
      setPositions((res.data ?? []).map(transformPosition));
    } catch {
      // keep current data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPositions(curYear, curMonth);
  }, [curYear, curMonth, fetchPositions]);

  // Filtered positions
  const filtered = useMemo(() => {
    return positions.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.domain.toLowerCase().includes(search.toLowerCase());
      const matchDomain = filterDomain === 'ALL' || p.domain === filterDomain;
      const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
      return matchSearch && matchDomain && matchStatus;
    });
  }, [positions, search, filterDomain, filterStatus]);

  // KPI aggregates
  const kpi = useMemo(() => {
    const allCandidates = filtered.flatMap((p) => p.candidates);
    return {
      applied: allCandidates.length,
      hrScreen: allCandidates.filter((c) => !['APPLIED', 'REJECTED'].includes(c.currentStage))
        .length,
      leaderRound: allCandidates.filter((c) =>
        ['LEADER_INTERVIEW', 'CEO_INTERVIEW', 'OFFER', 'HIRED'].includes(c.currentStage),
      ).length,
      ceoRound: allCandidates.filter((c) =>
        ['CEO_INTERVIEW', 'OFFER', 'HIRED'].includes(c.currentStage),
      ).length,
      offerHired: filtered.filter((p) => p.status === 'OFFER_SENT' || p.status === 'HIRED').length,
      atRisk: filtered.filter((p) => Boolean(p.blocker)).length,
    };
  }, [filtered]);

  const blockers = filtered.filter((p) => p.blocker);

  // Month navigation
  function prevMonth() {
    if (curMonth === 0) {
      setCurMonth(11);
      setCurYear((y) => y - 1);
    } else setCurMonth((m) => m - 1);
  }
  function nextMonth() {
    if (curMonth === 11) {
      setCurMonth(0);
      setCurYear((y) => y + 1);
    } else setCurMonth((m) => m + 1);
  }

  // Handlers
  const handleStatusChange = useCallback(
    async (id: string, status: RecruitmentStatus) => {
      // Optimistic update
      setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      try {
        await apiClient.patch(`/api/recruitment/positions/${id}`, { status });
        toast.success('Đã cập nhật trạng thái');
      } catch (err: unknown) {
        // Rollback not practical here — refetch to restore truth
        void fetchPositions(curYear, curMonth);
        toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
      }
    },
    [curYear, curMonth, fetchPositions],
  );

  const handleSavePosition = useCallback(
    async (data: Partial<Position>) => {
      try {
        if (positionDialog.editing) {
          await apiClient.patch(`/api/recruitment/positions/${positionDialog.editing.id}`, data);
          toast.success('Đã cập nhật vị trí');
        } else {
          await apiClient.post('/api/recruitment/positions', data);
          toast.success('Đã tạo vị trí tuyển dụng');
        }
        setPositionDialog({ open: false, editing: null });
        void fetchPositions(curYear, curMonth);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
      }
    },
    [positionDialog.editing, curYear, curMonth, fetchPositions],
  );

  const handleDeletePosition = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/api/recruitment/positions/${id}`);
      setPositions((prev) => prev.filter((p) => p.id !== id));
      toast.success('Đã xóa vị trí');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }, []);

  const handleSaveCandidate = useCallback(
    async (data: Partial<Candidate>) => {
      try {
        if (candidateDialog.editing) {
          await apiClient.patch(`/api/recruitment/candidates/${candidateDialog.editing.id}`, data);
          toast.success('Đã cập nhật ứng viên');
        } else {
          const posId = candidateDialog.position?.id;
          if (!posId) return;
          await apiClient.post(`/api/recruitment/positions/${posId}/candidates`, data);
          toast.success('Đã thêm ứng viên');
        }
        setCandidateDialog({ open: false, editing: null, position: null });
        void fetchPositions(curYear, curMonth);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
      }
    },
    [candidateDialog, curYear, curMonth, fetchPositions],
  );

  const handleSaveInsight = useCallback(
    async ({ positionId, text }: { positionId: string; text: string }) => {
      try {
        if (insightDialog.kind === 'blocker') {
          await apiClient.patch(`/api/recruitment/positions/${positionId}`, { blocker: text });
          toast.success('Đã thêm blocker');
        } else {
          await apiClient.patch(`/api/recruitment/positions/${positionId}`, { note: text });
          toast.success('Đã thêm highlight');
        }
        setInsightDialog({ open: false, kind: 'note' });
        void fetchPositions(curYear, curMonth);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
      }
    },
    [insightDialog.kind, curYear, curMonth, fetchPositions],
  );

  const handleStageChange = useCallback(
    async (candidateId: string, stage: CandidateStage) => {
      // Optimistic update
      setPositions((prev) =>
        prev.map((p) => ({
          ...p,
          candidates: p.candidates.map((c) =>
            c.id === candidateId ? { ...c, currentStage: stage } : c,
          ),
        })),
      );
      try {
        await apiClient.patch(`/api/recruitment/candidates/${candidateId}/stage`, { stage });
        toast.success(`Đã chuyển sang ${STAGE_CONFIG[stage].label}`);
      } catch (err: unknown) {
        void fetchPositions(curYear, curMonth);
        toast.error(err instanceof Error ? err.message : 'Cập nhật thất bại');
      }
    },
    [curYear, curMonth, fetchPositions],
  );

  const selectedCandidatePosition = candidateDetail
    ? (positions.find((p) => p.id === candidateDetail.positionId) ?? null)
    : null;

  if (isLoading && positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#1DB87A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header ── */}
      <div className="pb-0 flex items-end justify-between gap-3 flex-wrap flex-shrink-0">
        <div>
          <h1 className="text-[17px] font-semibold text-[#1a2332]">Recruitment</h1>
          <p className="text-[11px] text-[#9aa5b4] mt-0.5">
            Quản lý pipeline tuyển dụng · {filtered.length} vị trí
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View tabs */}
          <div className="flex gap-0.5 bg-[#f0f2f5] p-[3px] rounded-[9px]">
            {(['dashboard', 'tracker', 'pipeline'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-3.5 py-[5px] rounded-[7px] text-[12px] cursor-pointer transition-all ${
                  activeView === v
                    ? 'bg-white text-[#1DB87A] font-medium shadow-sm'
                    : 'text-[#5a6a7e] hover:text-[#1a2332]'
                }`}
              >
                {v === 'dashboard' ? 'Dashboard' : v === 'tracker' ? 'Monthly Tracker' : 'Pipeline'}
              </button>
            ))}
          </div>
          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="w-[26px] h-[26px] rounded-[6px] border border-[#e2e6ea] bg-white flex items-center justify-center text-[#5a6a7e] hover:bg-[#f0f2f5] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[13px] font-semibold text-[#1a2332] min-w-[88px] text-center">
              {MONTHS[curMonth]} {curYear}
            </span>
            <button
              onClick={nextMonth}
              className="w-[26px] h-[26px] rounded-[6px] border border-[#e2e6ea] bg-white flex items-center justify-center text-[#5a6a7e] hover:bg-[#f0f2f5] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Month pills */}
      <div className="pt-2 flex gap-1.5 flex-wrap flex-shrink-0">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setCurMonth(i)}
            className={`text-[11px] px-2.5 py-[3px] rounded-full border cursor-pointer transition-all ${
              i === curMonth
                ? 'bg-[#1DB87A] text-white border-[#1DB87A] font-medium'
                : i < curMonth
                  ? 'bg-white text-[#1D9E75] border-[#1D9E75] hover:border-[#1DB87A] hover:text-[#1DB87A]'
                  : 'bg-white text-[#9aa5b4] border-[#e2ede9] hover:border-[#1DB87A] hover:text-[#1DB87A] border-dashed'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto pt-4 pb-6 space-y-3.5">
        {/* KPI grid */}
        <div className="grid grid-cols-6 gap-2.5">
          <KpiCard
            label="Total Applied"
            value={kpi.applied}
            sub={`KPI: ${filtered.reduce((s, p) => s + (p.weekly[0]?.kpi[3] ?? 0), 0)}`}
            color="#3b82f6"
          />
          <KpiCard
            label="HR Screen"
            value={kpi.hrScreen}
            sub={`${kpi.applied > 0 ? Math.round((kpi.hrScreen / kpi.applied) * 100) : 0}% conversion`}
            color="#8b5cf6"
          />
          <KpiCard
            label="Leader Round"
            value={kpi.leaderRound}
            sub={`${kpi.hrScreen > 0 ? Math.round((kpi.leaderRound / kpi.hrScreen) * 100) : 0}% từ HR`}
            color="#f59e0b"
          />
          <KpiCard
            label="CEO Interview"
            value={kpi.ceoRound}
            sub={`${kpi.leaderRound > 0 ? Math.round((kpi.ceoRound / kpi.leaderRound) * 100) : 0}% từ Leader`}
            color="#10b981"
          />
          <KpiCard
            label="Offer / Hired"
            value={kpi.offerHired}
            sub="positions"
            color="#22c55e"
            alertClass={kpi.offerHired > 0 ? 'border-green-200 bg-green-50' : ''}
          />
          <KpiCard
            label="At Risk"
            value={kpi.atRisk}
            sub="có blocker"
            color="#ef4444"
            alertClass={kpi.atRisk > 0 ? 'border-red-200 bg-red-50' : ''}
          />
        </div>

        {/* Blocker banner */}
        {blockers.length > 0 && (
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-4 py-2.5 flex items-start gap-2.5 text-[11px] text-[#92400E]">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {blockers.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && <span className="mx-2 text-[#FCA5A5]">·</span>}
                  <strong>{p.title}</strong>: {p.blocker}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9aa5b4]" />
            <Input
              className="pl-8 h-8 text-[12px]"
              placeholder="Tìm vị trí..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterDomain} onValueChange={setFilterDomain}>
            <SelectTrigger className="h-8 w-[130px] text-[12px]">
              <SelectValue placeholder="Domain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả domain</SelectItem>
              {DOMAINS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[150px] text-[12px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              {(Object.keys(STATUS_CONFIG) as RecruitmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]">
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-[12px] bg-[#1DB87A] hover:bg-[#169a67] text-white"
              onClick={() => setPositionDialog({ open: true, editing: null })}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Position
            </Button>
          </div>
        </div>

        {/* ── View-specific content ── */}

        {activeView === 'dashboard' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-[1fr_300px] gap-3.5">
              {/* Positions table */}
              <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f0f2f5] flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#1a2332] flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#9aa5b4]" />
                    Active Positions ({filtered.length})
                  </span>
                  <span className="text-[10px] text-[#9aa5b4]">Click row để xem chi tiết</span>
                </div>
                <PositionsTable
                  positions={filtered}
                  canEdit={canEdit}
                  onStatusChange={handleStatusChange}
                  onEdit={(p) => setPositionDialog({ open: true, editing: p })}
                  onDelete={handleDeletePosition}
                  onAddCandidate={(p) =>
                    setCandidateDialog({ open: true, editing: null, position: p })
                  }
                  onCandidateClick={setCandidateDetail}
                  onWeeklyKpiClick={setWeeklyKpiModal}
                />
              </div>
              {/* Funnel */}
              <FunnelCard positions={filtered} />
            </div>
            {/* Trend */}
            <TrendCard positions={filtered} />
            {/* Highlights & Blockers */}
            <HBCard
              positions={filtered}
              canEdit={canEdit}
              onAddHighlight={() => setInsightDialog({ open: true, kind: 'note' })}
              onAddBlocker={() => setInsightDialog({ open: true, kind: 'blocker' })}
            />
          </div>
        )}

        {activeView === 'tracker' && (
          <MonthlyTrackerView
            positions={filtered}
            canEdit={canEdit}
            onStatusChange={handleStatusChange}
            onEdit={(p) => setPositionDialog({ open: true, editing: p })}
            onDelete={handleDeletePosition}
            onAddCandidate={(p) => setCandidateDialog({ open: true, editing: null, position: p })}
            onCandidateClick={setCandidateDetail}
            onWeeklyKpiClick={setWeeklyKpiModal}
            onAddHighlight={() => setInsightDialog({ open: true, kind: 'note' })}
            onAddBlocker={() => setInsightDialog({ open: true, kind: 'blocker' })}
          />
        )}

        {activeView === 'pipeline' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-[1fr_300px] gap-3.5">
              <FunnelCard positions={filtered} />
              <TrendCard positions={filtered} />
            </div>
            <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f0f2f5]">
                <span className="text-[12.5px] font-semibold text-[#1a2332] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#9aa5b4]" />
                  Pipeline — Tất cả ứng viên
                </span>
              </div>
              <div className="p-4">
                <PipelineView positions={filtered} onCandidateClick={setCandidateDetail} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <WeeklyKpiModal position={weeklyKpiModal} onClose={() => setWeeklyKpiModal(null)} />
      <InsightDialog
        open={insightDialog.open}
        kind={insightDialog.kind}
        positions={filtered}
        onClose={() => setInsightDialog({ open: false, kind: 'note' })}
        onSave={handleSaveInsight}
      />
      <PositionDialog
        open={positionDialog.open}
        editing={positionDialog.editing}
        onClose={() => setPositionDialog({ open: false, editing: null })}
        onSave={handleSavePosition}
      />

      <CandidateDialog
        open={candidateDialog.open}
        editing={candidateDialog.editing}
        positionId={candidateDialog.position?.id ?? ''}
        positionTitle={candidateDialog.position?.title ?? ''}
        onClose={() => setCandidateDialog({ open: false, editing: null, position: null })}
        onSave={handleSaveCandidate}
      />

      <CandidateDetailDialog
        candidate={candidateDetail}
        position={selectedCandidatePosition}
        onClose={() => setCandidateDetail(null)}
        onEdit={(c) => {
          const pos = positions.find((p) => p.id === c.positionId) ?? null;
          setCandidateDialog({ open: true, editing: c, position: pos });
          setCandidateDetail(null);
        }}
        onStageChange={(candidateId, stage) => {
          handleStageChange(candidateId, stage);
          // update detail view
          setCandidateDetail((prev) => (prev ? { ...prev, currentStage: stage } : prev));
        }}
      />
    </div>
  );
}
