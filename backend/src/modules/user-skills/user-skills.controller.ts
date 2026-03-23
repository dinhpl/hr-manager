import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as svc from './user-skills.service';
import {
  assignSkillSchema,
  updateUserSkillSchema,
  bulkSetSkillsSchema,
  updateUserSkillProfileSchema,
  listUsersWithSkillsQuerySchema,
} from './user-skills.validation';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';

export async function listUsersWithSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listUsersWithSkillsQuerySchema.parse(req.query);
    const result = await svc.listUsersWithSkills(query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getUserSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = BigInt(req.params.userId as string);
    const data = await svc.getUserSkills(userId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function assignSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const dto = assignSkillSchema.parse(req.body);
    const data = await svc.assignSkill(dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'USER_SKILL',
      entityId: data.id.toString(),
      entityName: 'User Skill #' + data.id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateUserSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    const dto = updateUserSkillSchema.parse(req.body);
    const data = await svc.updateUserSkill(id, dto);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'USER_SKILL',
      entityId: id.toString(),
      entityName: 'User Skill #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeUserSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.removeUserSkill(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'USER_SKILL',
      entityId: id.toString(),
      entityName: 'User Skill #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function bulkSetSkills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = BigInt(req.params.userId as string);
    const dto = bulkSetSkillsSchema.parse(req.body);
    const data = await svc.bulkSetSkills(userId, dto);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateUserSkillProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = BigInt(req.params.userId as string);
    const dto = updateUserSkillProfileSchema.parse(req.body);
    const data = await svc.updateUserSkillProfile(userId, dto);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}
