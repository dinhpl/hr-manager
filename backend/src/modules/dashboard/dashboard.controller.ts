import { Request, Response, NextFunction } from 'express';
import * as service from './dashboard.service';
import { sendSuccess } from '../../utils/response';

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await service.getDashboardSummary(req.user!);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function getCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const data = await service.getCalendarData(req.user!, year, month);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getRecentRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const requests = await service.getRecentRequests(req.user!, limit);
    sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
}
