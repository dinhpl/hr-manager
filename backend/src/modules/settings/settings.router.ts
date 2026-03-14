import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import * as ctrl from './settings.controller';

export const settingsRouter: IRouter = Router();

settingsRouter.use(authMiddleware);

settingsRouter.get('/leave-policy', ctrl.getLeavePolicy);
settingsRouter.patch('/leave-policy', requireRoles('ADMIN'), ctrl.updateLeavePolicy);
settingsRouter.get('/approval-flow', ctrl.getApprovalFlow);
settingsRouter.patch('/approval-flow', requireRoles('ADMIN'), ctrl.updateApprovalFlow);

settingsRouter.get('/attendance', ctrl.getAttendance);
settingsRouter.patch('/attendance', requireRoles('ADMIN', 'HR'), ctrl.updateAttendance);
