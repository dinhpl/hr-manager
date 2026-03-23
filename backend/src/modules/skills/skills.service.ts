import prisma from '../../config/prisma';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSkillDto,
  UpdateSkillDto,
  CreateLevelDto,
  UpdateLevelDto,
} from './skills.validation';

// ── Categories ────────────────────────────────────────────────
export async function listCategories() {
  return prisma.skillCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      skills: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      _count: { select: { skills: true } },
    },
  });
}

export async function createCategory(dto: CreateCategoryDto) {
  return prisma.skillCategory.create({ data: dto });
}

export async function updateCategory(id: bigint, dto: UpdateCategoryDto) {
  return prisma.skillCategory.update({ where: { id }, data: dto });
}

export async function deleteCategory(id: bigint) {
  return prisma.skillCategory.delete({ where: { id } });
}

// ── Skills ────────────────────────────────────────────────────
export async function listSkills(categoryId?: bigint) {
  return prisma.skill.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function createSkill(dto: CreateSkillDto) {
  return prisma.skill.create({
    data: dto,
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function updateSkill(id: bigint, dto: UpdateSkillDto) {
  return prisma.skill.update({
    where: { id },
    data: dto,
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function deleteSkill(id: bigint) {
  return prisma.skill.delete({ where: { id } });
}

// ── Levels ────────────────────────────────────────────────────
export async function listLevels() {
  return prisma.skillLevel.findMany({ orderBy: { level: 'asc' } });
}

export async function createLevel(dto: CreateLevelDto) {
  return prisma.skillLevel.create({ data: dto });
}

export async function updateLevel(id: bigint, dto: UpdateLevelDto) {
  return prisma.skillLevel.update({ where: { id }, data: dto });
}

export async function deleteLevel(id: bigint) {
  return prisma.skillLevel.delete({ where: { id } });
}
