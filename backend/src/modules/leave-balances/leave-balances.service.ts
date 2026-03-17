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
    usedCarryOverDays?: number;
    usedDays?: number;
    usedCompOffDays?: number;
  },
) {
  return prisma.leaveBalance.update({ where: { id }, data });
}

/**
 * Parse a "MM-DD" string + year into a Date at midnight (local).
 * Returns null if the string is malformed.
 */
function parseResetCarryOverDate(mmdd: string | undefined, year: number): Date | null {
  if (!mmdd) return null;
  const parts = mmdd.split('-');
  if (parts.length !== 2) return null;
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  if (!month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Called inside transaction when leave request is approved
// If targetLeaveTypeId is provided, deduct from that leave type (e.g., deduct from AL when usesAnnualBalance=true)
// isCompOff=true → deduct from usedCompOffDays instead of usedDays
// fromDate + resetCarryOverDate → carry-over logic for AL deductions
export async function deductBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
  isCompOff?: boolean,
  fromDate?: Date,
  resetCarryOverDate?: string,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;

  if (isCompOff) {
    await tx.leaveBalance.updateMany({
      where: { userId, leaveTypeId: actualLeaveTypeId, year },
      data: { usedCompOffDays: { increment: days } },
    });
    return;
  }

  // Carry-over logic: if fromDate is before the reset date and carry-over remains, use it first
  const resetDate = parseResetCarryOverDate(resetCarryOverDate, year);
  if (fromDate && resetDate && fromDate < resetDate) {
    const balance = await tx.leaveBalance.findFirst({
      where: { userId, leaveTypeId: actualLeaveTypeId, year },
      select: { carryOverDays: true, usedCarryOverDays: true },
    });
    if (balance) {
      const remainingCarryOver = Math.max(
        0,
        Number(balance.carryOverDays) - Number(balance.usedCarryOverDays),
      );
      if (remainingCarryOver > 0) {
        const takeFromCarryOver = Math.min(remainingCarryOver, days);
        const takeFromUsed = days - takeFromCarryOver;
        await tx.leaveBalance.updateMany({
          where: { userId, leaveTypeId: actualLeaveTypeId, year },
          data: {
            usedCarryOverDays: { increment: takeFromCarryOver },
            ...(takeFromUsed > 0 ? { usedDays: { increment: takeFromUsed } } : {}),
          },
        });
        return;
      }
    }
  }

  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: { usedDays: { increment: days } },
  });
}

// Called inside transaction when approved request is cancelled/reversed
// If targetLeaveTypeId is provided, restore to that leave type
// isCompOff=true → decrement usedCompOffDays instead of usedDays
// fromDate + resetCarryOverDate → reverse carry-over logic
export async function restoreBalance(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: bigint,
  leaveTypeId: bigint,
  days: number,
  year: number,
  targetLeaveTypeId?: bigint,
  isCompOff?: boolean,
  fromDate?: Date,
  resetCarryOverDate?: string,
) {
  const actualLeaveTypeId = targetLeaveTypeId ?? leaveTypeId;

  if (isCompOff) {
    await tx.leaveBalance.updateMany({
      where: { userId, leaveTypeId: actualLeaveTypeId, year },
      data: { usedCompOffDays: { decrement: days } },
    });
    return;
  }

  // Reverse carry-over logic: restore to same buckets that were deducted
  const resetDate = parseResetCarryOverDate(resetCarryOverDate, year);
  if (fromDate && resetDate && fromDate < resetDate) {
    const balance = await tx.leaveBalance.findFirst({
      where: { userId, leaveTypeId: actualLeaveTypeId, year },
      select: { usedCarryOverDays: true, usedDays: true },
    });
    if (balance) {
      const restoreToCarryOver = Math.min(days, Number(balance.usedCarryOverDays));
      const restoreToUsed = days - restoreToCarryOver;
      await tx.leaveBalance.updateMany({
        where: { userId, leaveTypeId: actualLeaveTypeId, year },
        data: {
          usedCarryOverDays: { decrement: restoreToCarryOver },
          ...(restoreToUsed > 0 ? { usedDays: { decrement: restoreToUsed } } : {}),
        },
      });
      return;
    }
  }

  await tx.leaveBalance.updateMany({
    where: { userId, leaveTypeId: actualLeaveTypeId, year },
    data: { usedDays: { decrement: days } },
  });
}

// ── Export / Import leave balances ───────────────────────────────────────
import * as XLSX from 'xlsx';

type BalanceImportRow = {
  id?: string | number;
  employee_code?: string;
  full_name?: string;
  department?: string;
  year?: string | number;
  annual_days?: string | number;
  seniority_days?: string | number;
  carry_over_days?: string | number;
  used_carry_over_days?: string | number;
  used_days?: string | number;
  comp_off_days?: string | number;
  used_comp_off_days?: string | number;
  wfh_days?: string | number;
};

type BalanceColumnDefinition = {
  key: keyof BalanceImportRow;
  label: string;
  aliases: string[];
};

