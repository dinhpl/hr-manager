import { IRouter, NextFunction, Request, Response, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { auditLogsController } from './audit-logs.controller';

export const auditLogsRouter: IRouter = Router();

function requireActivityLogAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }

  const isSystemAdmin = req.user.systemRole?.toUpperCase() === 'ADMIN';
  if (req.user.role === 'HR' || isSystemAdmin) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
  });
}

auditLogsRouter.use(authMiddleware);
auditLogsRouter.get('/', requireActivityLogAccess, auditLogsController.getAll);
