import { IRouter, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { uploadAttendanceExcel } from '../../utils/upload';
import * as ctrl from './attendances.controller';

export const attendancesRouter: IRouter = Router();

attendancesRouter.use(authMiddleware);
attendancesRouter.use(requireRoles('HR', 'ADMIN'));

attendancesRouter.get('/monthly', ctrl.getMonthly);
attendancesRouter.post('/import', uploadAttendanceExcel.single('file'), ctrl.importAttendanceExcel);
