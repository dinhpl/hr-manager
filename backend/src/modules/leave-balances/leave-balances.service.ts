import prisma from '../../config/prisma';

// ── Recalculate annual leave (AL) and comp-off (CO) balances for ALL active users ──────────
// Rules:
//  • Only AL gets pro-rata calculation based on company_join_date
//  • CO gets 0 by default (earned from overtime)
//  • Upsert: if record exists → update totalDays only (preserve usedDays)
//            if record doesn't exist → create with usedDays = 0
export async function recalculateAllBalances(year: number) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, companyJoinDate: true },
  });

  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const alType = leaveTypes.find((lt) => lt.code === 'AL');

  // Only process AL and CO
  const targetLeaveTypes = leaveTypes.filter((lt) => lt.code === 'AL' || lt.code === 'CO');

  const results: Array<{ userId: string; fullName: string; totalDays: number }> = [];

  for (const user of users) {
    for (const lt of targetLeaveTypes) {
      let totalDays: number;

      if (lt.code === 'AL') {
        // Pro-rata calculation for annual leave
        if (!user.companyJoinDate) {
          // No join date → default 12 days
          totalDays = 12;
        } else {
          const joinDate = new Date(user.companyJoinDate);
          const joinYear = joinDate.getFullYear();

          if (joinYear > year) {
            // Not yet joined in target year → 0 days
            totalDays = 0;
          } else if (joinYear < year) {
            // Joined before target year → full 12 days
            totalDays = 12;
          } else {
            // Joined during target year → pro-rata by month
            const joinMonth = joinDate.getMonth(); // 0=Jan
            const monthsWorked = 12 - joinMonth;
            totalDays = Math.round((monthsWorked / 12) * 12 * 10) / 10;
          }
        }
      } else if (lt.code === 'CO') {
        // CO: default 0 (earned from overtime, not auto-allocated)
        totalDays = 0;
      } else {
        totalDays = 0;
      }

      await prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year } },
        create: { userId: user.id, leaveTypeId: lt.id, year, totalDays, usedDays: 0 },
        update: { totalDays },
      });
    }

    // Collect AL result for summary
    if (alType) {
      const alBalance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: alType.id, year } },
      });
      results.push({
        userId: user.id.toString(),
        fullName: user.fullName,
        totalDays: alBalance ? Number(alBalance.totalDays) : 0,
      });
    }
  }

  return {
    year,
    usersProcessed: users.length,
    leaveTypesProcessed: leaveTypes.length,
    results,
  };
}

// Fetch balances for a user (defaults to current year)
export async function getUserBalances(userId: bigint, year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return prisma.leaveBalance.findMany({
    where: { userId, year: targetYear },
    include: { leaveType: { select: { code: true, name: true, color: true } } },
    orderBy: { leaveType: { code: 'asc' } },
  });
}

// Initialize balances for a user (upsert — safe to re-run)
// Only creates AL and CO balances
export async function initializeBalancesForUser(userId: bigint, year: number) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  // Only AL and CO get initialized
  const targetLeaveTypes = leaveTypes.filter((lt) => lt.code === 'AL' || lt.code === 'CO');

  await Promise.all(
    targetLeaveTypes.map((lt) =>
      prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: lt.id, year } },
        create: {
          userId,
          leaveTypeId: lt.id,
          year,
          totalDays: lt.code === 'AL' ? 12 : 0, // AL default 12, CO default 0
          usedDays: 0,
        },
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
// If targetLeaveTypeId is provided, deduct from that leave type (e.g., deduct from AL when usesAnnualBalance=true)
export async function deductBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: { usedDays: { increment: days } },
  });
}

// Called inside transaction when approved request is cancelled/reversed
// If targetLeaveTypeId is provided, restore to that leave type
export async function restoreBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: { usedDays: { decrement: days } },
  });
}
