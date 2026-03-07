import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "./leave-types.service";
import { sendSuccess } from "../../utils/response";

const createSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1),
  description: z.string().optional(),
  defaultDays: z.coerce.number().min(0),
  isPaid: z.boolean().default(true),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#1DB87A"),
});

const updateSchema = createSchema.omit({ code: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly !== "false";
    const types = await service.getLeaveTypes(activeOnly);
    sendSuccess(res, types);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const type = await service.createLeaveType(data);
    sendSuccess(res, type, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateSchema.parse(req.body);
    const type = await service.updateLeaveType(BigInt(String(req.params.id)), data);
    sendSuccess(res, type);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteLeaveType(BigInt(String(req.params.id)));
    sendSuccess(res, { message: "Leave type deactivated" });
  } catch (err) {
    next(err);
  }
}
