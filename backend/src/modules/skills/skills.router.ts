import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import * as ctrl from './skills.controller';

export const skillsRouter: IRouter = Router();
skillsRouter.use(authMiddleware);

// Categories — read: all roles; write: HR/ADMIN
skillsRouter.get('/categories', ctrl.getCategories);
skillsRouter.post('/categories', requireRoles('HR', 'ADMIN'), ctrl.postCategory);
skillsRouter.patch('/categories/:id', requireRoles('HR', 'ADMIN'), ctrl.patchCategory);
skillsRouter.delete('/categories/:id', requireRoles('HR', 'ADMIN'), ctrl.removeCategory);

// Levels — read: all roles; write: HR/ADMIN
skillsRouter.get('/levels', ctrl.getLevels);
skillsRouter.post('/levels', requireRoles('HR', 'ADMIN'), ctrl.postLevel);
skillsRouter.patch('/levels/:id', requireRoles('HR', 'ADMIN'), ctrl.patchLevel);
skillsRouter.delete('/levels/:id', requireRoles('HR', 'ADMIN'), ctrl.removeLevel);

// Skills — read: all roles; write: HR/ADMIN
skillsRouter.get('/', ctrl.getSkills);
skillsRouter.post('/', requireRoles('HR', 'ADMIN'), ctrl.postSkill);
skillsRouter.patch('/:id', requireRoles('HR', 'ADMIN'), ctrl.patchSkill);
skillsRouter.delete('/:id', requireRoles('HR', 'ADMIN'), ctrl.removeSkill);
