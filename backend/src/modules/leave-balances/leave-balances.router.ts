import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { uploadUsersExcel } from '../../utils/upload';
import * as ctrl from './leave-balances.controller';

export const leaveBalancesRouter: IRouter = Router();

leaveBalancesRouter.use(authMiddleware);

leaveBalancesRouter.get('/', ctrl.getMyBalances); // own balance
leaveBalancesRouter.get('/all', requireRoles('HR', 'ADMIN'), ctrl.getAllBalances); // all users' balances
leaveBalancesRouter.get('/export', requireRoles('HR', 'ADMIN'), ctrl.exportLeaveBalances);
leaveBalancesRouter.post(
  '/import',
  requireRoles('HR', 'ADMIN'),
  uploadUsersExcel.single('file'),
  ctrl.importLeaveBalances,
);
leaveBalancesRouter.get('/:userId', ctrl.getUserBalances);
leaveBalancesRouter.post('/initialize', requireRoles('HR', 'ADMIN'), ctrl.initializeBalances);
leaveBalancesRouter.post('/recalculate', requireRoles('HR', 'ADMIN'), ctrl.recalculateAnnualLeave);
leaveBalancesRouter.patch('/:id', requireRoles('HR', 'ADMIN'), ctrl.adjustBalance);
