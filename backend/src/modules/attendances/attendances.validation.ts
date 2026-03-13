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
