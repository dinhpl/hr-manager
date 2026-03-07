import { z } from "zod";

export const createOvertimeSchema = z.object({
  date: z.string().datetime(),
  hours: z.coerce.number().min(0.5).max(16),
  reason: z.string().min(1).max(500),
});

export const getOvertimeQuerySchema = z.object({
  userId: z.coerce.bigint().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateOvertimeDto = z.infer<typeof createOvertimeSchema>;
export type GetOvertimeQuery = z.infer<typeof getOvertimeQuerySchema>;
