import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import * as ctrl from './user-skills.controller';

export const userSkillsRouter: IRouter = Router();
userSkillsRouter.use(authMiddleware);

// Danh sách users với skills — HR/ADMIN/MANAGER
userSkillsRouter.get('/', requireRoles('HR', 'ADMIN', 'MANAGER'), ctrl.listUsersWithSkills);

// Skills của 1 user — tất cả roles (có thể xem skill của mình)
userSkillsRouter.get('/user/:userId', ctrl.getUserSkills);

// Bulk replace skills của user — HR/ADMIN (đặt trước /:id để không conflict)
userSkillsRouter.put('/user/:userId/bulk', requireRoles('HR', 'ADMIN'), ctrl.bulkSetSkills);

// Cập nhật YoE/OTA Ranking — HR/ADMIN
userSkillsRouter.patch('/user/:userId/profile', requireRoles('HR', 'ADMIN'), ctrl.updateUserSkillProfile);

// Gán / sửa / xóa skill — HR/ADMIN
userSkillsRouter.post('/', requireRoles('HR', 'ADMIN'), ctrl.assignSkill);
userSkillsRouter.patch('/:id', requireRoles('HR', 'ADMIN'), ctrl.updateUserSkill);
userSkillsRouter.delete('/:id', requireRoles('HR', 'ADMIN'), ctrl.removeUserSkill);
