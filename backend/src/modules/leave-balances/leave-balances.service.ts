import prisma from '../../config/prisma';

// Fetch balances for a user (defaults to current year)
export async function getUserBalances(userId: bigint, year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return prisma.leaveBalance.findMany({
    where: { userId, year: targetYear },
    include: { leaveType: { select: { code: true, name: true, color: true } } },
    orderBy: { leaveType: { code: 'asc' } },
  });
}

// Initialize balances for a user from leave_types.default_days (upsert — safe to re-run)
export async function initializeBalancesForUser(userId: bigint, year: number) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  await Promise.all(
    leaveTypes.map((lt) =>
      prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: lt.id, year } },
        create: { userId, leaveTypeId: lt.id, year, totalDays: lt.defaultDays, usedDays: 0 },
        update: {}, // don't overwrite existing balance
      }),
    ),
  );
}

// HR/Admin manual adjustment of total days
export async function adjustBalance(id: bigint, totalDays: number) {
  return prisma.leaveBalance.update({ where: { id }, data: { totalDays } });
}

// Called inside transaction when leave request is approved
export async function deductBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
) {
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId, year },
    data: { usedDays: { increment: days } },
  });
}

// Called inside transaction when approved request is cancelled/reversed
export async function restoreBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
) {
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId, year },
    data: { usedDays: { decrement: days } },
  });
}
