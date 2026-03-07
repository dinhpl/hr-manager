import { Request, Response, NextFunction } from "express";
import * as service from "./overtime.service";
import { createOvertimeSchema, getOvertimeQuerySchema } from "./overtime.validation";
import { sendSuccess } from "../../utils/response";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getOvertimeQuerySchema.parse(req.query);
    const result = await service.getOvertimes(req.user!, query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.getOvertimeById(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createOvertimeSchema.parse(req.body);
    const record = await service.createOvertime(req.user!.id, data);
    sendSuccess(res, record, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.approveOvertime(BigInt(String(req.params.id)), req.user!.id);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const record = await service.rejectOvertime(BigInt(String(req.params.id)), req.user!.id);
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}
