import prisma from '../../config/prisma';
import { hashPassword } from '../../utils/hash';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import { GetUsersQuery, CreateUserDto, UpdateUserDto } from './users.validation';

// Fields returned in list/detail — password excluded
const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  firstName: true,
  lastName: true,
  role: true,
  department: true,
  position: true,
  avatar: true,
  teamId: true,
  isCountable: true,
  companyJoinDate: true,
  isActive: true,
  createdAt: true,
  manager: { select: { id: true, fullName: true } },
} as const;

async function syncUsersIdSequence() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"users"', 'id'),
      COALESCE((SELECT MAX(id) FROM "users"), 1),
      true
    )
  `);
}

export async function getUsers(query: GetUsersQuery) {
  const { search, department, role, status, page, limit } = query;
  const { skip } = getPaginationParams(query);

  const where = {
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { username: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(department && { department }),
    ...(role && { role }),
    ...(status === 'active' && { isActive: true }),
    ...(status === 'inactive' && { isActive: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, meta: buildMeta(total, page, limit) };
}

export async function getUserById(id: bigint) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      leaveBalances: {
        where: { year: new Date().getFullYear() },
        include: { leaveType: { select: { code: true, name: true, color: true } } },
      },
    },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

export async function createUser(data: CreateUserDto) {
  const { password, managerId, companyJoinDate, ...rest } = data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: rest.email }, { username: rest.username }] },
  });
  if (existing) throw Object.assign(new Error('Email or username already exists'), { status: 409 });

  const hashedPassword = await hashPassword(password);
  await syncUsersIdSequence();

  const user = await prisma.user.create({
    data: {
      ...rest,
      password: hashedPassword,
      ...(managerId && { managerId }),
      ...(companyJoinDate && { companyJoinDate: new Date(companyJoinDate) }),
    },
    select: USER_SELECT,
  });
  return user;
}

export async function updateUser(id: bigint, data: UpdateUserDto) {
  // Verify user exists
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw Object.assign(new Error('User not found'), { status: 404 });

  const { companyJoinDate, managerId, ...rest } = data;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(managerId !== undefined && { managerId }),
      ...(companyJoinDate && { companyJoinDate: new Date(companyJoinDate) }),
    },
    select: USER_SELECT,
  });
  return user;
}

export async function deleteUser(id: bigint) {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw Object.assign(new Error('User not found'), { status: 404 });
  // Soft delete only
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}

// Dropdown for leave-request form handover selector
export async function getUsersDropdown() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, username: true, department: true, role: true },
    orderBy: { fullName: 'asc' },
  });
}
