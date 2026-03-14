import { z } from 'zod';

const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'leave'] as const;

export const getMonthlyAttendancesSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  search: z.string().trim().optional(),
  statuses: z
    .preprocess(
      (value) => {
        if (!value) return undefined;
        if (typeof value === 'string') {
          return value
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        }

        if (Array.isArray(value)) {
          return value
            .flatMap((item) => String(item).split(','))
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        }

        return undefined;
      },
      z.array(z.enum(ATTENDANCE_STATUSES)).optional(),
    )
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];
export type GetMonthlyAttendancesQuery = z.infer<typeof getMonthlyAttendancesSchema>;

export const updateAttendanceParamsSchema = z.object({
  id: z.coerce.bigint(),
});

export const updateAttendanceSchema = z
  .object({
    status: z.enum(ATTENDANCE_STATUSES),
    checkIn: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    checkOut: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    workHours: z.coerce.number().min(0).max(24),
    note: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.checkIn && !value.checkOut) || (!value.checkIn && value.checkOut)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkOut'],
        message: 'Check-in và check-out phải được nhập cùng nhau hoặc cùng để trống',
      });
    }
  });

export type UpdateAttendanceDto = z.infer<typeof updateAttendanceSchema>;
