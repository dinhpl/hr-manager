import { z } from 'zod';
import { LeaveRequestStatus } from '@prisma/client';

const durationModeSchema = z.enum(['FULL_DAY', 'HALF_DAY_AM', 'HALF_DAY_PM']);
const vietnamDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.coerce.bigint(),
  userId: z.coerce.bigint().optional(),
  approverId: z.coerce.bigint().optional(),
  fromDate: vietnamDateTimeSchema,
  toDate: vietnamDateTimeSchema,
  durationMode: durationModeSchema.optional(),
  totalDays: z.coerce.number().min(0.5),
  reason: z.string().min(1).max(1000),
  handoverPersonId: z.coerce.bigint().optional(),
});

export const updateLeaveRequestSchema = createLeaveRequestSchema;

export const getLeaveRequestsQuerySchema = z.object({
  scope: z.enum(['global']).optional(),
  status: z.nativeEnum(LeaveRequestStatus).optional(),
  userId: z.coerce.bigint().optional(),
  leaveTypeId: z.coerce.bigint().optional(),
  fromDate: vietnamDateTimeSchema.optional(),
  toDate: vietnamDateTimeSchema.optional(),
  department: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const approveRejectSchema = z.object({
  note: z.string().max(500).optional(),
});

export const bulkApproveSchema = z.object({
  ids: z.array(z.coerce.bigint()).min(1),
  note: z.string().max(500).optional(),
});

export type CreateLeaveRequestDto = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestDto = z.infer<typeof updateLeaveRequestSchema>;
export type GetLeaveRequestsQuery = z.infer<typeof getLeaveRequestsQuerySchema>;
