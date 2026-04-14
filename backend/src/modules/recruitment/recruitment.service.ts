import prisma from '../../config/prisma';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import {
  CreatePositionDto,
  UpdatePositionDto,
  GetPositionsQuery,
  CreateCandidateDto,
  UpdateCandidateDto,
  UpdateStageDto,
  UpsertWeeklyKpiDto,
  CreateInsightDto,
  VALID_STATUSES,
  VALID_STAGES,
  VALID_INSIGHT_TYPES,
} from './recruitment.types';

// ─── Helpers ─────────────────────────────────────────────────

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  ) as T;
}

function normalizeText(value?: string): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const CANDIDATE_SELECT = {
  id: true,
  positionId: true,
  fullName: true,
  email: true,
  phone: true,
  source: true,
  currentStage: true,
  cvUrl: true,
  note: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
};

const POSITION_SELECT = {
  id: true,
  title: true,
  currentStage: true,
  level: true,
  domain: true,
  priority: true,
  headcount: true,
  status: true,
  requestDate: true,
  onboardDeadline: true,
  descriptionSkills: true,
  salaryRangeUsd: true,
  mainSkills: true,
  jdDetails: true,
  cvSource: true,
  note: true,
  blocker: true,
  openedAt: true,
  closedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

const INSIGHT_SELECT = {
  id: true,
  positionId: true,
  type: true,
  content: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

// ─── Positions ────────────────────────────────────────────────

export async function listPositions(query: GetPositionsQuery) {
  const { page, limit, skip } = getPaginationParams(query as Record<string, unknown>);

  const where: Record<string, unknown> = {};
  if (query.domain) where.domain = query.domain;
  if (query.priority) where.priority = query.priority;
  if (query.status && VALID_STATUSES.includes(query.status as never)) {
    where.status = query.status;
  }
  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }

  const hasMonthFilter = Boolean(query.year && query.month);
  const candidatesWhere =
    hasMonthFilter
      ? {
          appliedAt: {
            gte: new Date(Date.UTC(Number(query.year), Number(query.month) - 1, 1)),
            lt: new Date(Date.UTC(Number(query.year), Number(query.month), 1)),
          },
        }
      : undefined;

  const [total, rows] = await Promise.all([
    prisma.jobPosition.count({ where }),
    prisma.jobPosition.findMany({
      where,
      select: {
        ...POSITION_SELECT,
        candidates: {
          where: candidatesWhere,
          select: CANDIDATE_SELECT,
          orderBy: { appliedAt: 'desc' },
        },
        weeklyStats: {
          where: hasMonthFilter ? { year: Number(query.year), month: Number(query.month) } : undefined,
          orderBy: [{ week: 'asc' }],
        },
        insights: {
          where: { type: { in: VALID_INSIGHT_TYPES } },
          select: INSIGHT_SELECT,
          orderBy: [{ createdAt: 'desc' }],
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: serializeBigInt(rows),
    meta: buildMeta(total, page, limit),
  };
}

export async function getPosition(id: bigint) {
  const pos = await prisma.jobPosition.findUnique({
    where: { id },
    select: {
      ...POSITION_SELECT,
      candidates: {
        select: CANDIDATE_SELECT,
        orderBy: { appliedAt: 'desc' },
      },
      weeklyStats: {
        orderBy: [{ year: 'asc' }, { month: 'asc' }, { week: 'asc' }],
      },
      insights: {
        where: { type: { in: VALID_INSIGHT_TYPES } },
        select: INSIGHT_SELECT,
        orderBy: [{ createdAt: 'desc' }],
      },
    },
  });
  if (!pos) return null;
  return serializeBigInt(pos);
}

export async function createPosition(dto: CreatePositionDto, createdById: bigint) {
  const createData: Record<string, unknown> = {
    title: dto.title.trim(),
    currentStage: dto.currentStage ?? 'APPLIED',
    level: dto.level?.trim() ?? '',
    domain: dto.domain?.trim() ?? '',
    priority: dto.priority ?? 'B',
    headcount: dto.headcount ?? 1,
    requestDate: dto.requestDate ? new Date(dto.requestDate) : null,
    onboardDeadline: dto.onboardDeadline ? new Date(dto.onboardDeadline) : null,
    descriptionSkills: normalizeText(dto.descriptionSkills),
    salaryRangeUsd: normalizeText(dto.salaryRangeUsd),
    mainSkills: normalizeText(dto.mainSkills),
    jdDetails: normalizeText(dto.jdDetails),
    cvSource: normalizeText(dto.cvSource),
    note: normalizeText(dto.note),
    blocker: normalizeText(dto.blocker),
    openedAt: dto.openedAt ? new Date(dto.openedAt) : new Date(),
    createdById,
  };

  const pos = await prisma.jobPosition.create({
    data: createData as never,
    select: POSITION_SELECT,
  });
  return serializeBigInt(pos);
}

export async function updatePosition(id: bigint, dto: UpdatePositionDto) {
  const updateData: Record<string, unknown> = {
    ...(dto.title !== undefined && { title: dto.title.trim() }),
    ...(dto.currentStage !== undefined && VALID_STAGES.includes(dto.currentStage) && {
      currentStage: dto.currentStage,
    }),
    ...(dto.level !== undefined && { level: dto.level.trim() }),
    ...(dto.domain !== undefined && { domain: dto.domain.trim() }),
    ...(dto.priority !== undefined && { priority: dto.priority }),
    ...(dto.headcount !== undefined && { headcount: dto.headcount }),
    ...(dto.requestDate !== undefined && {
      requestDate: dto.requestDate ? new Date(dto.requestDate) : null,
    }),
    ...(dto.onboardDeadline !== undefined && {
      onboardDeadline: dto.onboardDeadline ? new Date(dto.onboardDeadline) : null,
    }),
    ...(dto.descriptionSkills !== undefined && { descriptionSkills: normalizeText(dto.descriptionSkills) }),
    ...(dto.salaryRangeUsd !== undefined && { salaryRangeUsd: normalizeText(dto.salaryRangeUsd) }),
    ...(dto.mainSkills !== undefined && { mainSkills: normalizeText(dto.mainSkills) }),
    ...(dto.jdDetails !== undefined && { jdDetails: normalizeText(dto.jdDetails) }),
    ...(dto.cvSource !== undefined && { cvSource: normalizeText(dto.cvSource) }),
    ...(dto.status !== undefined && VALID_STATUSES.includes(dto.status) && { status: dto.status }),
    ...(dto.note !== undefined && { note: normalizeText(dto.note) }),
    ...(dto.blocker !== undefined && { blocker: normalizeText(dto.blocker) }),
    ...(dto.closedAt !== undefined && {
      closedAt: dto.closedAt ? new Date(dto.closedAt) : null,
    }),
  };

  const pos = await prisma.jobPosition.update({
    where: { id },
    data: updateData as never,
    select: POSITION_SELECT,
  });
  return serializeBigInt(pos);
}

export async function deletePosition(id: bigint) {
  await prisma.jobPosition.delete({ where: { id } });
}

// ─── Candidates ───────────────────────────────────────────────

export async function listCandidates(positionId: bigint) {
  const rows = await prisma.recruitmentCandidate.findMany({
    where: { positionId },
    select: {
      ...CANDIDATE_SELECT,
      stageHistory: {
        orderBy: { changedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          changedAt: true,
          note: true,
          changedBy: { select: { id: true, fullName: true } },
        },
      },
    },
    orderBy: { appliedAt: 'desc' },
  });
  return serializeBigInt(rows);
}

export async function getCandidate(id: bigint) {
  const cand = await prisma.recruitmentCandidate.findUnique({
    where: { id },
    select: {
      ...CANDIDATE_SELECT,
      position: { select: { id: true, title: true } },
      stageHistory: {
        orderBy: { changedAt: 'desc' },
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          changedAt: true,
          note: true,
          changedBy: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!cand) return null;
  return serializeBigInt(cand);
}

export async function createCandidate(positionId: bigint, dto: CreateCandidateDto) {
  const cand = await prisma.recruitmentCandidate.create({
    data: {
      positionId,
      fullName: dto.fullName.trim(),
      email: dto.email?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
      source: dto.source ?? 'OTHER',
      currentStage: dto.currentStage ?? 'APPLIED',
      note: dto.note?.trim() ?? null,
      ...(dto.appliedAt ? { appliedAt: new Date(dto.appliedAt) } : {}),
    },
    select: CANDIDATE_SELECT,
  });
  return serializeBigInt(cand);
}

export async function updateCandidate(id: bigint, dto: UpdateCandidateDto) {
  const cand = await prisma.recruitmentCandidate.update({
    where: { id },
    data: {
      ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
      ...(dto.email !== undefined && { email: dto.email?.trim() ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone?.trim() ?? null }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.currentStage !== undefined && VALID_STAGES.includes(dto.currentStage) && {
        currentStage: dto.currentStage,
      }),
      ...(dto.note !== undefined && { note: dto.note?.trim() ?? null }),
      ...(dto.cvUrl !== undefined && { cvUrl: dto.cvUrl }),
    },
    select: CANDIDATE_SELECT,
  });
  return serializeBigInt(cand);
}

export async function updateCandidateStage(
  id: bigint,
  dto: UpdateStageDto,
  changedById: bigint,
) {
  if (!VALID_STAGES.includes(dto.stage)) {
    throw new Error(`Invalid stage: ${dto.stage}`);
  }

  const existing = await prisma.recruitmentCandidate.findUnique({
    where: { id },
    select: { currentStage: true },
  });
  if (!existing) throw new Error('Candidate not found');

  const [cand] = await prisma.$transaction([
    prisma.recruitmentCandidate.update({
      where: { id },
      data: { currentStage: dto.stage },
      select: CANDIDATE_SELECT,
    }),
    prisma.candidateStageLog.create({
      data: {
        candidateId: id,
        fromStage: existing.currentStage,
        toStage: dto.stage,
        changedById,
        note: dto.note?.trim() ?? null,
      },
    }),
  ]);
  return serializeBigInt(cand);
}

export async function deleteCandidate(id: bigint) {
  await prisma.recruitmentCandidate.delete({ where: { id } });
}

export async function updateCandidateCv(id: bigint, cvUrl: string) {
  const cand = await prisma.recruitmentCandidate.update({
    where: { id },
    data: { cvUrl },
    select: CANDIDATE_SELECT,
  });
  return serializeBigInt(cand);
}

// ─── Weekly KPI ───────────────────────────────────────────────

export async function getWeeklyKpi(positionId: bigint, year: number, month: number) {
  const rows = await prisma.weeklyKpi.findMany({
    where: { positionId, year, month },
    orderBy: [{ stage: 'asc' }, { week: 'asc' }],
  });
  return serializeBigInt(rows);
}

export async function upsertWeeklyKpi(
  positionId: bigint,
  year: number,
  month: number,
  dto: UpsertWeeklyKpiDto,
) {
  const row = await prisma.weeklyKpi.upsert({
    where: {
      positionId_year_month_week_stage: {
        positionId,
        year,
        month,
        week: dto.week,
        stage: dto.stage,
      },
    },
    create: {
      positionId,
      year,
      month,
      week: dto.week,
      stage: dto.stage,
      kpiTarget: dto.kpiTarget ?? 0,
      actual: dto.actual ?? 0,
    },
    update: {
      ...(dto.kpiTarget !== undefined && { kpiTarget: dto.kpiTarget }),
      ...(dto.actual !== undefined && { actual: dto.actual }),
    },
  });
  return serializeBigInt(row);
}

// ─── Dashboard stats ──────────────────────────────────────────

export async function getDashboardStats(year: number, month: number) {
  const positions = await prisma.jobPosition.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      status: true,
      insights: {
        where: { type: 'BLOCKER' },
        select: { id: true },
      },
      candidates: {
        select: { currentStage: true },
      },
    },
  });

  const allCandidates = positions.flatMap((p) => p.candidates);

  const stats = {
    totalPositions: positions.length,
    applied:        allCandidates.length,
    hrScreen:       allCandidates.filter((c) => !['APPLIED', 'REJECTED'].includes(c.currentStage)).length,
    leaderRound:    allCandidates.filter((c) => ['LEADER_INTERVIEW', 'CEO_INTERVIEW', 'OFFER', 'HIRED'].includes(c.currentStage)).length,
    ceoRound:       allCandidates.filter((c) => ['CEO_INTERVIEW', 'OFFER', 'HIRED'].includes(c.currentStage)).length,
    offerHired:     positions.filter((p) => p.status === 'OFFER_SENT' || p.status === 'HIRED').length,
    atRisk:         positions.filter((p) => p.insights.length > 0).length,
  };

  return stats;
}

// ─── Highlights & Blockers ───────────────────────────────────

export async function createInsight(positionId: bigint, dto: CreateInsightDto, createdById: bigint) {
  const insight = await prisma.recruitmentInsight.create({
    data: {
      positionId,
      type: dto.type,
      content: dto.content.trim(),
      createdById,
    },
    select: INSIGHT_SELECT,
  });
  return serializeBigInt(insight);
}

export async function deleteInsight(id: bigint) {
  await prisma.recruitmentInsight.delete({ where: { id } });
}
