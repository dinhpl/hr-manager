import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { uploadUsersExcel } from '../../utils/upload';
import * as ctrl from './users.controller';

export const usersRouter: IRouter = Router();

// All user routes require authentication
usersRouter.use(authMiddleware);

usersRouter.get('/dropdown', ctrl.getUsersDropdown); // ALL roles — handover dropdown in leave form
usersRouter.get('/birthdays', requireRoles('HR', 'ADMIN', 'MANAGER'), ctrl.getBirthdaysByMonth);
usersRouter.get('/export', requireRoles('HR', 'ADMIN'), ctrl.exportUsers);
usersRouter.post('/import', requireRoles('HR', 'ADMIN'), uploadUsersExcel.single('file'), ctrl.importUsers);
usersRouter.get('/', requireRoles('HR', 'ADMIN', 'MANAGER'), ctrl.getUsers);
usersRouter.get('/:id', ctrl.getUserById);
usersRouter.post('/', requireRoles('HR', 'ADMIN'), ctrl.createUser);
usersRouter.patch('/:id', requireRoles('HR', 'ADMIN'), ctrl.updateUser);
usersRouter.delete('/:id', requireRoles('ADMIN'), ctrl.deleteUser);
