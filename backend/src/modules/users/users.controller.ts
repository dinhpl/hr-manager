import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { getUsersQuerySchema, createUserSchema, updateUserSchema } from './users.validation';
import { sendSuccess } from '../../utils/response';

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getUsersQuerySchema.parse(req.query);
    const result = await usersService.getUsers(query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getBirthdaysByMonth(req: Request, res: Response, next: NextFunction) {
  try {
    const year = parseInt(String(req.query.year)) || new Date().getFullYear();
    const month = parseInt(String(req.query.month)) || new Date().getMonth() + 1;
    const callerRole = req.user?.role || '';
    const data = await usersService.getUsersBirthdaysByMonth(year, month, callerRole);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getUsersDropdown(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await usersService.getUsersDropdown();
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getUserById(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await usersService.createUser(data);
    sendSuccess(res, user, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await usersService.updateUser(BigInt(String(req.params.id)), data);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.deleteUser(BigInt(String(req.params.id)));
    sendSuccess(res, { message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

export async function exportUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await usersService.exportUsersExcel();
    const filename = `employees_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function importUsers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }
    const result = await usersService.importUsersExcel(req.file.buffer);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
