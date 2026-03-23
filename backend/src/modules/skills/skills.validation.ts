import { z } from 'zod';

// ── Category ──────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.coerce.number().int().default(0),
});
export const updateCategorySchema = createCategorySchema.partial();
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

// ── Skill ─────────────────────────────────────────────────────
export const createSkillSchema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.coerce.bigint(),
  sortOrder: z.coerce.number().int().default(0),
});
export const updateSkillSchema = createSkillSchema.partial();
export type CreateSkillDto = z.infer<typeof createSkillSchema>;
export type UpdateSkillDto = z.infer<typeof updateSkillSchema>;

// ── Level ─────────────────────────────────────────────────────
export const createLevelSchema = z.object({
  level: z.coerce.number().int().min(1).max(99),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
});
export const updateLevelSchema = createLevelSchema.partial();
export type CreateLevelDto = z.infer<typeof createLevelSchema>;
export type UpdateLevelDto = z.infer<typeof updateLevelSchema>;
