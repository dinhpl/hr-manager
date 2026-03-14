import { IRouter, NextFunction, Request, Response, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadAttendanceExcel } from '../../utils/upload';
import * as ctrl from './attendances.controller';

export const attendancesRouter: IRouter = Router();

function requireAttendanceManagers(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }

  const isSystemAdmin = req.user.systemRole?.toUpperCase() === 'ADMIN';
  if (req.user.role === 'HR' || req.user.role === 'ADMIN' || isSystemAdmin) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
  });
}

attendancesRouter.use(authMiddleware);
attendancesRouter.use(requireAttendanceManagers);

attendancesRouter.get('/available-months', ctrl.getAvailableMonths);
attendancesRouter.get('/monthly', ctrl.getMonthly);
attendancesRouter.post('/import', uploadAttendanceExcel.single('file'), ctrl.importAttendanceExcel);
attendancesRouter.patch('/:id', ctrl.updateAttendance);
