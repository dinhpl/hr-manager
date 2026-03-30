import { Request, Response, NextFunction } from 'express';
import * as service from './overtime.service';
import { createOvertimeSchema, getOvertimeQuerySchema, updateOvertimeSchema } from './overtime.validation';
import { sendSuccess } from '../../utils/response';
import { createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';

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
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'OVERTIME',
      entityId: record.id.toString(),
      entityName: 'Overtime #' + record.id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, record, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const data = updateOvertimeSchema.parse(req.body);
    const record = await service.updateOvertime(id, req.user!.id, data);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'OVERTIME',
      entityId: id.toString(),
      entityName: 'Overtime #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    await service.deleteOvertime(id, req.user!.id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'OVERTIME',
      entityId: id.toString(),
      entityName: 'Overtime #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, null);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const record = await service.approveOvertime(id, req.user!);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'APPROVE',
      module: 'OVERTIME',
      entityId: id.toString(),
      entityName: 'Overtime #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const record = await service.rejectOvertime(id, req.user!);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'REJECT',
      module: 'OVERTIME',
      entityId: id.toString(),
      entityName: 'Overtime #' + id,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, record);
  } catch (err) {
    next(err);
  }
}
