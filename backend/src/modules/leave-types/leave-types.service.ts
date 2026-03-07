import prisma from '../../config/prisma';

export async function getLeaveTypes(activeOnly = true) {
  return prisma.leaveType.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: { code: 'asc' },
  });
}

export async function createLeaveType(data: {
  code: string;
  name: string;
  description?: string;
  defaultDays: number;
  isPaid: boolean;
  color: string;
}) {
  const exists = await prisma.leaveType.findUnique({ where: { code: data.code } });
  if (exists) throw Object.assign(new Error('Leave type code already exists'), { status: 409 });
  return prisma.leaveType.create({ data });
}

export async function updateLeaveType(
  id: bigint,
  data: Partial<{
    name: string;
    description: string;
    defaultDays: number;
    isPaid: boolean;
    color: string;
    isActive: boolean;
  }>,
) {
  const exists = await prisma.leaveType.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw Object.assign(new Error('Leave type not found'), { status: 404 });
  return prisma.leaveType.update({ where: { id }, data });
}

export async function deleteLeaveType(id: bigint) {
  // Prevent delete if any leave request references this type
  const count = await prisma.leaveRequest.count({ where: { leaveTypeId: id } });
  if (count > 0)
    throw Object.assign(new Error('Leave type is in use, cannot delete'), { status: 409 });
  // Soft delete
  await prisma.leaveType.update({ where: { id }, data: { isActive: false } });
}
