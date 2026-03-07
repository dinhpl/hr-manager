import { Request, Response, NextFunction } from 'express';
import * as service from './reports.service';
import { sendSuccess } from '../../utils/response';

export async function getLeaveReport(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const department = req.query.department as string | undefined;
    const leaveTypeId = req.query.leaveTypeId ? BigInt(String(req.query.leaveTypeId)) : undefined;
    const data = await service.getLeaveReport({ year, department, leaveTypeId });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentReport(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await service.getDepartmentReport(year);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getTopUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const data = await service.getTopLeaveUsers(year, limit);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getOvertimeReport(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const data = await service.getOvertimeReport(year);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function exportReport(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const csv = await service.exportLeaveReport(year);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leave-report-${year}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
