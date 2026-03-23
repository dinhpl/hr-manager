import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './leave-types.service';
import { sendSuccess } from '../../utils/response';
import { createAuditLog, buildChanges, getClientIp } from '../audit-logs/audit-logs.service';
import prisma from '../../config/prisma';

const createSchema = z.object({
  code: z.string().min(1).max(20).toUpperCase(),
  name: z.string().min(1),
  description: z.string().optional(),
  defaultDays: z.coerce.number().min(0),
  isPaid: z.boolean().default(true),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#1DB87A'),
  maxConsecutiveDays: z.coerce.number().min(1).optional().nullable(),
  usesAnnualBalance: z.boolean().default(false),
});

const updateSchema = createSchema.omit({ code: true }).partial().extend({
  isActive: z.boolean().optional(),
});

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
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
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'LEAVE_TYPE',
      entityId: type.id.toString(),
      entityName: type.name,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, type, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const data = updateSchema.parse(req.body);
    const before = await prisma.leaveType.findUnique({
      where: { id },
      select: { name: true, defaultDays: true, isPaid: true, isActive: true, maxConsecutiveDays: true },
    });
    const type = await service.updateLeaveType(id, data);
    const changes = before
      ? buildChanges(
          before as Record<string, unknown>,
          type as Record<string, unknown>,
          ['name', 'defaultDays', 'isPaid', 'isActive', 'maxConsecutiveDays'],
        )
      : undefined;
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'LEAVE_TYPE',
      entityId: id.toString(),
      entityName: before?.name ?? type.name,
      changes,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, type);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const before = await prisma.leaveType.findUnique({
      where: { id },
      select: { name: true },
    });
    await service.deleteLeaveType(id);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'DELETE',
      module: 'LEAVE_TYPE',
      entityId: id.toString(),
      entityName: before?.name ?? id.toString(),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, { message: 'Leave type deactivated' });
  } catch (err) {
    next(err);
  }
}
