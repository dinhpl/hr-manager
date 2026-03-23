import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { buildMeta } from '../../utils/pagination';
import {
  AssignSkillDto,
  UpdateUserSkillDto,
  BulkSetSkillsDto,
  UpdateUserSkillProfileDto,
  ListUsersWithSkillsQueryDto,
} from './user-skills.validation';

const USER_SKILL_INCLUDE = {
  skill: {
    include: { category: { select: { id: true, name: true } } },
  },
  level: { select: { id: true, level: true, name: true } },
} satisfies Prisma.UserSkillInclude;

// Danh sách users kèm skills (có search + filter)
export async function listUsersWithSkills(query: ListUsersWithSkillsQueryDto) {
  const { search, categoryId, skillId, levelId, page, limit } = query;
  const skip = (page - 1) * limit;
  const take = limit;

  const skillFilter = skillId ? { skillId } : categoryId ? { skill: { categoryId } } : undefined;

  const levelFilter = levelId ? { levelId } : undefined;
  const hasSkillFilter = !!(skillId || categoryId || levelId);

  const userWhere: Prisma.UserWhereInput = {
    isActive: true,
    ...(hasSkillFilter
      ? { userSkills: { some: { ...(skillFilter ?? {}), ...(levelFilter ?? {}) } } }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.user.findMany({
      where: userWhere,
      skip,
      take,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        avatar: true,
        department: true,
        position: true,
        yoe: true,
        otaRanking: true,
        userSkills: {
          include: USER_SKILL_INCLUDE,
          orderBy: { skill: { category: { sortOrder: 'asc' } } },
        },
      },
    }),
  ]);

  return { data: users, meta: buildMeta(total, page, limit) };
}

// Skills của 1 user
export async function getUserSkills(userId: bigint) {
  return prisma.userSkill.findMany({
    where: { userId },
    include: USER_SKILL_INCLUDE,
    orderBy: { skill: { category: { sortOrder: 'asc' } } },
  });
}

// Gán skill (upsert: nếu đã có thì update level)
export async function assignSkill(dto: AssignSkillDto) {
  return prisma.userSkill.upsert({
    where: { userId_skillId: { userId: dto.userId, skillId: dto.skillId } },
    update: { levelId: dto.levelId },
    create: dto,
    include: USER_SKILL_INCLUDE,
  });
}

// Cập nhật level của 1 userSkill
export async function updateUserSkill(id: bigint, dto: UpdateUserSkillDto) {
  return prisma.userSkill.update({
    where: { id },
    data: { levelId: dto.levelId },
    include: USER_SKILL_INCLUDE,
  });
}

// Xóa 1 userSkill
export async function removeUserSkill(id: bigint) {
  return prisma.userSkill.delete({ where: { id } });
}

// Bulk replace: xóa hết rồi thêm mới trong 1 transaction
export async function bulkSetSkills(userId: bigint, dto: BulkSetSkillsDto) {
  return prisma.$transaction(async (tx) => {
    await tx.userSkill.deleteMany({ where: { userId } });
    if (dto.skills.length > 0) {
      await tx.userSkill.createMany({
        data: dto.skills.map((s) => ({
          userId,
          skillId: s.skillId,
          levelId: s.levelId,
        })),
      });
    }
    return tx.userSkill.findMany({
      where: { userId },
      include: USER_SKILL_INCLUDE,
      orderBy: { skill: { category: { sortOrder: 'asc' } } },
    });
  });
}

// Cập nhật YoE + OTA Ranking
export async function updateUserSkillProfile(userId: bigint, dto: UpdateUserSkillProfileDto) {
  return prisma.user.update({
    where: { id: userId },
    data: { yoe: dto.yoe, otaRanking: dto.otaRanking },
    select: { id: true, fullName: true, yoe: true, otaRanking: true },
  });
}
