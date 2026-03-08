import prisma from '../../config/prisma';

// Get all active departments (ordered by name)
export async function getDepartments() {
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true },
  });
  return departments.map((d) => ({ ...d, id: d.id.toString() }));
}
