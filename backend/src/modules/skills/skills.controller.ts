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
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteCategory(id);
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
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeSkill(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteSkill(id);
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
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function removeLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(req.params.id as string);
    await svc.deleteLevel(id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}
