import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  entityId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
});
