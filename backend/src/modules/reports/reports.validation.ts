import { z } from 'zod';

export const reportsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  department: z.string().min(1).optional(),
  leaveTypeId: z.coerce.bigint().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
