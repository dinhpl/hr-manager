import { Request, Response, NextFunction } from 'express';
import * as service from './devices.service';
import {
  createDeviceSchema,
  updateDeviceSchema,
  getDevicesQuerySchema,
  assignDeviceSchema,
  unassignDeviceSchema,
  transferDeviceSchema,
  createMaintenanceSchema,
  resolveMaintenanceSchema,
  getAuditLogsQuerySchema,
} from './devices.validation';
import { sendSuccess } from '../../utils/response';

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getDevicesQuerySchema.parse(req.query);
    const result = await service.getDevices(req.user!, query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const device = await service.getDeviceById(BigInt(req.params.id as string), req.user!);
    sendSuccess(res, device);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createDeviceSchema.parse(req.body);
    const imageUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const device = await service.createDevice(req.user!, data, imageUrl);
    sendSuccess(res, device, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateDeviceSchema.parse(req.body);
    const imageUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const device = await service.updateDevice(
      BigInt(req.params.id as string),
      req.user!,
      data,
      imageUrl,
    );
    sendSuccess(res, device);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteDevice(BigInt(req.params.id as string), req.user!);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const data = assignDeviceSchema.parse(req.body);
    const result = await service.assignDevice(BigInt(req.params.id as string), req.user!, data);
    sendSuccess(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function unassign(req: Request, res: Response, next: NextFunction) {
  try {
    const data = unassignDeviceSchema.parse(req.body);
    const result = await service.unassignDevice(BigInt(req.params.id as string), req.user!, data);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function transfer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = transferDeviceSchema.parse(req.body);
    const result = await service.transferDevice(BigInt(req.params.id as string), req.user!, data);
    sendSuccess(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function createMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createMaintenanceSchema.parse(req.body);
    const result = await service.createMaintenanceLog(
      BigInt(req.params.id as string),
      req.user!,
      data,
    );
    sendSuccess(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function resolveMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const data = resolveMaintenanceSchema.parse(req.body);
    const result = await service.resolveMaintenanceLog(
      BigInt(req.params.id as string),
      BigInt(req.params.maintenanceId as string),
      req.user!,
      data,
    );
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getMaintenanceLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await service.getMaintenanceLogs(BigInt(req.params.id as string), req.user!);
    sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getAuditLogsQuerySchema.parse(req.query);
    const result = await service.getAuditLogs(BigInt(req.params.id as string), query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function uploadImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return sendSuccess(res, { count: 0 });
    }
    const filenames = files.map((f) => f.filename);
    const result = await service.addDeviceImages(BigInt(req.params.id as string), filenames);
    sendSuccess(res, result, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function deleteImage(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteDeviceImage(
      BigInt(req.params.id as string),
      BigInt(req.params.imageId as string),
    );
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

export async function getImages(req: Request, res: Response, next: NextFunction) {
  try {
    const images = await service.getDeviceImages(BigInt(req.params.id as string));
    sendSuccess(res, images);
  } catch (err) {
    next(err);
  }
}
