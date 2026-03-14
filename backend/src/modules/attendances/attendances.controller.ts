import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import {
  getMonthlyAttendancesSchema,
  updateAttendanceParamsSchema,
  updateAttendanceSchema,
} from './attendances.validation';
import * as attendancesService from './attendances.service';

export async function getAvailableMonths(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await attendancesService.getAvailableMonths();
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getMonthly(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getMonthlyAttendancesSchema.parse(req.query);
    const result = await attendancesService.getMonthlyAttendances(query);
    sendSuccess(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function importAttendanceExcel(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file?.buffer) {
      throw Object.assign(new Error('No Excel file uploaded'), { status: 400 });
    }

    const result = await attendancesService.importAttendanceExcel(req.file.buffer);
    sendSuccess(res, result, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = updateAttendanceParamsSchema.parse(req.params);
    const data = updateAttendanceSchema.parse(req.body);
    const result = await attendancesService.updateAttendance(id, data);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
