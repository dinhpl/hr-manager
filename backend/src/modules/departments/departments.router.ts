import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as ctrl from './departments.controller';

export const departmentsRouter: IRouter = Router();

// All authenticated users can fetch departments (used in dropdowns)
departmentsRouter.use(authMiddleware);

departmentsRouter.get('/', ctrl.getDepartments);
