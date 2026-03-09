import { Request, Response, NextFunction } from 'express';
import * as service from './reports.service';
import { sendSuccess } from '../../utils/response';
import { reportsQuerySchema } from './reports.validation';

export async function getLeaveReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = reportsQuerySchema.parse(req.query);
    const data = await service.getLeaveReport(req.user!, query);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = reportsQuerySchema.parse(req.query);
    const data = await service.getDepartmentReport(req.user!, query);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getTopUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = reportsQuerySchema.parse(req.query);
    const data = await service.getTopLeaveUsers(req.user!, query);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getOvertimeReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = reportsQuerySchema.parse(req.query);
    const data = await service.getOvertimeReport(req.user!, query);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const query = reportsQuerySchema.parse(req.query);
    const csv = await service.exportLeaveReport(req.user!, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leave-report-${query.fromDate ?? query.year ?? 'range'}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
