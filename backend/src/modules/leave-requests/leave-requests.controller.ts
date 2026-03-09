import { Request, Response, NextFunction } from 'express';
import * as service from './leave-requests.service';
import {
  createLeaveRequestSchema,
  getLeaveRequestsQuerySchema,
  approveRejectSchema,
  bulkApproveSchema,
  updateLeaveRequestSchema,
} from './leave-requests.validation';
import { sendSuccess } from '../../utils/response';

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getLeaveRequestsQuerySchema.parse(req.query);
    const result = await service.getLeaveRequests(req.user!, query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await service.getLeaveRequestById(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createLeaveRequestSchema.parse(req.body);
    // attachment_url from multer file upload (optional)
    const attachmentUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const request = await service.createLeaveRequest(req.user!, data, attachmentUrl);
    sendSuccess(res, request, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateLeaveRequestSchema.parse(req.body);
    const attachmentUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const request = await service.updateLeaveRequest(
      BigInt(String(req.params.id)),
      req.user!,
      data,
      attachmentUrl,
    );
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const { note } = approveRejectSchema.parse(req.body);
    const request = await service.approveLeaveRequest(
      BigInt(String(req.params.id)),
      req.user!,
      note,
    );
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const { note } = approveRejectSchema.parse(req.body);
    const request = await service.rejectLeaveRequest(
      BigInt(String(req.params.id)),
      req.user!,
      note,
    );
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await service.cancelLeaveRequest(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function bulkApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids, note } = bulkApproveSchema.parse(req.body);
    const result = await service.bulkApproveLeaveRequests(ids, req.user!, note);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
