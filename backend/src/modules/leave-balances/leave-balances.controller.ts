import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "./leave-balances.service";
import { sendSuccess } from "../../utils/response";

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
    const { userId, year } = z.object({
      userId: z.coerce.bigint(),
      year: z.coerce.number().int().min(2020).max(2100),
    }).parse(req.body);

    await service.initializeBalancesForUser(userId, year);
    sendSuccess(res, { message: `Balances initialized for user ${userId} year ${year}` });
  } catch (err) {
    next(err);
  }
}

export async function adjustBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const { totalDays } = z.object({ totalDays: z.coerce.number().min(0) }).parse(req.body);
    const balance = await service.adjustBalance(BigInt(String(req.params.id)), totalDays);
    sendSuccess(res, balance);
  } catch (err) {
    next(err);
  }
}
