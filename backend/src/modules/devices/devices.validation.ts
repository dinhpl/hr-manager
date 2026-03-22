import { z } from 'zod';
import { DeviceType, DeviceStatus } from '@prisma/client';

export const createDeviceSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  type: z.nativeEnum(DeviceType),
  brand: z.string().max(100).optional(),
  model: z.string().max(150).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  warrantyUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  location: z.string().max(255).optional(),
  note: z.string().max(1000).optional(),
  specs: z
    .array(
      z.object({
        specKey: z.string().min(1).max(100),
        specValue: z.string().min(1).max(500),
        sortOrder: z.coerce.number().int().default(0),
      }),
    )
    .optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const getDevicesQuerySchema = z.object({
  type: z.nativeEnum(DeviceType).optional(),
  status: z.nativeEnum(DeviceStatus).optional(),
  search: z.string().optional(),
  userId: z.coerce.bigint().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const assignDeviceSchema = z.object({
  userId: z.coerce.bigint(),
  note: z.string().max(500).optional(),
});

export const unassignDeviceSchema = z.object({
  note: z.string().max(500).optional(),
});

export const transferDeviceSchema = z.object({
  toUserId: z.coerce.bigint(),
  note: z.string().max(500).optional(),
});

export const createMaintenanceSchema = z.object({
  issue: z.string().min(1).max(2000),
  assignedToId: z.coerce.bigint().optional(),
  cost: z.coerce.number().min(0).optional(),
  note: z.string().max(500).optional(),
});

export const resolveMaintenanceSchema = z.object({
  resolution: z.string().min(1).max(2000),
  cost: z.coerce.number().min(0).optional(),
});

export const getAuditLogsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateDeviceDto = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceDto = z.infer<typeof updateDeviceSchema>;
export type GetDevicesQueryDto = z.infer<typeof getDevicesQuerySchema>;
export type AssignDeviceDto = z.infer<typeof assignDeviceSchema>;
export type UnassignDeviceDto = z.infer<typeof unassignDeviceSchema>;
export type TransferDeviceDto = z.infer<typeof transferDeviceSchema>;
export type CreateMaintenanceDto = z.infer<typeof createMaintenanceSchema>;
export type ResolveMaintenanceDto = z.infer<typeof resolveMaintenanceSchema>;
export type GetAuditLogsQueryDto = z.infer<typeof getAuditLogsQuerySchema>;
