import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { upload } from '../../utils/upload';
import * as ctrl from './leave-requests.controller';

export const leaveRequestsRouter: IRouter = Router();

leaveRequestsRouter.use(authMiddleware);

leaveRequestsRouter.get('/', ctrl.getAll);
leaveRequestsRouter.get('/:id', ctrl.getOne);
leaveRequestsRouter.post('/', upload.single('attachment'), ctrl.create); // multipart/form-data with optional file
leaveRequestsRouter.post('/bulk-approve', requireRoles('MANAGER', 'HR', 'ADMIN'), ctrl.bulkApprove);
leaveRequestsRouter.patch('/:id/approve', requireRoles('MANAGER', 'HR', 'ADMIN'), ctrl.approve);
leaveRequestsRouter.patch('/:id/reject', requireRoles('MANAGER', 'HR', 'ADMIN'), ctrl.reject);
leaveRequestsRouter.patch('/:id/cancel', ctrl.cancel);
