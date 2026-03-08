import prisma from '../../config/prisma';

// ── Recalculate annual leave (AL) total_days for ALL active users ──────────
// Rules:
//  • Only AL (code='AL') gets pro-rata calculation based on company_join_date
//  • Other leave types keep their defaultDays
//  • Pro-rata: if joined mid-year → (months worked in that year / 12) × 12
//  • If company_join_date is null → default 12 days
//  • Upsert: if record exists → update totalDays only (preserve usedDays)
//            if record doesn't exist → create with usedDays = 0
export async function recalculateAllBalances(year: number) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, companyJoinDate: true },
  });

  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const alType = leaveTypes.find((lt) => lt.code === 'AL');

  const results: Array<{ userId: string; fullName: string; totalDays: number }> = [];

  for (const user of users) {
    for (const lt of leaveTypes) {
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
            // joinDate month is 0-indexed (0=Jan, 11=Dec)
            // Months worked = 12 - joinMonth (e.g. joined March = month 2 → 12-2=10 months)
            const joinMonth = joinDate.getMonth(); // 0=Jan
            const monthsWorked = 12 - joinMonth;
            totalDays = Math.round((monthsWorked / 12) * 12 * 10) / 10; // 1 decimal
          }
        }
      } else {
        // Other leave types: use defaultDays as-is
        totalDays = Number(lt.defaultDays);
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
