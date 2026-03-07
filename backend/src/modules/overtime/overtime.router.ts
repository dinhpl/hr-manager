import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import * as ctrl from './overtime.controller';

export const overtimeRouter: IRouter = Router();

overtimeRouter.use(authMiddleware);

overtimeRouter.get('/', ctrl.getAll);
overtimeRouter.get('/:id', ctrl.getOne);
overtimeRouter.post('/', ctrl.create);
overtimeRouter.patch('/:id/approve', requireRoles('MANAGER', 'HR', 'ADMIN'), ctrl.approve);
overtimeRouter.patch('/:id/reject', requireRoles('MANAGER', 'HR', 'ADMIN'), ctrl.reject);
