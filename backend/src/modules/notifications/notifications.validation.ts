import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.coerce.bigint().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.coerce.bigint(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
