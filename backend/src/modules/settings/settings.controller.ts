import { Request, Response, NextFunction } from "express";
import * as service from "./settings.service";
import { sendSuccess } from "../../utils/response";

export async function getLeavePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const policy = await service.getLeavePolicy();
    sendSuccess(res, policy);
  } catch (err) {
    next(err);
  }
}

export async function updateLeavePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateLeavePolicy(req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getApprovalFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const flow = await service.getApprovalFlow();
    sendSuccess(res, flow);
  } catch (err) {
    next(err);
  }
}

export async function updateApprovalFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateApprovalFlow(req.body);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
