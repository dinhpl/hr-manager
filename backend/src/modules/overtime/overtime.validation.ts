import { z } from 'zod';

export const createOvertimeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm'),
  reason: z.string().min(1).max(500),
  compensationType: z.enum(['COMP_OFF', 'PAYMENT']).default('COMP_OFF'),
  approverId: z.coerce.bigint().optional(),
});

export const getOvertimeQuerySchema = z.object({
  userId: z.coerce.bigint().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const updateOvertimeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm').optional(),
  reason: z.string().min(1).max(500).optional(),
  compensationType: z.enum(['COMP_OFF', 'PAYMENT']).optional(),
  approverId: z.coerce.bigint().optional(),
});

export type CreateOvertimeDto = z.infer<typeof createOvertimeSchema>;
export type UpdateOvertimeDto = z.infer<typeof updateOvertimeSchema>;
export type GetOvertimeQuery = z.infer<typeof getOvertimeQuerySchema>;
