import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import {
  createHolidaySchema,
  holidayParamsSchema,
  holidayQuerySchema,
  updateHolidaySchema,
} from './holidays.validation';
import * as holidaysService from './holidays.service';

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = holidayQuerySchema.parse(req.query);
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const holidays = await holidaysService.getHolidays(year, query.month);
    sendSuccess(res, holidays);
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createHolidaySchema.parse(req.body);
    const holiday = await holidaysService.createHoliday(data);
    sendSuccess(res, holiday, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = holidayParamsSchema.parse(req.params);
    const data = updateHolidaySchema.parse(req.body);
    const holiday = await holidaysService.updateHoliday(id, data);
    sendSuccess(res, holiday);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = holidayParamsSchema.parse(req.params);
    await holidaysService.deleteHoliday(id);
    sendSuccess(res, { message: 'Holiday deleted' });
  } catch (error) {
    next(error);
  }
}
