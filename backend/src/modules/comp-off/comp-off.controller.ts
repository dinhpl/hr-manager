import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "./comp-off.service";
import { sendSuccess } from "../../utils/response";

const createSchema = z.object({
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  totalDays: z.coerce.number().min(0.5),
  reason: z.string().min(1).max(500),
  overtimeId: z.string().optional(),
});

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getCompOffs(req.user!, req.query as Record<string, unknown>);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.getCompOffById(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await service.getCompOffSummary(req.user!.id);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const record = await service.createCompOff(req.user!.id, data);
    sendSuccess(res, record, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.approveCompOff(BigInt(String(req.params.id)), req.user!.id);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.rejectCompOff(BigInt(String(req.params.id)), req.user!.id);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}
