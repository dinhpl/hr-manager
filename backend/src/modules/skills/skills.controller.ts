import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as svc from './skills.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createSkillSchema,
  updateSkillSchema,
  createLevelSchema,
  updateLevelSchema,
} from './skills.validation';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';

// ── Categories ────────────────────────────────────────────────
export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listCategories();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function postCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createCategorySchema.parse(req.body);
    const data = await svc.createCategory(dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'SKILL',
      entityId: data.id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function patchCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    const dto = updateCategorySchema.parse(req.body);
    const data = await svc.updateCategory(id, dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SKILL',
      entityId: id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteCategory(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'SKILL',
      entityId: id.toString(),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ── Skills ────────────────────────────────────────────────────
export async function getSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.query.categoryId ? BigInt(req.query.categoryId as string) : undefined;
    const data = await svc.listSkills(categoryId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function postSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createSkillSchema.parse(req.body);
    const data = await svc.createSkill(dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'SKILL',
      entityId: data.id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function patchSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    const dto = updateSkillSchema.parse(req.body);
    const data = await svc.updateSkill(id, dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SKILL',
      entityId: id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteSkill(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'SKILL',
      entityId: id.toString(),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// ── Levels ────────────────────────────────────────────────────
export async function getLevels(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await svc.listLevels();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function postLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = createLevelSchema.parse(req.body);
    const data = await svc.createLevel(dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'SKILL',
      entityId: data.id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function patchLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    const dto = updateLevelSchema.parse(req.body);
    const data = await svc.updateLevel(id, dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SKILL',
      entityId: id.toString(),
      entityName: data.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteLevel(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'SKILL',
      entityId: id.toString(),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}
