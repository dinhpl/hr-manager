import prisma from '../../config/prisma';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import { UserRole } from '@prisma/client';
import {
  buildOvertimeNotification,
  createNotification,
} from '../notifications/notifications.service';
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
  user: { select: { id: true, fullName: true, department: true, managerId: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

type AuthUser = {
  id: bigint;
  role: UserRole;
  username?: string;
};

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

async function resolveApproverIdForUser(userId: bigint) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      manager: { select: { id: true, role: true, isActive: true } },
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (user.manager?.isActive && ['MANAGER', 'HR', 'ADMIN'].includes(user.manager.role)) {
    return user.manager.id;
  }

  const fallbackApprover = await prisma.user.findFirst({
    where: { isActive: true, role: { in: ['HR', 'ADMIN'] } },
    select: { id: true },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });

  if (!fallbackApprover) {
    throw Object.assign(new Error('No overtime approver available'), { status: 400 });
  }

  return fallbackApprover.id;
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
  if (
    user.role === 'MANAGER' &&
    record.userId !== user.id &&
    record.approverId !== user.id &&
    record.user.managerId !== user.id
  ) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  return { ...record, ...enrichRecord(record) };
}

function calcHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) throw Object.assign(new Error('endTime must be after startTime'), { status: 400 });
  return Math.round((mins / 60) * 10) / 10;
}

export async function createOvertime(userId: bigint, data: CreateOvertimeDto) {
  const hours = calcHours(data.startTime, data.endTime);
  const approverId = data.approverId ?? await resolveApproverIdForUser(userId);
  const record = await prisma.overtimeRecord.create({
    data: {
      userId,
      date: new Date(`${data.date}T00:00:00`),
      startTime: data.startTime,
      endTime: data.endTime,
      hours,
      reason: data.reason,
      status: 'PENDING',
      compensationType: data.compensationType,
      approverId,
    },
    include: {
      user: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
    },
  });

  await createNotification(
    buildOvertimeNotification({
      recipientUserId: approverId,
      type: 'OVERTIME_CREATED',
      overtimeId: record.id,
      actorName: record.user.fullName || 'Nhan vien',
      requesterName: record.user.fullName || 'Nhan vien',
      dateLabel: record.date.toLocaleDateString('vi-VN'),
      hours: Number(record.hours),
    }),
  );

  return record;
}

export async function approveOvertime(id: bigint, approver: AuthUser) {
  const record = await prisma.overtimeRecord.findUnique({
    where: { id },
    include: { user: { select: { fullName: true } } },
  });
  if (!record || record.status !== 'PENDING') {
    throw Object.assign(new Error('Cannot approve: record not found or not pending'), {
      status: 400,
    });
  }

  if (approver.role === 'MANAGER' && record.approverId && record.approverId !== approver.id) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  const otType = detectOtType(record.date);
  const isCompOff = record.compensationType === 'COMP_OFF';

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.overtimeRecord.update({
      where: { id },
      data: { status: 'APPROVED', approverId: approver.id, approvedAt: new Date() },
    });

    if (isCompOff) {
      const compOffHours = Number(record.hours) * COMP_OFF_RATE[otType];
      const compOffDays = compOffHours / 8;
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
    }

    const compOffHours = isCompOff ? Number(record.hours) * COMP_OFF_RATE[otType] : 0;
    return { ...updated, otType, compOffHours };
  });

  await createNotification(
    buildOvertimeNotification({
      recipientUserId: record.userId,
      type: 'OVERTIME_APPROVED',
      overtimeId: record.id,
      actorName: approver.username || 'Nguoi duyet',
      requesterName: record.user.fullName || 'Nhan vien',
      dateLabel: record.date.toLocaleDateString('vi-VN'),
      hours: Number(record.hours),
    }),
  );

  return updated;
}

export async function updateOvertime(id: bigint, userId: bigint, data: import('./overtime.validation').UpdateOvertimeDto) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw Object.assign(new Error('Overtime record not found'), { status: 404 });
  if (record.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (record.status !== 'PENDING') throw Object.assign(new Error('Can only edit PENDING records'), { status: 400 });

  const startTime = data.startTime ?? record.startTime ?? '';
  const endTime = data.endTime ?? record.endTime ?? '';
  const hours = startTime && endTime ? calcHours(startTime, endTime) : Number(record.hours);

  return prisma.overtimeRecord.update({
    where: { id },
    data: {
      ...(data.date && { date: new Date(`${data.date}T00:00:00`) }),
      startTime,
      endTime,
      hours,
      ...(data.reason && { reason: data.reason }),
      ...(data.compensationType && { compensationType: data.compensationType }),
      ...(data.approverId && { approverId: data.approverId }),
    },
    include: OVERTIME_INCLUDE,
  });
}

export async function deleteOvertime(id: bigint, userId: bigint) {
  const record = await prisma.overtimeRecord.findUnique({ where: { id } });
  if (!record) throw Object.assign(new Error('Overtime record not found'), { status: 404 });
  if (record.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (record.status !== 'PENDING') throw Object.assign(new Error('Can only delete PENDING records'), { status: 400 });

  return prisma.overtimeRecord.delete({ where: { id } });
}

export async function rejectOvertime(id: bigint, approver: AuthUser) {
  const record = await prisma.overtimeRecord.findUnique({
    where: { id },
    include: { user: { select: { fullName: true } } },
  });
  if (!record || record.status !== 'PENDING') {
    throw Object.assign(new Error('Cannot reject: record not found or not pending'), {
      status: 400,
    });
  }

  if (approver.role === 'MANAGER' && record.approverId && record.approverId !== approver.id) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  const updated = await prisma.overtimeRecord.update({
    where: { id },
    data: { status: 'REJECTED', approverId: approver.id, approvedAt: new Date() },
  });

  await createNotification(
    buildOvertimeNotification({
      recipientUserId: record.userId,
      type: 'OVERTIME_REJECTED',
      overtimeId: record.id,
      actorName: approver.username || 'Nguoi duyet',
      requesterName: record.user.fullName || 'Nhan vien',
      dateLabel: record.date.toLocaleDateString('vi-VN'),
      hours: Number(record.hours),
    }),
  );

  return updated;
}
