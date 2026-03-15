import prisma from '../../config/prisma';
import { getLeavePolicy } from '../settings/settings.service';

type AnnualLeaveRule = { fromYear: number; toYear: number; days: number };

function getSeniorityDays(
  companyJoinDate: Date | null,
  targetYear: number,
  rules: AnnualLeaveRule[],
): number {
  const BASE_DAYS = 12;
  if (!companyJoinDate || !rules.length) return 0;

  const joinYear = companyJoinDate.getFullYear();
  const yearsOfService = targetYear - joinYear;
  if (yearsOfService <= 0) return 0;

  const rule = rules.find((r) => yearsOfService >= r.fromYear && yearsOfService < r.toYear);
  const totalEntitlement = rule ? rule.days : rules[rules.length - 1].days;
  return Math.max(0, totalEntitlement - BASE_DAYS);
}

// ── Recalculate annual leave (AL) balances for ALL active users ──────────
// Rules:
//  • Only AL gets pro-rata calculation based on company_join_date
//  • CO is excluded — earned from overtime, managed separately
//  • Upsert: if record exists → update annualDays only (preserve usedDays)
//            if record doesn't exist → create with usedDays = 0
export async function recalculateAllBalances(year: number) {
  const [users, leaveTypes, leavePolicyRaw] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, companyJoinDate: true },
    }),
    prisma.leaveType.findMany({ where: { isActive: true } }),
    getLeavePolicy(),
  ]);

  const annualLeaveRules: AnnualLeaveRule[] =
    Array.isArray((leavePolicyRaw as Record<string, unknown>)?.annualLeaveRules)
      ? ((leavePolicyRaw as Record<string, unknown>).annualLeaveRules as AnnualLeaveRule[])
      : [];

  const alType = leaveTypes.find((lt) => lt.code === 'AL');

  // Only process AL (exclude CO — managed via overtime comp-off flow)
  const targetLeaveTypes = leaveTypes.filter((lt) => lt.code === 'AL');

  const results: Array<{ userId: string; fullName: string; annualDays: number; seniorityDays: number }> = [];

  for (const user of users) {
    for (const lt of targetLeaveTypes) {
      let annualDays: number;
      let seniorityDays: number;

      if (lt.code === 'AL') {
        const joinDate = user.companyJoinDate ? new Date(user.companyJoinDate) : null;
        const joinYear = joinDate?.getFullYear();

        // Pro-rata calculation for annual leave
        if (!joinDate) {
          annualDays = 12;
          seniorityDays = 0;
        } else if (joinYear! > year) {
          // Not yet joined in target year → 0 days
          annualDays = 0;
          seniorityDays = 0;
        } else if (joinYear! < year) {
          // Joined before target year → full 12 days + seniority bonus
          annualDays = 12;
          seniorityDays = getSeniorityDays(joinDate, year, annualLeaveRules);
        } else {
          // Joined during target year → pro-rata by month, no seniority bonus (< 1 year)
          const joinMonth = joinDate.getMonth(); // 0=Jan
          const monthsWorked = 12 - joinMonth;
          annualDays = Math.round((monthsWorked / 12) * 12 * 10) / 10;
          seniorityDays = 0;
        }
      } else {
        annualDays = 0;
        seniorityDays = 0;
      }

      await prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year } },
        create: { userId: user.id, leaveTypeId: lt.id, year, annualDays, seniorityDays, usedDays: 0 },
        update: { annualDays, seniorityDays },
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
        annualDays: alBalance ? Number(alBalance.annualDays) : 0,
        seniorityDays: alBalance ? Number(alBalance.seniorityDays) : 0,
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

// Fetch all balances for all users (for the "Quản lý phép năm" tab)
// Only includes users with isCountable = true
export async function getAllBalances(year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return prisma.leaveBalance.findMany({
    where: { year: targetYear, user: { isCountable: true } },
    include: {
      leaveType: { select: { code: true, name: true, color: true } },
      user: { select: { id: true, fullName: true, employeeCode: true, department: true } },
    },
    orderBy: [{ user: { fullName: 'asc' } }, { leaveType: { code: 'asc' } }],
  });
}

// Initialize balances for a user (upsert — safe to re-run)
// Only creates AL balance (CO is excluded — managed via overtime comp-off flow)
export async function initializeBalancesForUser(userId: bigint, year: number) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  const targetLeaveTypes = leaveTypes.filter((lt) => lt.code === 'AL');

  await Promise.all(
    targetLeaveTypes.map((lt) =>
      prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: lt.id, year } },
        create: {
          userId,
          leaveTypeId: lt.id,
          year,
          annualDays: 12,
          usedDays: 0,
        },
        update: {}, // don't overwrite existing balance
      }),
    ),
  );
}

// HR/Admin manual adjustment of balance fields
export async function adjustBalance(
  id: bigint,
  data: {
    annualDays?: number;
    carryOverDays?: number;
    seniorityDays?: number;
    compOffDays?: number;
    wfhDays?: number;
  },
) {
  return prisma.leaveBalance.update({ where: { id }, data });
}

// Called inside transaction when leave request is approved
// If targetLeaveTypeId is provided, deduct from that leave type (e.g., deduct from AL when usesAnnualBalance=true)
// isCompOff=true → deduct from usedCompOffDays instead of usedDays
export async function deductBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
  isCompOff?: boolean,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: isCompOff ? { usedCompOffDays: { increment: days } } : { usedDays: { increment: days } },
  });
}

// Called inside transaction when approved request is cancelled/reversed
// If targetLeaveTypeId is provided, restore to that leave type
// isCompOff=true → decrement usedCompOffDays instead of usedDays
export async function restoreBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
  isCompOff?: boolean,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;
  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: isCompOff
      ? { usedCompOffDays: { decrement: days } }
      : { usedDays: { decrement: days } },
  });
}
