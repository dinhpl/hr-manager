import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { registerNotificationStream } from './notifications.stream';
import * as service from './notifications.service';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.validation';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listNotificationsQuerySchema.parse(req.query);
    const result = await service.listNotifications(req.user!.id, query);
    sendSuccess(res, result.items, { nextCursor: result.nextCursor });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getUnreadCount(req.user!.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = notificationIdParamSchema.parse(req.params);
    const result = await service.markAsRead(id, req.user!);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.markAllAsRead(req.user!.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function stream(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  registerNotificationStream(req.user!.id, res);
}
