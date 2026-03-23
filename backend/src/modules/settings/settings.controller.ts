import { Request, Response, NextFunction } from 'express';
import * as service from './settings.service';
import { sendSuccess } from '../../utils/response';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';

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
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Leave Policy',
      ipAddress: getClientIp(req),
    });
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
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Approval Flow',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getAttendance();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateAttendance(req.body);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'SETTING',
      entityName: 'Attendance Settings',
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
