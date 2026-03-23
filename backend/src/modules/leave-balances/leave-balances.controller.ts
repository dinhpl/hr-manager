import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import * as service from './leave-balances.service';
import { sendSuccess } from '../../utils/response';
import { buildChanges, createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';
import prisma from '../../config/prisma';

const LEAVE_BALANCE_AUDIT_INCLUDE = {
  user: { select: { fullName: true, username: true, employeeCode: true } },
  leaveType: { select: { code: true, name: true } },
} satisfies Prisma.LeaveBalanceInclude;

const LEAVE_BALANCE_AUDIT_FIELDS = [
  'annualDays',
  'carryOverDays',
  'seniorityDays',
  'compOffDays',
  'wfhDays',
  'usedCarryOverDays',
  'usedDays',
  'usedCompOffDays',
] as const;

function getLeaveBalanceEntityName(balance: {
  year?: number;
  user?: {
    fullName?: string | null;
    username?: string | null;
    employeeCode?: string | null;
  } | null;
  leaveType?: { code?: string | null; name?: string | null } | null;
}) {
  const userLabel =
    balance.user?.fullName?.trim() ||
    balance.user?.username?.trim() ||
    balance.user?.employeeCode?.trim() ||
    'Nhân viên';
  const leaveTypeLabel = balance.leaveType?.name
    ? `${balance.leaveType.code} - ${balance.leaveType.name}`
    : balance.leaveType?.code || 'Nghỉ phép';

  return `${userLabel} • ${leaveTypeLabel} • Năm ${balance.year ?? ''}`.trim();
}

function toLeaveBalanceAuditSnapshot(balance: {
  annualDays?: unknown;
  carryOverDays?: unknown;
  seniorityDays?: unknown;
  compOffDays?: unknown;
  wfhDays?: unknown;
  usedCarryOverDays?: unknown;
  usedDays?: unknown;
  usedCompOffDays?: unknown;
}) {
  return {
    annualDays: Number(balance.annualDays ?? 0),
    carryOverDays: Number(balance.carryOverDays ?? 0),
    seniorityDays: Number(balance.seniorityDays ?? 0),
    compOffDays: Number(balance.compOffDays ?? 0),
    wfhDays: Number(balance.wfhDays ?? 0),
    usedCarryOverDays: Number(balance.usedCarryOverDays ?? 0),
    usedDays: Number(balance.usedDays ?? 0),
    usedCompOffDays: Number(balance.usedCompOffDays ?? 0),
  } satisfies Record<(typeof LEAVE_BALANCE_AUDIT_FIELDS)[number], unknown>;
}

export async function exportLeaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const buffer = await service.exportLeaveBalancesExcel(year);
    const y = year ?? new Date().getFullYear();
    const filename = `leave_balances_${y}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importLeaveBalances(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }
    const result = await service.importLeaveBalancesExcel(req.file.buffer);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAllBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const balances = await service.getAllBalances(year);
    sendSuccess(res, balances);
  } catch (err) {
    next(err);
  }
}

export async function getMyBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const balances = await service.getUserBalances(req.user!.id, year);
    sendSuccess(res, balances);
  } catch (err) {
    next(err);
  }
}

export async function getUserBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const balances = await service.getUserBalances(BigInt(String(req.params.userId)), year);
    sendSuccess(res, balances);
  } catch (err) {
    next(err);
  }
}

export async function initializeBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, year } = z
      .object({
        userId: z.coerce.bigint(),
        year: z.coerce.number().int().min(2020).max(2100),
      })
      .parse(req.body);

    await service.initializeBalancesForUser(userId, year);
    sendSuccess(res, { message: `Balances initialized for user ${userId} year ${year}` });
  } catch (err) {
    next(err);
  }
}

export async function adjustBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const data = z
      .object({
        annualDays: z.coerce.number().optional(),
        carryOverDays: z.coerce.number().optional(),
        seniorityDays: z.coerce.number().optional(),
        compOffDays: z.coerce.number().optional(),
        wfhDays: z.coerce.number().optional(),
        usedCarryOverDays: z.coerce.number().optional(),
        usedDays: z.coerce.number().optional(),
        usedCompOffDays: z.coerce.number().optional(),
      })
      .parse(req.body);
    const before = await prisma.leaveBalance.findUnique({
      where: { id },
      include: LEAVE_BALANCE_AUDIT_INCLUDE,
    });
    const balance = await service.adjustBalance(id, data);
    const after = await prisma.leaveBalance.findUnique({
      where: { id },
      include: LEAVE_BALANCE_AUDIT_INCLUDE,
    });
    const changes =
      after && before
        ? buildChanges(
            toLeaveBalanceAuditSnapshot(before) as Record<string, unknown>,
            toLeaveBalanceAuditSnapshot(after) as Record<string, unknown>,
            [...LEAVE_BALANCE_AUDIT_FIELDS],
          )
        : undefined;
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'LEAVE_BALANCE',
      entityId: id.toString(),
      entityName: after
        ? getLeaveBalanceEntityName(after)
        : before
          ? getLeaveBalanceEntityName(before)
          : 'Điều chỉnh số dư nghỉ phép',
      changes,
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, balance);
  } catch (err) {
    next(err);
  }
}

export async function recalculateAnnualLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { year } = z
      .object({ year: z.coerce.number().int().min(2020).max(2100).optional() })
      .parse(req.body);

    const targetYear = year ?? new Date().getFullYear();
    const result = await service.recalculateAllBalances(targetYear);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
