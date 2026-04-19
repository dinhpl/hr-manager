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
settingsRouter.get('/mail', ctrl.getMailSettings);
settingsRouter.patch('/mail', requireRoles('ADMIN', 'HR'), ctrl.updateMailSettings);
settingsRouter.get('/mail/preview', requireRoles('ADMIN', 'HR'), ctrl.previewMailTemplate);
settingsRouter.post('/mail/test', requireRoles('ADMIN', 'HR'), ctrl.testMailTemplate);

settingsRouter.get('/workspace-map', ctrl.getWorkspaceMap);
settingsRouter.patch('/workspace-map', requireRoles('ADMIN', 'HR'), ctrl.updateWorkspaceMap);
