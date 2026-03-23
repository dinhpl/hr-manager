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
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeUserSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.removeUserSkill(id);
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
