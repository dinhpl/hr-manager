import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { sendSuccess, sendError } from '../../utils/response';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';
import * as svc from './recruitment.service';
import type {
  CreatePositionDto,
  UpdatePositionDto,
  CreateCandidateDto,
  UpdateCandidateDto,
  UpdateStageDto,
  UpsertWeeklyKpiDto,
  RecruitmentStatus,
  CandidateStage,
} from './recruitment.types';
import { VALID_STATUSES, VALID_STAGES, VALID_PRIORITIES, VALID_SOURCES } from './recruitment.types';

// ─── Helpers ─────────────────────────────────────────────────

function parseBigInt(val: string | string[], res: Response): bigint | null {
  try {
    return BigInt(Array.isArray(val) ? val[0] : val);
  } catch {
    sendError(res, 'Invalid ID', 'INVALID_ID', 400);
    return null;
  }
}

// ─── Positions ────────────────────────────────────────────────

export async function getPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listPositions({
      year:     req.query.year   ? Number(req.query.year)   : undefined,
      month:    req.query.month  ? Number(req.query.month)  : undefined,
      domain:   req.query.domain  as string | undefined,
      priority: req.query.priority as string | undefined,
      status:   req.query.status   as string | undefined,
      search:   req.query.search   as string | undefined,
      page:     req.query.page  ? Number(req.query.page)  : 1,
      limit:    req.query.limit ? Number(req.query.limit) : 50,
    });
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getPositionById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.id, res);
    if (id === null) return;
    const pos = await svc.getPosition(id);
    if (!pos) return sendError(res, 'Position not found', 'NOT_FOUND', 404);
    sendSuccess(res, pos);
  } catch (err) {
    next(err);
  }
}

export async function postPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as CreatePositionDto;
    if (!body.title?.trim()) {
      return sendError(res, 'title is required', 'VALIDATION_ERROR', 400);
    }
    if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
      return sendError(res, `priority must be one of ${VALID_PRIORITIES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const pos = await svc.createPosition(body, req.user!.id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'RECRUITMENT',
      entityId: String(pos.id),
      entityName: pos.title,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, pos, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function patchPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.id, res);
    if (id === null) return;
    const body = req.body as UpdatePositionDto;
    if (body.status && !VALID_STATUSES.includes(body.status as RecruitmentStatus)) {
      return sendError(res, `status must be one of ${VALID_STATUSES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const pos = await svc.updatePosition(id, body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'RECRUITMENT',
      entityId: id.toString(),
      entityName: pos.title,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, pos);
  } catch (err) {
    next(err);
  }
}

export async function removePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.id, res);
    if (id === null) return;
    await svc.deletePosition(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'RECRUITMENT',
      entityId: id.toString(),
      entityName: 'JobPosition',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ─── Candidates ───────────────────────────────────────────────

export async function getCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const positionId = parseBigInt(req.params.id, res);
    if (positionId === null) return;
    const rows = await svc.listCandidates(positionId);
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function getCandidateById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.candidateId, res);
    if (id === null) return;
    const cand = await svc.getCandidate(id);
    if (!cand) return sendError(res, 'Candidate not found', 'NOT_FOUND', 404);
    sendSuccess(res, cand);
  } catch (err) {
    next(err);
  }
}

export async function postCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const positionId = parseBigInt(req.params.id, res);
    if (positionId === null) return;
    const body = req.body as CreateCandidateDto;
    if (!body.fullName?.trim()) {
      return sendError(res, 'fullName is required', 'VALIDATION_ERROR', 400);
    }
    if (body.currentStage && !VALID_STAGES.includes(body.currentStage)) {
      return sendError(res, `currentStage must be one of ${VALID_STAGES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    if (body.source && !VALID_SOURCES.includes(body.source as never)) {
      return sendError(res, `source must be one of ${VALID_SOURCES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const cand = await svc.createCandidate(positionId, body);
    sendSuccess(res, cand, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function patchCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.candidateId, res);
    if (id === null) return;
    const body = req.body as UpdateCandidateDto;
    if (body.currentStage && !VALID_STAGES.includes(body.currentStage as CandidateStage)) {
      return sendError(res, `currentStage must be one of ${VALID_STAGES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const cand = await svc.updateCandidate(id, body);
    sendSuccess(res, cand);
  } catch (err) {
    next(err);
  }
}

export async function patchCandidateStage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.candidateId, res);
    if (id === null) return;
    const body = req.body as UpdateStageDto;
    if (!body.stage || !VALID_STAGES.includes(body.stage)) {
      return sendError(res, `stage must be one of ${VALID_STAGES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const cand = await svc.updateCandidateStage(id, body, req.user!.id);
    sendSuccess(res, cand);
  } catch (err) {
    next(err);
  }
}

export async function removeCandidate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.candidateId, res);
    if (id === null) return;
    await svc.deleteCandidate(id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function postCandidateCv(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseBigInt(req.params.candidateId, res);
    if (id === null) return;
    if (!req.file) {
      return sendError(res, 'No file uploaded', 'VALIDATION_ERROR', 400);
    }
    const cvUrl = `/uploads/cv/${path.basename(req.file.path)}`;
    const cand = await svc.updateCandidateCv(id, cvUrl);
    sendSuccess(res, cand);
  } catch (err) {
    next(err);
  }
}

// ─── Weekly KPI ───────────────────────────────────────────────

export async function getWeeklyKpi(req: Request, res: Response, next: NextFunction) {
  try {
    const positionId = parseBigInt(req.params.id, res);
    if (positionId === null) return;
    const year  = Number(req.query.year  ?? new Date().getFullYear());
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const rows = await svc.getWeeklyKpi(positionId, year, month);
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function putWeeklyKpi(req: Request, res: Response, next: NextFunction) {
  try {
    const positionId = parseBigInt(req.params.id, res);
    if (positionId === null) return;
    const year  = Number(req.query.year  ?? new Date().getFullYear());
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const body  = req.body as UpsertWeeklyKpiDto;
    if (!body.week || body.week < 1 || body.week > 4) {
      return sendError(res, 'week must be 1-4', 'VALIDATION_ERROR', 400);
    }
    if (!body.stage || !VALID_STAGES.includes(body.stage)) {
      return sendError(res, `stage must be one of ${VALID_STAGES.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    const row = await svc.upsertWeeklyKpi(positionId, year, month, body);
    sendSuccess(res, row);
  } catch (err) {
    next(err);
  }
}

// ─── Dashboard stats ──────────────────────────────────────────

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const year  = Number(req.query.year  ?? new Date().getFullYear());
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const stats = await svc.getDashboardStats(year, month);
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}
