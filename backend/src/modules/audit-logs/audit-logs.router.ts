import { IRouter, Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { auditLogsController } from './audit-logs.controller';

export const auditLogsRouter: IRouter = Router();

auditLogsRouter.use(authMiddleware);
auditLogsRouter.get('/', auditLogsController.getAll);
