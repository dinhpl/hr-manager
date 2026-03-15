import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as service from './leave-balances.service';
import { sendSuccess } from '../../utils/response';

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
        annualDays: z.coerce.number().min(0).optional(),
        carryOverDays: z.coerce.number().min(0).optional(),
        seniorityDays: z.coerce.number().min(0).optional(),
        compOffDays: z.coerce.number().min(0).optional(),
        wfhDays: z.coerce.number().min(0).optional(),
        usedCarryOverDays: z.coerce.number().min(0).optional(),
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
