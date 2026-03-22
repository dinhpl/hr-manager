import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { upload, uploadDeviceImages } from '../../utils/upload';
import * as ctrl from './devices.controller';

export const devicesRouter: IRouter = Router();

devicesRouter.use(authMiddleware);

// Device CRUD
devicesRouter.get('/', ctrl.getAll);
devicesRouter.post('/', requireRoles('ADMIN', 'HR'), upload.single('image'), ctrl.create);
devicesRouter.get('/:id', ctrl.getOne);
devicesRouter.patch('/:id', requireRoles('ADMIN', 'HR'), upload.single('image'), ctrl.update);
devicesRouter.delete('/:id', requireRoles('ADMIN', 'HR'), ctrl.remove);

// Assignment
devicesRouter.post('/:id/assign', requireRoles('ADMIN', 'HR'), ctrl.assign);
devicesRouter.post('/:id/unassign', requireRoles('ADMIN', 'HR'), ctrl.unassign);
devicesRouter.post('/:id/transfer', requireRoles('ADMIN', 'HR'), ctrl.transfer);

// Maintenance
devicesRouter.get('/:id/maintenance', ctrl.getMaintenanceLogs);
devicesRouter.post('/:id/maintenance', requireRoles('ADMIN', 'HR'), ctrl.createMaintenance);
devicesRouter.patch(
  '/:id/maintenance/:maintenanceId/resolve',
  requireRoles('ADMIN', 'HR'),
  ctrl.resolveMaintenance,
);

// Audit log
devicesRouter.get('/:id/audit-logs', requireRoles('HR', 'ADMIN'), ctrl.getAuditLogs);

// Images
devicesRouter.get('/:id/images', ctrl.getImages);
devicesRouter.post(
  '/:id/images',
  requireRoles('ADMIN', 'HR'),
  uploadDeviceImages.array('images', 10),
  ctrl.uploadImages,
);
devicesRouter.delete('/:id/images/:imageId', requireRoles('ADMIN', 'HR'), ctrl.deleteImage);
