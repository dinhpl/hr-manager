import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './leave-balances.service';
import { sendSuccess } from '../../utils/response';

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
    const balance = await service.adjustBalance(BigInt(String(req.params.id)), data);
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
