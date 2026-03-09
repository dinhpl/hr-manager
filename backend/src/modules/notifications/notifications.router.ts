import { IRouter, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as ctrl from './notifications.controller';

export const notificationsRouter: IRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get('/', ctrl.list);
notificationsRouter.get('/unread-count', ctrl.unreadCount);
notificationsRouter.get('/stream', ctrl.stream);
notificationsRouter.patch('/read-all', ctrl.markAllAsRead);
notificationsRouter.patch('/:id/read', ctrl.markAsRead);