const BALANCE_COLUMNS: BalanceColumnDefinition[] = [
  { key: 'id', label: 'ID bản ghi', aliases: ['id', 'record id'] },
  { key: 'employee_code', label: 'Mã nhân viên', aliases: ['employee_code', 'employee code'] },
  { key: 'full_name', label: 'Họ và tên', aliases: ['full_name', 'full name', 'họ tên'] },
  { key: 'department', label: 'Phòng ban', aliases: ['department'] },
  { key: 'year', label: 'Năm', aliases: ['year'] },
  { key: 'annual_days', label: 'Phép năm', aliases: ['annual_days', 'annual days'] },
  { key: 'seniority_days', label: 'Thâm niên', aliases: ['seniority_days', 'seniority days'] },
  {
    key: 'carry_over_days',
    label: 'Phép chuyển năm trước',
    aliases: ['carry_over_days', 'carry over days'],
  },
  {
    key: 'used_carry_over_days',
    label: 'Đã dùng phép chuyển',
    aliases: ['used_carry_over_days', 'used carry over days'],
  },
  { key: 'used_days', label: 'Đã dùng phép năm', aliases: ['used_days', 'used days'] },
  { key: 'comp_off_days', label: 'Bù công', aliases: ['comp_off_days', 'comp off days'] },
  {
    key: 'used_comp_off_days',
    label: 'Đã dùng bù công',
    aliases: ['used_comp_off_days', 'used comp off days'],
  },
  { key: 'wfh_days', label: 'WFH', aliases: ['wfh_days', 'wfh days'] },
];

const BALANCE_EXPORT_HEADERS = BALANCE_COLUMNS.map((column) => column.label);

function normalizeImportHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function remapSheetRows<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
  columns: Array<{ key: keyof T; label: string; aliases: string[] }>,
) {
  const aliasMap = new Map<string, keyof T>();

  columns.forEach((column) => {
    [column.label, ...column.aliases].forEach((alias) => {
      aliasMap.set(normalizeImportHeader(alias), column.key);
    });
  });

  return rows.map((row) => {
    const mapped = {} as T;

    Object.entries(row).forEach(([rawKey, value]) => {
      const targetKey = aliasMap.get(normalizeImportHeader(rawKey));
      if (targetKey) {
        mapped[targetKey] = value as T[keyof T];
      }
    });

    return mapped;
  });
}

export async function exportLeaveBalancesExcel(year?: number): Promise<Buffer> {
  const targetYear = year ?? new Date().getFullYear();
  const balances = await getAllBalances(targetYear);

  const rows = balances.map((balance) => ({
    'ID bản ghi': String(balance.id),
    'Mã nhân viên': balance.user.employeeCode ?? '',
    'Họ và tên': balance.user.fullName,
    'Phòng ban': balance.user.department ?? '',
    Năm: balance.year,
    'Phép năm': Number(balance.annualDays),
    'Thâm niên': Number(balance.seniorityDays),
    'Phép chuyển năm trước': Number(balance.carryOverDays),
    'Đã dùng phép chuyển': Number(balance.usedCarryOverDays ?? 0),
    'Đã dùng phép năm': Number(balance.usedDays),
    'Bù công': Number(balance.compOffDays),
    'Đã dùng bù công': Number(balance.usedCompOffDays),
    WFH: Number(balance.wfhDays),
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: BALANCE_EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LeaveBalances');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export async function importLeaveBalancesExcel(fileBuffer: Buffer): Promise<{
  updated: number;
  errors: { row: number; message: string }[];
}> {
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const rawRows = remapSheetRows<BalanceImportRow>(sourceRows, BALANCE_COLUMNS);

  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  const parseNum = (v: string | number | undefined) =>
    v !== '' && v !== undefined ? parseFloat(String(v)) : undefined;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2;

    try {
      if (!row.id) {
        errors.push({ row: rowNum, message: 'ID bản ghi là bắt buộc' });
        continue;
      }

      const targetId = BigInt(String(row.id));
      const data: Record<string, number> = {};
      const annualDays = parseNum(row.annual_days);
      const seniorityDays = parseNum(row.seniority_days);
      const carryOverDays = parseNum(row.carry_over_days);
      const usedCarryOverDays = parseNum(row.used_carry_over_days);
      const usedDays = parseNum(row.used_days);
      const compOffDays = parseNum(row.comp_off_days);
      const usedCompOffDays = parseNum(row.used_comp_off_days);
      const wfhDays = parseNum(row.wfh_days);

      if (annualDays !== undefined && !isNaN(annualDays)) data.annualDays = annualDays;
      if (seniorityDays !== undefined && !isNaN(seniorityDays)) data.seniorityDays = seniorityDays;
      if (carryOverDays !== undefined && !isNaN(carryOverDays)) data.carryOverDays = carryOverDays;
      if (usedCarryOverDays !== undefined && !isNaN(usedCarryOverDays)) data.usedCarryOverDays = usedCarryOverDays;
      if (usedDays !== undefined && !isNaN(usedDays)) data.usedDays = usedDays;
      if (compOffDays !== undefined && !isNaN(compOffDays)) data.compOffDays = compOffDays;
      if (usedCompOffDays !== undefined && !isNaN(usedCompOffDays)) data.usedCompOffDays = usedCompOffDays;
      if (wfhDays !== undefined && !isNaN(wfhDays)) data.wfhDays = wfhDays;

      if (Object.keys(data).length > 0) {
        await prisma.leaveBalance.update({ where: { id: targetId }, data });
        updated++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: rowNum, message: `id=${String(row.id ?? '?')}: ${msg}` });
    }
  }

  return { updated, errors };
}
