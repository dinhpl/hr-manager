'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { apiClient, getStoredUser } from '@/lib/api-client';
import {
  AlertCircle,
  BarChart2,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CloudUpload,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TiptapNotionEditor } from '@/components/tiptap-notion-editor';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
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
  | 'DONE'
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
  cvUrls: string[];
}

interface WeeklyData {
  stage: CandidateStage;
  kpi: [number, number, number, number];
  actual: [number, number, number, number];
}

type InsightType = 'HIGHLIGHT' | 'BLOCKER';

interface PositionInsight {
  id: string;
  positionId: string;
  type: InsightType;
  content: string;
  createdAt: string;
}

interface Position {
  id: string;
  title: string;
  currentStage: CandidateStage;
  level: string;
  domain: string;
  priority: Priority;
  headcount: number;
  status: RecruitmentStatus;
  requestDate: string;
  onboardDeadline: string;
  descriptionSkills: string;
  salaryRangeUsd: string;
  mainSkills: string;
  jdDetails: string;
  cvSource: string;
  note: string;
  blocker: string;
  openedAt: string;
  candidates: Candidate[];
  weekly: WeeklyData[];
  insights: PositionInsight[];
}

// ─── Constants ─────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_CONFIG: Record<RecruitmentStatus, { label: string; bg: string; text: string }> = {
  NOT_STARTED: { label: 'Not started', bg: '#F3F4F6', text: '#6B7280' },
  IN_PROGRESS: { label: 'In progress', bg: '#FEF3C7', text: '#92400E' },
  INTERVIEWING: { label: 'Interviewing', bg: '#DBEAFE', text: '#1D4ED8' },
  OFFER_SENT: { label: 'Offer sent', bg: '#D1FAE5', text: '#065F46' },
  HIRED: { label: 'Hired / Onboarded', bg: '#BBF7D0', text: '#065F46' },
  DONE: { label: 'Done', bg: '#E0F2FE', text: '#0369A1' },
  ON_HOLD: { label: 'On hold', bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED: { label: 'Cancelled', bg: '#E5E7EB', text: '#6B7280' },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG) as RecruitmentStatus[];
const DEFAULT_STATUS_FILTERS = STATUS_OPTIONS.filter((s) => s !== 'DONE');

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

const LEVELS = ['Senior', 'Middle', 'Lead'] as const;
const DOMAINS = ['MK', 'NC', 'Exsiting'] as const;
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
const POSITION_STAGE_OPTIONS: CandidateStage[] = [
  'APPLIED',
  'HR_SCREEN',
  'LEADER_INTERVIEW',
  'CEO_INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
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
  cvUrl: string | null;
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
  currentStage: CandidateStage;
  level: string;
  domain: string;
  priority: Priority;
  headcount: number;
  status: RecruitmentStatus;
  requestDate: string | null;
  onboardDeadline: string | null;
  descriptionSkills: string | null;
  salaryRangeUsd: string | null;
  mainSkills: string | null;
  jdDetails: string | null;
  cvSource: string | null;
  note: string | null;
  blocker: string | null;
  openedAt: string;
  candidates: ApiCandidate[];
  weeklyStats: ApiWeeklyKpi[];
  insights?: ApiInsight[];
}

interface ApiInsight {
  id: string;
  positionId: string;
  type: InsightType;
  content: string;
  createdAt: string;
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
    cvUrls: parseCandidateCvUrls(c.cvUrl),
  }));

  const insights: PositionInsight[] = (api.insights ?? []).map((i) => ({
    id: i.id,
    positionId: i.positionId,
    type: i.type,
    content: i.content ?? '',
    createdAt: i.createdAt ? i.createdAt.slice(0, 19) : '',
  }));

  return {
    id: api.id,
    title: api.title,
    currentStage: api.currentStage ?? 'APPLIED',
    level: api.level,
    domain: api.domain,
    priority: api.priority,
    headcount: api.headcount,
    status: api.status,
    requestDate: api.requestDate ? api.requestDate.slice(0, 10) : '',
    onboardDeadline: api.onboardDeadline ? api.onboardDeadline.slice(0, 10) : '',
    descriptionSkills: api.descriptionSkills ?? '',
    salaryRangeUsd: api.salaryRangeUsd ?? '',
    mainSkills: api.mainSkills ?? '',
    jdDetails: api.jdDetails ?? '',
    cvSource: api.cvSource ?? '',
    note: api.note ?? '',
    blocker: api.blocker ?? '',
    openedAt: api.openedAt ? api.openedAt.slice(0, 10) : '',
    candidates,
    weekly,
    insights,
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

function hasMeaningfulHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim().length > 0;
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToMultilineText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCandidateCvUrls(cvUrl?: string | null): string[] {
  if (!cvUrl) return [];
  const raw = cvUrl.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // fallback for old data stored as a plain string
  }

  return [raw];
}

function normalizeCandidateFileUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return url;
  if (url.startsWith('uploads/')) return `/${url}`;
  return `/uploads/cv/${url}`;
}

function getFilenameFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0];
  const name = cleanUrl.split('/').filter(Boolean).pop() ?? url;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
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
  // Tổng tháng = sum W1+W2+W3+W4
  const totals = FUNNEL_STAGES.map((stage) =>
    positions.reduce((sum, p) => {
      const stageData = p.weekly.find((w) => w.stage === stage);
      return sum + (stageData ? sumArr(stageData.actual) : 0);
    }, 0),
  );
  const kpis = FUNNEL_STAGES.map((stage) =>
    positions.reduce((sum, p) => {
      const stageData = p.weekly.find((w) => w.stage === stage);
      return sum + (stageData ? sumArr(stageData.kpi) : 0);
    }, 0),
  );
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
          const kpPct = kpis[i] > 0 ? 100 : 0;
          const actPct = kpis[i] > 0 ? Math.min(Math.round((totals[i] / kpis[i]) * 100), 100) : 0;
          const rate =
            i === 0
              ? kpis[i] > 0
                ? Math.round((totals[i] / kpis[i]) * 100)
                : null
              : totals[i - 1] > 0
                ? Math.round((totals[i] / totals[i - 1]) * 100)
                : null;
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
  onDeleteInsight,
}: {
  positions: Position[];
  canEdit?: boolean;
  onAddHighlight?: () => void;
  onAddBlocker?: () => void;
  onDeleteInsight?: (id: string) => void | Promise<void>;
}) {
  const highlights = positions.flatMap((p) =>
    p.insights
      .filter((i) => i.type === 'HIGHLIGHT')
      .map((i) => ({ id: i.id, title: p.title, content: i.content })),
  );
  const blockers = positions.flatMap((p) =>
    p.insights
      .filter((i) => i.type === 'BLOCKER')
      .map((i) => ({ id: i.id, title: p.title, content: i.content })),
  );

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
              {highlights.map((h) => (
                <div key={h.id} className="flex gap-2 pb-2 border-b border-[#f8f9fb] last:border-b-0">
                  <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[11.5px] text-[#2d3a4a] [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1"
                      dangerouslySetInnerHTML={{ __html: h.content }}
                    />
                    <p className="text-[10px] text-[#9aa5b4] mt-0.5">{h.title}</p>
                  </div>
                  {canEdit && onDeleteInsight && (
                    <button
                      type="button"
                      className="w-5 h-5 rounded border border-[#e2e6ea] text-[#9aa5b4] hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
                      onClick={() => void onDeleteInsight(h.id)}
                      title="Xóa"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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
              {blockers.map((b) => (
                <div key={b.id} className="flex gap-2 pb-2 border-b border-[#f8f9fb] last:border-b-0">
                  <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[11.5px] text-[#2d3a4a] [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1"
                      dangerouslySetInnerHTML={{ __html: b.content }}
                    />
                    <p className="text-[10px] text-[#9aa5b4] mt-0.5">{b.title}</p>
                  </div>
                  {canEdit && onDeleteInsight && (
                    <button
                      type="button"
                      className="w-5 h-5 rounded border border-[#e2e6ea] text-[#9aa5b4] hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center"
                      onClick={() => void onDeleteInsight(b.id)}
                      title="Xóa"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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
  kind: InsightType;
  positions: Position[];
  onClose: () => void;
  onSave: (data: { positionId: string; content: string; type: InsightType }) => void | Promise<void>;
}) {
  const [positionId, setPositionId] = useState<string>('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!open) return;
    setPositionId(positions[0]?.id ?? '');
    setContent('');
  }, [open, positions]);

  const isBlocker = kind === 'BLOCKER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionId) {
      toast.error('Vui lòng chọn vị trí');
      return;
    }
    if (!hasMeaningfulHtml(content)) {
      toast.error(`Vui lòng nhập ${isBlocker ? 'blocker' : 'highlight'}`);
      return;
    }
    onSave({ positionId, content, type: kind });
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
            <TiptapNotionEditor
              value={content}
              onChange={setContent}
              placeholder={
                isBlocker
                  ? 'VD: Chậm feedback từ hiring manager...'
                  : 'VD: Tăng tốc sourcing, nhiều CV chất lượng...'
              }
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
function WeeklyKpiModal({
  position,
  canEdit,
  onClose,
  onCandidateClick,
  onSaveKpi,
  onSaveActual,
}: {
  position: Position | null;
  canEdit: boolean;
  onClose: () => void;
  onCandidateClick: (c: Candidate) => void;
  onSaveKpi: (positionId: string, stage: CandidateStage, kpi: number) => Promise<void>;
  onSaveActual: (positionId: string, week: number, stage: CandidateStage, actual: number) => Promise<void>;
}) {
  const [draftKpi, setDraftKpi] = useState<Record<CandidateStage, string>>({
    APPLIED: '0',
    HR_SCREEN: '0',
    LEADER_INTERVIEW: '0',
    CEO_INTERVIEW: '0',
    OFFER: '0',
    HIRED: '0',
    REJECTED: '0',
  });
  const [draftActual, setDraftActual] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!position) return;
    const k = {
      APPLIED: '0',
      HR_SCREEN: '0',
      LEADER_INTERVIEW: '0',
      CEO_INTERVIEW: '0',
      OFFER: '0',
      HIRED: '0',
      REJECTED: '0',
    } as Record<CandidateStage, string>;
    const a: Record<string, string> = {};
    FUNNEL_STAGES.forEach((stage) => {
      const weekly = position.weekly.find((w) => w.stage === stage);
      k[stage] = String(weekly ? sumArr(weekly.kpi) : 0);
      [0, 1, 2, 3].forEach((wi) => {
        a[`${stage}-${wi}`] = String(weekly?.actual[wi] ?? 0);
      });
    });
    setDraftKpi(k);
    setDraftActual(a);
  }, [position]);

  if (!position) return null;
  const pos = position;
  const positionId = pos.id;

  function updateKpiDraft(stage: CandidateStage, val: string) {
    setDraftKpi((prev) => ({
      ...prev,
      [stage]: val,
    }));
  }

  function updateActualDraft(stage: CandidateStage, wi: number, val: string) {
    setDraftActual((prev) => ({
      ...prev,
      [`${stage}-${wi}`]: val,
    }));
  }

  async function handleKpiBlur(stage: CandidateStage) {
    const k = Math.max(0, parseInt(draftKpi[stage] ?? '0', 10) || 0);
    await onSaveKpi(positionId, stage, k);
  }

  async function handleActualBlur(stage: CandidateStage, wi: number) {
    const actual = Math.max(0, parseInt(draftActual[`${stage}-${wi}`] ?? '0', 10) || 0);
    await onSaveActual(positionId, wi + 1, stage, actual);
  }

  function numCls(kpi: number, act: number) {
    if (act === 0) return 'text-[#d1d5db]';
    if (kpi > 0 && act >= kpi) return 'text-green-600 font-semibold';
    return 'text-amber-600 font-semibold';
  }

  const funnelIdxFromStage = (stage: CandidateStage) => {
    const idx = FUNNEL_STAGES.indexOf(stage);
    if (idx >= 0) return idx;
    if (stage === 'OFFER' || stage === 'HIRED') return FUNNEL_STAGES.length - 1;
    if (stage === 'REJECTED') return 0;
    return -1;
  };

  function getActualByWeek(stage: CandidateStage): number[] {
    const row = pos.weekly.find((w) => w.stage === stage);
    if (canEdit) {
      return [0, 1, 2, 3].map((wi) => Math.max(0, parseInt(draftActual[`${stage}-${wi}`] ?? '0', 10) || 0));
    }
    const toWeekIndex = (appliedAt: string) => {
      const d = new Date(appliedAt);
      if (Number.isNaN(d.getTime())) return null;
      return Math.max(0, Math.min(3, Math.floor((d.getDate() - 1) / 7)));
    };
    const liveByWeek = [0, 0, 0, 0];
    pos.candidates.forEach((c) => {
      const wi = toWeekIndex(c.appliedAt);
      if (wi === null) return;
      const stageIdx = funnelIdxFromStage(c.currentStage);
      const thisIdx = FUNNEL_STAGES.indexOf(stage);
      if (stageIdx >= thisIdx) liveByWeek[wi] += 1;
    });
    return [0, 1, 2, 3].map((wi) => Math.max(row?.actual[wi] ?? 0, liveByWeek[wi]));
  }

  const totals = FUNNEL_STAGES.map((stage) => {
    const thisIdx = FUNNEL_STAGES.indexOf(stage);
    const liveActual = pos.candidates.reduce((sum, c) => {
      const stageIdx = funnelIdxFromStage(c.currentStage);
      return stageIdx >= thisIdx ? sum + 1 : sum;
    }, 0);
    const row = pos.weekly.find((w) => w.stage === stage);
    const storedActual = sumArr(getActualByWeek(stage));
    const actual = Math.max(storedActual, liveActual);
    const kpi = canEdit
      ? Math.max(0, parseInt(draftKpi[stage] ?? '0', 10) || 0)
      : row
        ? sumArr(row.kpi)
        : 0;
    return { kpi, actual };
  });

  return (
    <Dialog
      open={Boolean(position)}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#1DB87A]" />
            Monthly KPI + Weekly Actual — {pos.title}
            {canEdit && (
              <span className="text-[10px] font-normal text-[#9aa5b4] ml-1">
                · Actual theo tuần, KPI theo tháng
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Position meta */}
        <div className="flex items-center gap-2 -mt-1 mb-1">
          <span className="text-[10px] bg-[#f0f2f5] text-[#5a6a7e] px-1.5 py-0.5 rounded">
            {pos.domain}
          </span>
          <span className="text-[10px] text-[#9aa5b4]">{pos.level}</span>
          <PriorityBadge priority={pos.priority} />
          <StatusBadge status={pos.status} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#f0f2f5]">
                <th className="py-2 px-3 text-left text-[9.5px] text-[#9aa5b4] font-medium w-[72px]">Week</th>
                {FUNNEL_STAGES.map((stage) => (
                  <th
                    key={stage}
                    className="py-2 px-3 text-center text-[9.5px] font-semibold border-l border-[#f0f2f5]"
                    style={{ color: STAGE_CONFIG[stage].text }}
                  >
                    {STAGE_CONFIG[stage].short === 'Applied' ? 'Applied' : STAGE_CONFIG[stage].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((wi) => (
                <tr key={wi} className="border-b border-[#f8f9fb] hover:bg-[#fafbfc]">
                  <td className="py-2 px-3 text-[#5a6a7e] font-medium">W{wi + 1}</td>
                  {FUNNEL_STAGES.map((stage, si) => {
                    const weekVals = getActualByWeek(stage);
                    const weekActual = weekVals[wi] ?? 0;
                    const monthKpi = totals[si].kpi;
                    return (
                      <td key={`${stage}-${wi}`} className="py-1.5 px-2 text-center border-l border-[#f8f9fb]">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            value={draftActual[`${stage}-${wi}`] ?? '0'}
                            onChange={(e) => updateActualDraft(stage, wi, e.target.value)}
                            onBlur={() => void handleActualBlur(stage, wi)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            className={`w-12 text-center text-[11px] border rounded px-0.5 py-0.5 focus:border-[#1DB87A] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${numCls(monthKpi, weekActual).includes('green') ? 'border-green-300' : numCls(monthKpi, weekActual).includes('amber') ? 'border-amber-300' : 'border-[#e2e6ea]'}`}
                          />
                        ) : (
                          <span className={numCls(monthKpi, weekActual)}>{weekActual || '—'}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="bg-[#f9fcff] border-b border-[#e8ecf0]">
                <td className="py-2 px-3 text-[10px] font-semibold text-[#5a6a7e]">KPI tháng</td>
                {FUNNEL_STAGES.map((stage, si) => (
                  <td key={`${stage}-kpi-month`} className="py-1.5 px-2 text-center border-l border-[#edf2f7]">
                    {canEdit ? (
                      <input
                        type="number"
                        min={0}
                        value={draftKpi[stage] ?? '0'}
                        onChange={(e) => updateKpiDraft(stage, e.target.value)}
                        onBlur={() => void handleKpiBlur(stage)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="w-14 text-center text-[11px] border border-[#e2e6ea] rounded px-0.5 py-0.5 focus:border-[#1DB87A] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    ) : (
                      <span className="text-[#9aa5b4] font-semibold">{totals[si].kpi || '—'}</span>
                    )}
                  </td>
                ))}
              </tr>

              <tr className="bg-[#fafbfc] border-t border-[#e8ecf0]">
                <td className="py-2 px-3 text-[10px] font-semibold text-[#5a6a7e]">Tổng tháng (Act/KPI)</td>
                {FUNNEL_STAGES.map((stage, si) => (
                  <td
                    key={`${stage}-total`}
                    className={`py-2 px-3 text-center font-semibold border-l border-[#f0f2f5] ${numCls(totals[si].kpi, totals[si].actual)}`}
                  >
                    {totals[si].actual || '—'}
                    <span className="text-[#bbb] text-[10px] mx-1">/</span>
                    <span className="text-[#9aa5b4]">{totals[si].kpi || '—'}</span>
                  </td>
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

        {/* Candidate list */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa5b4] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Ứng viên ({pos.candidates.length})
            </p>
          </div>
          {pos.candidates.length === 0 ? (
            <p className="text-[11px] text-[#bbb] italic text-center py-4">
              Chưa có ứng viên nào cho vị trí này.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#f0f2f5]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#fafbfc] border-b border-[#f0f2f5]">
                    <th className="text-left px-3 py-2 text-[9.5px] font-medium text-[#9aa5b4] uppercase tracking-wide">
                      Họ tên
                    </th>
                    <th className="text-center px-3 py-2 text-[9.5px] font-medium text-[#9aa5b4] uppercase tracking-wide">
                      Stage
                    </th>
                    <th className="text-center px-3 py-2 text-[9.5px] font-medium text-[#9aa5b4] uppercase tracking-wide">
                      Nguồn
                    </th>
                    <th className="text-center px-3 py-2 text-[9.5px] font-medium text-[#9aa5b4] uppercase tracking-wide">
                      Apply
                    </th>
                    <th className="text-center px-3 py-2 text-[9.5px] font-medium text-[#9aa5b4] uppercase tracking-wide w-[60px]">
                      Chi tiết
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pos.candidates.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[#f8f9fb] last:border-b-0 hover:bg-[#fafbfc] cursor-pointer transition-colors"
                      onClick={() => onCandidateClick(c)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1DB87A] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(c.fullName)}
                          </div>
                          <div>
                            <p className="font-medium text-[#1a2332] text-[11.5px]">{c.fullName}</p>
                            {c.email && (
                              <p className="text-[9.5px] text-[#9aa5b4] truncate max-w-[160px]">
                                {c.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StageBadge stage={c.currentStage} />
                      </td>
                      <td className="px-3 py-2 text-center text-[10.5px] text-[#5a6a7e]">
                        {SOURCE_LABELS[c.source] ?? c.source}
                      </td>
                      <td className="px-3 py-2 text-center text-[10.5px] text-[#9aa5b4]">
                        {c.appliedAt || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          className="w-6 h-6 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-blue-50 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center transition-colors mx-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCandidateClick(c);
                          }}
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
  filterWeek,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
  onStageChange,
  onOpenNote,
}: {
  position: Position;
  filterWeek: 0 | 1 | 2 | 3 | 4;
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
  onStageChange: (id: string, stage: CandidateStage) => void | Promise<void>;
  onOpenNote: (p: Position) => void;
}) {
  const [stagePopoverOpen, setStagePopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [notePopoverOpen, setNotePopoverOpen] = useState(false);
  const notePreviewText = htmlToMultilineText(position.note || '');
  const notePreviewContent = notePreviewText || 'Chưa Có Ghi Chú.';
  // Show KPI/Actual for the selected week or sum of all weeks
  const weekIdx = filterWeek - 1;
  const stageActuals = FUNNEL_STAGES.map((stage) => {
    const d = position.weekly.find((w) => w.stage === stage);
    if (!d) return 0;
    return filterWeek === 0 ? sumArr(d.actual) : (d.actual[weekIdx] ?? 0);
  });
  const stageKpis = FUNNEL_STAGES.map((stage) => {
    const d = position.weekly.find((w) => w.stage === stage);
    if (!d) return 0;
    // KPI month is stored on W1, so keep KPI fixed to W1 when filtering W1..W4
    return filterWeek === 0 ? sumArr(d.kpi) : (d.kpi[0] ?? 0);
  });

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
        {canEdit ? (
          <Popover open={stagePopoverOpen} onOpenChange={setStagePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border border-transparent hover:border-[#dbe3ea]"
                style={{
                  background: STAGE_CONFIG[position.currentStage].bg,
                  color: STAGE_CONFIG[position.currentStage].text,
                }}
                title="Đổi stage"
              >
                {STAGE_CONFIG[position.currentStage].label}
                <ChevronsUpDown className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-[220px] p-2">
              <div className="text-[10px] font-semibold text-[#9aa5b4] px-1.5 pb-1">Chọn Stage</div>
              <div className="space-y-1">
                {POSITION_STAGE_OPTIONS.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md hover:bg-[#f3f6fa]"
                    onClick={() => {
                      void onStageChange(position.id, stage);
                      setStagePopoverOpen(false);
                    }}
                  >
                    <span className="text-[11px]" style={{ color: STAGE_CONFIG[stage].text }}>
                      {STAGE_CONFIG[stage].label}
                    </span>
                    {position.currentStage === stage ? <Check className="w-3.5 h-3.5 text-[#1DB87A]" /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
            style={{
              background: STAGE_CONFIG[position.currentStage].bg,
              color: STAGE_CONFIG[position.currentStage].text,
            }}
          >
            {STAGE_CONFIG[position.currentStage].label}
          </span>
        )}
      </td>
      {/* KPI / Actual per stage — read-only, click opens Weekly KPI modal */}
      {FUNNEL_STAGES.map((stage, si) => (
        <td key={stage} className="py-2 px-1 text-center text-[11.5px]">
          <div
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 cursor-pointer hover:bg-[#f0f9f5]"
            onClick={() => onWeeklyKpiClick(position)}
            title="Xem & chỉnh sửa KPI theo tháng"
          >
            <span className={numCls(stageKpis[si], stageActuals[si])}>
              {stageActuals[si] || '—'}
            </span>
            <span className="text-[#bbb] text-[10px]">/</span>
            <span className="text-[#bbb] text-[10px]">{stageKpis[si] || '—'}</span>
          </div>
        </td>
      ))}
      {/* Status — select only */}
      <td className="py-2 px-3">
        {canEdit ? (
          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border border-transparent hover:border-[#dbe3ea]"
                style={{
                  background: STATUS_CONFIG[position.status].bg,
                  color: STATUS_CONFIG[position.status].text,
                }}
                title="Đổi status"
              >
                {STATUS_CONFIG[position.status].label}
                <ChevronsUpDown className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-[220px] p-2">
              <div className="text-[10px] font-semibold text-[#9aa5b4] px-1.5 pb-1">Chọn Status</div>
              <div className="space-y-1">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md hover:bg-[#f3f6fa]"
                    onClick={() => {
                      void onStatusChange(position.id, s);
                      setStatusPopoverOpen(false);
                    }}
                  >
                    <span className="text-[11px]" style={{ color: STATUS_CONFIG[s].text }}>
                      {STATUS_CONFIG[s].label}
                    </span>
                    {position.status === s ? <Check className="w-3.5 h-3.5 text-[#1DB87A]" /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className="text-[10px] text-[#9aa5b4]">{STATUS_CONFIG[position.status].label}</span>
        )}
      </td>
      {/* Quick actions: Note + Weekly KPI */}
      <td className="py-2 px-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <Popover open={notePopoverOpen} onOpenChange={setNotePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-7 h-7 rounded border bg-white hover:bg-amber-50 flex items-center justify-center transition-colors"
                style={{
                  borderColor: position.note ? '#fde68a' : '#e2e6ea',
                  color: position.note ? '#d97706' : '#9ca3af',
                }}
                onMouseEnter={() => setNotePopoverOpen(true)}
                onMouseLeave={() => setNotePopoverOpen(false)}
                onClick={() => {
                  setNotePopoverOpen(false);
                  onOpenNote(position);
                }}
                title={canEdit ? 'Ghi chú' : 'Xem ghi chú'}
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="left"
              align="center"
              sideOffset={8}
              className="w-[280px] p-3"
              onMouseEnter={() => setNotePopoverOpen(true)}
              onMouseLeave={() => setNotePopoverOpen(false)}
            >
              <div className="space-y-1.5 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa5b4]">
                  Ghi chú
                </p>
                <p className="text-[12px] leading-5 text-[#334155] whitespace-pre-wrap break-words">
                  {notePreviewContent}
                </p>
              </div>
            </PopoverContent>
          </Popover>
          <button
            className="w-7 h-7 rounded border border-[#e2e6ea] bg-white text-[#5a6a7e] hover:bg-blue-50 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center transition-colors"
            onClick={() => onWeeklyKpiClick(position)}
            title="Xem chi tiết KPI tháng"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
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
  filterWeek,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
  onStageChange,
  onOpenNote,
}: {
  positions: Position[];
  filterWeek: 0 | 1 | 2 | 3 | 4;
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
  onStageChange: (id: string, stage: CandidateStage) => void | Promise<void>;
  onOpenNote: (p: Position) => void;
}) {
  const weekLabel = filterWeek === 0 ? 'Tổng' : `W${filterWeek}`;
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
                <div>{STAGE_CONFIG[stage].short === 'Applied' ? 'Applied' : STAGE_CONFIG[stage].label}</div>
                <div className="text-[8.5px] font-normal normal-case tracking-normal text-[#c0c8d2] mt-0.5">
                  {weekLabel}: Act / KPI
                </div>
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
                filterWeek={filterWeek}
                canEdit={canEdit}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddCandidate={onAddCandidate}
                onCandidateClick={onCandidateClick}
                onWeeklyKpiClick={onWeeklyKpiClick}
                onStageChange={onStageChange}
                onOpenNote={onOpenNote}
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
  canEdit,
  onCandidateClick,
  onStageDrop,
}: {
  positions: Position[];
  canEdit: boolean;
  onCandidateClick: (c: Candidate) => void;
  onStageDrop: (candidateId: string, stage: CandidateStage) => void | Promise<void>;
}) {
  const [dragOverStage, setDragOverStage] = useState<CandidateStage | null>(null);
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
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {columns.map((stage) => {
        const cands = allCandidates.filter((c) => c.currentStage === stage);
        const cfg = STAGE_CONFIG[stage];
        return (
          <div key={stage} className="flex-1 min-w-[170px]">
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
            <div
              className={`space-y-2 min-h-[200px] rounded-b-lg transition-colors ${
                dragOverStage === stage ? 'bg-[#ecfdf5]' : ''
              }`}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverStage !== stage) setDragOverStage(stage);
              }}
              onDragLeave={() => {
                if (dragOverStage === stage) setDragOverStage(null);
              }}
              onDrop={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setDragOverStage(null);
                const candidateId = e.dataTransfer.getData('text/plain');
                const fromStage = e.dataTransfer.getData('application/x-stage') as CandidateStage;
                if (!candidateId || !fromStage || fromStage === stage) return;
                void onStageDrop(candidateId, stage);
              }}
            >
              {cands.map((c) => {
                const pos = positions.find((p) => p.id === c.positionId);
                return (
                  <div
                    key={c.id}
                    className="bg-white border border-[#e2ede9] rounded-lg p-2.5 cursor-pointer hover:border-[#1DB87A] hover:shadow-sm transition-all"
                    draggable={canEdit}
                    onDragStart={(e) => {
                      if (!canEdit) return;
                      e.dataTransfer.setData('text/plain', c.id);
                      e.dataTransfer.setData('application/x-stage', c.currentStage);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDragOverStage(null)}
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
    requestDate: editing?.requestDate ?? '',
    onboardDeadline: editing?.onboardDeadline ?? '',
    descriptionSkills: editing?.descriptionSkills ?? '',
    salaryRangeUsd: editing?.salaryRangeUsd ?? '',
    mainSkills: editing?.mainSkills ?? '',
    jdDetails: editing?.jdDetails ?? '',
    cvSource: editing?.cvSource ?? '',
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
      requestDate: editing?.requestDate ?? '',
      onboardDeadline: editing?.onboardDeadline ?? '',
      descriptionSkills: editing?.descriptionSkills ?? '',
      salaryRangeUsd: editing?.salaryRangeUsd ?? '',
      mainSkills: editing?.mainSkills ?? '',
      jdDetails: editing?.jdDetails ?? '',
      cvSource: editing?.cvSource ?? '',
      note: editing?.note ?? '',
      blocker: editing?.blocker ?? '',
    });
  }, [editing]);

  // Reset on open/edit mode change
  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

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
              <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
                Request Date
              </label>
              <DatePicker
                value={form.requestDate}
                onChange={(v) => setForm((f) => ({ ...f, requestDate: v }))}
                placeholder="Chọn ngày request"
                captionLayout="dropdown"
                fromYear={new Date().getFullYear() - 2}
                toYear={new Date().getFullYear() + 5}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Onboard</label>
              <DatePicker
                value={form.onboardDeadline}
                onChange={(v) => setForm((f) => ({ ...f, onboardDeadline: v }))}
                placeholder="Chọn deadline onboard"
                captionLayout="dropdown"
                fromYear={new Date().getFullYear() - 2}
                toYear={new Date().getFullYear() + 5}
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
                Salary Range (USD)
              </label>
              <Input
                placeholder="VD: 1500 - 2500"
                value={form.salaryRangeUsd}
                onChange={(e) => setForm((f) => ({ ...f, salaryRangeUsd: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
                Main skills
              </label>
              <Input
                placeholder="VD: React, TypeScript, Node.js"
                value={form.mainSkills}
                onChange={(e) => setForm((f) => ({ ...f, mainSkills: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">JD Details</label>
              <Input
                placeholder="Link JD"
                value={form.jdDetails}
                onChange={(e) => setForm((f) => ({ ...f, jdDetails: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">NguồnCV</label>
              <Input
                placeholder="VD: LinkedIn, ITviec, Referral..."
                value={form.cvSource}
                onChange={(e) => setForm((f) => ({ ...f, cvSource: e.target.value }))}
              />
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
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">
              Description/Skills
            </label>
            <Textarea
              rows={2}
              value={form.descriptionSkills}
              onChange={(e) => setForm((f) => ({ ...f, descriptionSkills: e.target.value }))}
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
const CV_ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.doc,.docx';
const CV_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  onSave: (data: Partial<Candidate>, files: File[]) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cvFiles, setCvFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    fullName: editing?.fullName ?? '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    source: (editing?.source ?? 'LINKEDIN') as CandidateSource,
    currentStage: (editing?.currentStage ?? 'APPLIED') as CandidateStage,
    note: editing?.note ?? '',
    appliedAt: editing?.appliedAt ?? '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        fullName: editing?.fullName ?? '',
        email: editing?.email ?? '',
        phone: editing?.phone ?? '',
        source: (editing?.source ?? 'LINKEDIN') as CandidateSource,
        currentStage: (editing?.currentStage ?? 'APPLIED') as CandidateStage,
        note: editing?.note ?? '',
        appliedAt: editing?.appliedAt ?? '',
      });
      setCvFiles([]);
    }
  }, [open, editing]);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.size > CV_MAX_SIZE) {
        toast.error(`${f.name} vượt quá 10MB`);
        continue;
      }
      valid.push(f);
    }
    setCvFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error('Vui lòng nhập họ tên ứng viên');
      return;
    }
    onSave({ ...form, positionId }, cvFiles);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Số điện thoại</label>
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
            <label className="text-[11px] font-medium text-[#5a6a7e] block mb-1">Applied Date</label>
            <DatePicker
              value={form.appliedAt}
              onChange={(v) => setForm((f) => ({ ...f, appliedAt: v ?? '' }))}
              placeholder="Chọn ngày ứng tuyển"
              className="h-9 text-xs w-full"
            />
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

          {/* CV Upload */}
          <div>
            <label className="text-[11px] font-medium text-[#5a6a7e] flex items-center gap-1.5 mb-1.5">
              <Upload className="w-3 h-3" />
              File đính kèm (CV)
            </label>
            {/* Drop zone */}
            <div
              className="rounded-lg p-4 text-center cursor-pointer transition-all border-2 border-dashed"
              style={{
                borderColor: dragging ? '#1DB87A' : '#D3F2E7',
                background: dragging ? '#f0f9f5' : '#fafffe',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <CloudUpload className="w-6 h-6 mx-auto mb-1.5" style={{ color: '#1DB87A' }} />
              <p className="text-[11.5px] font-medium text-[#203430]">
                Nhấp để chọn hoặc kéo thả file vào đây
              </p>
              <p className="text-[10px] mt-0.5 text-[#9aa5b4]">
                PDF, DOC, DOCX, JPG, JPEG, PNG, HEIC · Tối đa 10MB/file · Nhiều file
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={CV_ACCEPT}
              multiple
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
            />
            {/* File list */}
            {cvFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {cvFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#D3F2E7] bg-[#f0f9f5]"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1DB87A] flex-shrink-0" />
                    <span className="text-[11px] font-medium text-[#203430] flex-1 truncate">
                      {f.name}
                    </span>
                    <span className="text-[10px] text-[#9aa5b4] flex-shrink-0">
                      {formatFileSize(f.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCvFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-[#9aa5b4] hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

        {candidate.cvUrls.length > 0 && (
          <div className="rounded-lg border border-[#D3F2E7] bg-[#f0f9f5] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5a6a7e] mb-2">
              Files đã upload ({candidate.cvUrls.length})
            </p>
            <div className="space-y-1.5">
              {candidate.cvUrls.map((fileUrl, idx) => {
                const normalizedUrl = normalizeCandidateFileUrl(fileUrl);
                return (
                  <a
                    key={`${fileUrl}-${idx}`}
                    href={normalizedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border border-[#D3F2E7] bg-white px-2.5 py-2 text-[11px] text-[#203430] hover:border-[#1DB87A] hover:bg-[#f9fffc] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1DB87A] flex-shrink-0" />
                    <span className="flex-1 truncate">{getFilenameFromUrl(normalizedUrl)}</span>
                    <Download className="w-3.5 h-3.5 text-[#9aa5b4] flex-shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

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
  filterWeek,
  canEdit,
  onStatusChange,
  onEdit,
  onDelete,
  onAddCandidate,
  onCandidateClick,
  onWeeklyKpiClick,
  onStageChange,
  onOpenNote,
  onAddHighlight,
  onAddBlocker,
  onDeleteInsight,
}: {
  positions: Position[];
  filterWeek: 0 | 1 | 2 | 3 | 4;
  canEdit: boolean;
  onStatusChange: (id: string, status: RecruitmentStatus) => void | Promise<void>;
  onEdit: (p: Position) => void;
  onDelete: (id: string) => void | Promise<void>;
  onAddCandidate: (p: Position) => void;
  onCandidateClick: (c: Candidate) => void;
  onWeeklyKpiClick: (p: Position) => void;
  onStageChange: (id: string, stage: CandidateStage) => void | Promise<void>;
  onOpenNote: (p: Position) => void;
  onAddHighlight: () => void;
  onAddBlocker: () => void;
  onDeleteInsight?: (id: string) => void | Promise<void>;
}) {
  const atRiskCount = positions.filter((p) => p.insights.some((i) => i.type === 'BLOCKER')).length;
  return (
    <div className="space-y-3.5">
      {/* Status strip */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Tổng', count: positions.length, dot: '#9aa5b4' },
          { label: 'On Track', count: Math.max(0, positions.length - atRiskCount), dot: '#22c55e' },
          { label: 'At Risk', count: atRiskCount, dot: '#ef4444' },
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
          filterWeek={filterWeek}
          canEdit={canEdit}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddCandidate={onAddCandidate}
          onCandidateClick={onCandidateClick}
          onWeeklyKpiClick={onWeeklyKpiClick}
          onStageChange={onStageChange}
          onOpenNote={onOpenNote}
        />
      </div>
      <HBCard
        positions={positions}
        canEdit={canEdit}
        onAddHighlight={onAddHighlight}
        onAddBlocker={onAddBlocker}
        onDeleteInsight={onDeleteInsight}
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
  const [selectedStatuses, setSelectedStatuses] = useState<RecruitmentStatus[]>(DEFAULT_STATUS_FILTERS);
  const [filterWeek, setFilterWeek] = useState<0 | 1 | 2 | 3 | 4>(0);

  const selectedStatusLabel = useMemo(() => {
    const count = selectedStatuses.length;
    if (count === 0) return 'No status';
    if (count === STATUS_OPTIONS.length) return 'All status';
    if (count === 1) return STATUS_CONFIG[selectedStatuses[0]].label;
    return `${count} status`;
  }, [selectedStatuses]);

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
  const [notePosition, setNotePosition] = useState<Position | null>(null);
  const [noteEditorValue, setNoteEditorValue] = useState('');
  const [isSavingPositionNote, setIsSavingPositionNote] = useState(false);
  const [candidateDetail, setCandidateDetail] = useState<Candidate | null>(null);
  const [weeklyKpiModal, setWeeklyKpiModal] = useState<Position | null>(null);
  const [insightDialog, setInsightDialog] = useState<{ open: boolean; kind: InsightType }>({
    open: false,
    kind: 'HIGHLIGHT',
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

  // Sync open modals khi positions được reload
  useEffect(() => {
    if (weeklyKpiModal) {
      const fresh = positions.find((p) => p.id === weeklyKpiModal.id);
      if (fresh) setWeeklyKpiModal(fresh);
    }
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (candidateDetail) {
      const freshPos = positions.find((p) => p.id === candidateDetail.positionId);
      const fresh = freshPos?.candidates.find((c) => c.id === candidateDetail.id);
      if (fresh) setCandidateDetail(fresh);
    }
  }, [positions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered positions
  const filtered = useMemo(() => {
    return positions.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.domain.toLowerCase().includes(search.toLowerCase());
      const matchDomain = filterDomain === 'ALL' || p.domain === filterDomain;
      const matchStatus = selectedStatuses.includes(p.status);
      return matchSearch && matchDomain && matchStatus;
    });
  }, [positions, search, filterDomain, selectedStatuses]);

  // KPI aggregates
  const kpi = useMemo(() => {
    const weekIdx = filterWeek - 1;
    const stageActuals = FUNNEL_STAGES.map((stage) =>
      filtered.reduce((sum, p) => {
        const stageData = p.weekly.find((w) => w.stage === stage);
        if (!stageData) return sum;
        const val = filterWeek === 0 ? sumArr(stageData.actual) : (stageData.actual[weekIdx] ?? 0);
        return sum + val;
      }, 0),
    );
    return {
      applied: stageActuals[0] ?? 0,
      hrScreen: stageActuals[1] ?? 0,
      leaderRound: stageActuals[2] ?? 0,
      ceoRound: stageActuals[3] ?? 0,
      offerHired: filtered.filter((p) => p.status === 'OFFER_SENT' || p.status === 'HIRED').length,
      atRisk: filtered.filter((p) => p.insights.some((i) => i.type === 'BLOCKER')).length,
    };
  }, [filtered, filterWeek]);

  const appliedKpiTotal = useMemo(() => {
    return filtered.reduce((sum, p) => {
      const stageData = p.weekly.find((w) => w.stage === 'APPLIED');
      if (!stageData) return sum;
      // Weekly view keeps KPI fixed to W1 by design.
      return sum + (filterWeek === 0 ? sumArr(stageData.kpi) : (stageData.kpi[0] ?? 0));
    }, 0);
  }, [filtered, filterWeek]);

  const blockers = filtered.flatMap((p) =>
    p.insights
      .filter((i) => i.type === 'BLOCKER')
      .map((i) => ({
        id: i.id,
        title: p.title,
        text: htmlToPlainText(i.content) || '—',
      })),
  );

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

  const handlePositionStageChange = useCallback(
    async (id: string, stage: CandidateStage) => {
      setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, currentStage: stage } : p)));
      try {
        await apiClient.patch(`/api/recruitment/positions/${id}`, { currentStage: stage });
        toast.success(`Đã cập nhật Stage: ${STAGE_CONFIG[stage].label}`);
      } catch (err: unknown) {
        void fetchPositions(curYear, curMonth);
        toast.error(err instanceof Error ? err.message : 'Cập nhật Stage thất bại');
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
    async (data: Partial<Candidate>, files: File[]) => {
      try {
        let candidateId: string | null = null;

        if (candidateDialog.editing) {
          await apiClient.patch(`/api/recruitment/candidates/${candidateDialog.editing.id}`, data);
          candidateId = candidateDialog.editing.id;
          toast.success('Đã cập nhật ứng viên');
        } else {
          const posId = candidateDialog.position?.id;
          if (!posId) return;
          const res = await apiClient.post<{ id: string }>(
            `/api/recruitment/positions/${posId}/candidates`,
            data,
          );
          candidateId = res.data?.id ?? null;
          toast.success('Đã thêm ứng viên');
        }

        // Upload CV files if any
        if (candidateId && files.length > 0) {
          const formData = new FormData();
          files.forEach((f) => formData.append('cv', f));
          await apiClient.post(`/api/recruitment/candidates/${candidateId}/cv`, formData, {
            headers: { 'Content-Type': undefined }, // let browser set multipart/form-data with boundary
          });
        }

        setCandidateDialog({ open: false, editing: null, position: null });
        void fetchPositions(curYear, curMonth);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
      }
    },
    [candidateDialog, curYear, curMonth, fetchPositions],
  );

  const handleMonthlyKpiSave = useCallback(
    async (positionId: string, stage: CandidateStage, kpi: number) => {
      // Optimistic update
      setPositions((prev) =>
        prev.map((p) => {
          if (p.id !== positionId) return p;
          return {
            ...p,
            weekly: p.weekly.map((w) => {
              if (w.stage !== stage) return w;
              return { ...w, kpi: [kpi, 0, 0, 0] };
            }),
          };
        }),
      );
      try {
        await Promise.all(
          [1, 2, 3, 4].map((week) =>
            apiClient.put(
              `/api/recruitment/positions/${positionId}/weekly?year=${curYear}&month=${curMonth + 1}`,
              { week, stage, kpiTarget: week === 1 ? kpi : 0 },
            ),
          ),
        );
      } catch (err: unknown) {
        void fetchPositions(curYear, curMonth);
        toast.error(err instanceof Error ? err.message : 'Lưu KPI thất bại');
      }
    },
    [curYear, curMonth, fetchPositions],
  );

  const handleWeeklyActualSave = useCallback(
    async (positionId: string, week: number, stage: CandidateStage, actual: number) => {
      const weekIdx = week - 1;
      setPositions((prev) =>
        prev.map((p) => {
          if (p.id !== positionId) return p;
          return {
            ...p,
            weekly: p.weekly.map((w) => {
              if (w.stage !== stage) return w;
              const newActual = [...w.actual] as [number, number, number, number];
              newActual[weekIdx] = actual;
              return { ...w, actual: newActual };
            }),
          };
        }),
      );
      try {
        await apiClient.put(
          `/api/recruitment/positions/${positionId}/weekly?year=${curYear}&month=${curMonth + 1}`,
          { week, stage, actual },
        );
      } catch (err: unknown) {
        void fetchPositions(curYear, curMonth);
        toast.error(err instanceof Error ? err.message : 'Lưu Actual thất bại');
      }
    },
    [curYear, curMonth, fetchPositions],
  );

  const handleSaveInsight = useCallback(
    async ({ positionId, content, type }: { positionId: string; content: string; type: InsightType }) => {
      try {
        await apiClient.post(`/api/recruitment/positions/${positionId}/insights`, { type, content });
        toast.success(type === 'BLOCKER' ? 'Đã thêm blocker' : 'Đã thêm highlight');
        setInsightDialog({ open: false, kind: 'HIGHLIGHT' });
        void fetchPositions(curYear, curMonth);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lưu thất bại');
      }
    },
    [curYear, curMonth, fetchPositions],
  );

  const handleDeleteInsight = useCallback(
    async (insightId: string) => {
      try {
        await apiClient.delete(`/api/recruitment/insights/${insightId}`);
        setPositions((prev) =>
          prev.map((p) => ({ ...p, insights: p.insights.filter((i) => i.id !== insightId) })),
        );
        toast.success('Đã xoá');
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Không thể xoá');
      }
    },
    [],
  );

  const openPositionNoteDialog = useCallback((position: Position) => {
    setNotePosition(position);
    setNoteEditorValue(position.note ?? '');
  }, []);

  const handleSavePositionNote = useCallback(async () => {
    if (!notePosition || !canEdit) return;
    setIsSavingPositionNote(true);
    try {
      await apiClient.patch(`/api/recruitment/positions/${notePosition.id}`, {
        note: noteEditorValue,
      });
      setPositions((prev) =>
        prev.map((p) => (p.id === notePosition.id ? { ...p, note: noteEditorValue } : p)),
      );
      setNotePosition((prev) => (prev ? { ...prev, note: noteEditorValue } : prev));
      toast.success('Đã lưu ghi chú');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể lưu ghi chú');
    } finally {
      setIsSavingPositionNote(false);
    }
  }, [notePosition, noteEditorValue, canEdit]);

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
        <div className="grid grid-cols-4 gap-2.5">
          <KpiCard
            label="Total Applied"
            value={kpi.applied}
            sub={`KPI: ${appliedKpiTotal}`}
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
        </div>

        {/* Blocker banner */}
        {blockers.length > 0 && (
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg px-4 py-2.5 flex items-start gap-2.5 text-[11px] text-[#92400E]">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
                  {blockers.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && <span className="mx-2 text-[#FCA5A5]">·</span>}
                      <strong>{p.title}</strong>: {p.text}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-[12px] min-w-[150px] justify-between">
                <span className="truncate">Status: {selectedStatusLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-xs">Filter status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={selectedStatuses.includes(s)}
                  onCheckedChange={(checked) => {
                    const isChecked = checked === true;
                    setSelectedStatuses((prev) => {
                      if (isChecked) return prev.includes(s) ? prev : [...prev, s];
                      return prev.filter((v) => v !== s);
                    });
                  }}
                  className="text-xs"
                >
                  {STATUS_CONFIG[s].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Week filter */}
          <div className="flex items-center gap-1 bg-[#f0f2f5] p-[3px] rounded-[8px]">
            {([0, 1, 2, 3, 4] as const).map((w) => (
              <button
                key={w}
                onClick={() => setFilterWeek(w)}
                className={`text-[11px] px-2.5 py-[4px] rounded-[6px] cursor-pointer transition-all ${
                  filterWeek === w
                    ? 'bg-white text-[#1DB87A] font-medium shadow-sm'
                    : 'text-[#5a6a7e] hover:text-[#1a2332]'
                }`}
              >
                {w === 0 ? 'All' : `W${w}`}
              </button>
            ))}
          </div>
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
                    {filterWeek > 0 && (
                      <span className="text-[10px] font-normal text-[#1DB87A] bg-[#ecfdf5] px-1.5 py-0.5 rounded ml-1">
                        W{filterWeek}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#9aa5b4]">
                    Click ô KPI/Actual để mở Monthly KPI Modal
                  </span>
                </div>
                <PositionsTable
                  positions={filtered}
                  filterWeek={filterWeek}
                  canEdit={canEdit}
                  onStatusChange={handleStatusChange}
                  onStageChange={handlePositionStageChange}
                  onEdit={(p) => setPositionDialog({ open: true, editing: p })}
                  onDelete={handleDeletePosition}
                  onAddCandidate={(p) =>
                    setCandidateDialog({ open: true, editing: null, position: p })
                  }
                  onCandidateClick={setCandidateDetail}
                  onWeeklyKpiClick={setWeeklyKpiModal}
                  onOpenNote={openPositionNoteDialog}
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
              onAddHighlight={() => setInsightDialog({ open: true, kind: 'HIGHLIGHT' })}
              onAddBlocker={() => setInsightDialog({ open: true, kind: 'BLOCKER' })}
              onDeleteInsight={handleDeleteInsight}
            />
          </div>
        )}

        {activeView === 'tracker' && (
          <MonthlyTrackerView
            positions={filtered}
            filterWeek={filterWeek}
            canEdit={canEdit}
            onStatusChange={handleStatusChange}
            onStageChange={handlePositionStageChange}
            onEdit={(p) => setPositionDialog({ open: true, editing: p })}
            onDelete={handleDeletePosition}
            onAddCandidate={(p) => setCandidateDialog({ open: true, editing: null, position: p })}
            onCandidateClick={setCandidateDetail}
            onWeeklyKpiClick={setWeeklyKpiModal}
            onOpenNote={openPositionNoteDialog}
            onAddHighlight={() => setInsightDialog({ open: true, kind: 'HIGHLIGHT' })}
            onAddBlocker={() => setInsightDialog({ open: true, kind: 'BLOCKER' })}
            onDeleteInsight={handleDeleteInsight}
          />
        )}

        {activeView === 'pipeline' && (
          <div className="space-y-3.5">
            <div className="bg-white rounded-xl border border-[#e8ecf0] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f0f2f5]">
                <span className="text-[12.5px] font-semibold text-[#1a2332] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#9aa5b4]" />
                  Pipeline — Tất cả ứng viên
                </span>
              </div>
              <div className="p-4">
                <PipelineView
                  positions={filtered}
                  canEdit={canEdit}
                  onCandidateClick={setCandidateDetail}
                  onStageDrop={handleStageChange}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <WeeklyKpiModal
        position={weeklyKpiModal}
        canEdit={canEdit}
        onClose={() => setWeeklyKpiModal(null)}
        onCandidateClick={setCandidateDetail}
        onSaveKpi={handleMonthlyKpiSave}
        onSaveActual={handleWeeklyActualSave}
      />
      <InsightDialog
        open={insightDialog.open}
        kind={insightDialog.kind}
        positions={filtered}
        onClose={() => setInsightDialog({ open: false, kind: 'HIGHLIGHT' })}
        onSave={handleSaveInsight}
      />
      <Dialog open={Boolean(notePosition)} onOpenChange={(open) => !open && setNotePosition(null)}>
        {notePosition && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                Ghi chú
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-[11px] text-[#7b8797]">
                {notePosition.title} · {notePosition.domain} · {notePosition.level}
              </p>
              {!canEdit && !noteEditorValue && (
                <p className="text-sm italic text-[#b0c8bf]">Chưa có ghi chú nào.</p>
              )}
              <TiptapNotionEditor
                value={noteEditorValue}
                onChange={setNoteEditorValue}
                placeholder="Thêm ghi chú cho vị trí này..."
                readOnly={!canEdit}
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#9aa5b4]">
                  {canEdit ? 'Ghi chú nội bộ cho từng vị trí tuyển dụng.' : 'Bạn chỉ có quyền xem ghi chú này.'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setNotePosition(null)}>
                    {canEdit ? 'Hủy' : 'Đóng'}
                  </Button>
                  {canEdit && (
                    <Button size="sm" onClick={() => void handleSavePositionNote()} disabled={isSavingPositionNote}>
                      {isSavingPositionNote ? 'Đang lưu...' : 'Lưu ghi chú'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
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
