import { z } from 'zod';

export const holidayQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const holidayParamsSchema = z.object({
  id: z.coerce.bigint(),
});

const holidayDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày holiday phải theo định dạng YYYY-MM-DD');

export const createHolidaySchema = z.object({
  date: holidayDateSchema,
  name: z.string().trim().min(1).max(255),
});

export const updateHolidaySchema = createHolidaySchema.partial().refine(
  (value) => value.date !== undefined || value.name !== undefined,
  {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  },
);

export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
export type CreateHolidayDto = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayDto = z.infer<typeof updateHolidaySchema>;
