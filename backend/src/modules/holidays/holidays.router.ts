import { IRouter, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import * as ctrl from './holidays.controller';

export const holidaysRouter: IRouter = Router();

holidaysRouter.use(authMiddleware);

holidaysRouter.get('/', ctrl.getAll);
holidaysRouter.post('/', requireRoles('HR', 'ADMIN'), ctrl.create);
holidaysRouter.patch('/:id', requireRoles('HR', 'ADMIN'), ctrl.update);
holidaysRouter.delete('/:id', requireRoles('HR', 'ADMIN'), ctrl.remove);
