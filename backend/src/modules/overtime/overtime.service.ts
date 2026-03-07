import prisma from '../../config/prisma';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import { UserRole } from '@prisma/client';
import { CreateOvertimeDto, GetOvertimeQuery } from './overtime.validation';

const COMP_OFF_RATE: Record<string, number> = {
  weekday: 1,
  weekend: 1.5,
  holiday: 2,
};

function detectOtType(date: Date): 'weekday' | 'weekend' {
  const day = date.getDay();
  return day === 0 || day === 6 ? 'weekend' : 'weekday';
}

const OVERTIME_INCLUDE = {
  user: { select: { id: true, fullName: true, department: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

function buildScopeFilter(user: { id: bigint; role: UserRole }, query: GetOvertimeQuery) {
  const where: Record<string, unknown> = {};

  if (user.role === 'EMPLOYEE') {
    where.userId = user.id;
  } else if (user.role === 'MANAGER') {
    where.user = { OR: [{ id: user.id }, { managerId: user.id }] };
  }

  if (query.userId && user.role !== 'EMPLOYEE') where.userId = query.userId;
  if (query.status) where.status = query.status;

  const dateFilter: Record<string, Date> = {};
  if (query.fromDate) dateFilter.gte = new Date(query.fromDate);
  if (query.toDate) dateFilter.lte = new Date(query.toDate);
  if (Object.keys(dateFilter).length) where.date = dateFilter;

  return where;
}

function enrichRecord(r: { date: Date; hours: { toNumber?: () => number } | number | string }) {
  const otType = detectOtType(r.date);
  const hours =
    typeof r.hours === 'object' && 'toNumber' in (r.hours as object)
      ? (r.hours as { toNumber: () => number }).toNumber()
      : Number(r.hours);
  return { otType, compOffHours: hours * COMP_OFF_RATE[otType] };
}

export async function getOvertimes(user: { id: bigint; role: UserRole }, query: GetOvertimeQuery) {
  const { page, limit, skip } = getPaginationParams(query);
  const where = buildScopeFilter(user, query);

  const [records, total] = await Promise.all([
    prisma.overtimeRecord.findMany({
      where,
      include: OVERTIME_INCLUDE,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.overtimeRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => ({ ...r, ...enrichRecord(r) })),
    meta: buildMeta(total, page, limit),
  };
}

export async function getOvertimeById(id: bigint, user: { id: bigint; role: UserRole }) {
  const record = await prisma.overtimeRecord.findUnique({
    where: { id },
    include: {
      ...OVERTIME_INCLUDE,
      compOffs: true,
    },
  });

  if (!record) throw Object.assign(new Error('Overtime record not found'), { status: 404 });
  if (user.role === 'EMPLOYEE' && record.userId !== user.id) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  return { ...record, ...enrichRecord(record) };
}

export async function createOvertime(userId: bigint, data: CreateOvertimeDto) {
  return prisma.overtimeRecord.create({
    data: {
      userId,
      date: new Date(data.date),
      hours: data.hours,
      reason: data.reason,
      status: 'PENDING',
    },
    include: { user: { select: { id: true, fullName: true } } },
  });
}

export async function approveOvertime(id: bigint, approverId: bigint) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record || record.status !== 'PENDING') {
    throw Object.assign(new Error('Cannot approve: record not found or not pending'), {
      status: 400,
    });
  }

  const otType = detectOtType(record.date);
  const compOffHours = Number(record.hours) * COMP_OFF_RATE[otType];
  const compOffDays = compOffHours / 8;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.overtimeRecord.update({
      where: { id },
      data: { status: 'APPROVED', approverId, approvedAt: new Date() },
    });

    await tx.compOffRecord.create({
      data: {
        userId: record.userId,
        overtimeId: record.id,
        fromDate: new Date(),
        toDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        totalDays: compOffDays,
        reason: `Comp-off từ OT ngày ${record.date.toLocaleDateString('vi-VN')}`,
        status: 'APPROVED',
      },
    });

    return { ...updated, otType, compOffHours };
  });
}

export async function rejectOvertime(id: bigint, approverId: bigint) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record || record.status !== 'PENDING') {
    throw Object.assign(new Error('Cannot reject: record not found or not pending'), {
      status: 400,
    });
  }

  return prisma.overtimeRecord.update({
    where: { id },
    data: { status: 'REJECTED', approverId, approvedAt: new Date() },
  });
}
