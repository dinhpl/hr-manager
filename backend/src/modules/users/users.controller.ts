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
