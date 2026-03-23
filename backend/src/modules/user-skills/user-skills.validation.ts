import { z } from 'zod';

export const assignSkillSchema = z.object({
  userId: z.coerce.bigint(),
  skillId: z.coerce.bigint(),
  levelId: z.coerce.bigint(),
});
export type AssignSkillDto = z.infer<typeof assignSkillSchema>;

export const updateUserSkillSchema = z.object({
  levelId: z.coerce.bigint(),
});
export type UpdateUserSkillDto = z.infer<typeof updateUserSkillSchema>;

export const bulkSetSkillsSchema = z.object({
  skills: z.array(
    z.object({
      skillId: z.coerce.bigint(),
      levelId: z.coerce.bigint(),
    }),
  ),
});
export type BulkSetSkillsDto = z.infer<typeof bulkSetSkillsSchema>;

export const updateUserSkillProfileSchema = z.object({
  yoe: z.coerce.number().int().min(0).max(99).optional().nullable(),
  otaRanking: z.string().max(100).optional().nullable(),
});
export type UpdateUserSkillProfileDto = z.infer<typeof updateUserSkillProfileSchema>;

export const listUsersWithSkillsQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.coerce.bigint().optional(),
  skillId: z.coerce.bigint().optional(),
  levelId: z.coerce.bigint().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
export type ListUsersWithSkillsQueryDto = z.infer<typeof listUsersWithSkillsQuerySchema>;
