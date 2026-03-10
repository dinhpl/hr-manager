import prisma from '../../config/prisma';
import { UserRole } from '@prisma/client';
import { serializeLeaveRequestDates } from '../../utils/date-time';

function buildManagerLeaveScope(userId: bigint) {
  return {
    OR: [{ userId }, { approverId: userId }, { user: { managerId: userId } }],
  };
}

function buildManagerUserScope(userId: bigint) {
  return {
    OR: [{ id: userId }, { managerId: userId }],
  };
}

function sanitizeLeaveReasonForViewer<
  T extends {
    userId?: bigint;
    user?: { id?: bigint } | null;
    reason?: string | null;
  },
>(request: T, viewer: { id: bigint; role: UserRole }) {
  if (viewer.role !== 'EMPLOYEE') return request;

  const ownerId = request.userId ?? request.user?.id;
  if (ownerId === viewer.id) return request;

  return {
    ...request,
    reason: null,
  };
}

async function getEmployeeSummary(userId: bigint) {
  const year = new Date().getFullYear();

  const [balance, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.leaveBalance.findFirst({
      where: { userId, year, leaveType: { code: 'AL' } },
    }),
    prisma.leaveRequest.count({ where: { userId, status: 'PENDING' } }),
    prisma.leaveRequest.count({ where: { userId, status: 'APPROVED' } }),
    prisma.leaveRequest.count({ where: { userId, status: 'REJECTED' } }),
  ]);

  return {
    type: 'employee',
    stats: {
      remainingLeaveDays: balance ? Number(balance.totalDays) - Number(balance.usedDays) : 0,
      usedLeaveDays: balance ? Number(balance.usedDays) : 0,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      rejectedRequests: rejectedCount,
    },
  };
}

async function getManagerHRAdminSummary(user: { id: bigint; role: UserRole }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const leaveScope = user.role === 'MANAGER' ? buildManagerLeaveScope(user.id) : {};
  const userScope = user.role === 'MANAGER' ? buildManagerUserScope(user.id) : {};

  const [totalUsers, pendingRequests, todayRequests, weekApproved, overdueRequests] =
    await Promise.all([
      prisma.user.count({ where: { isActive: true, ...userScope } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING', ...leaveScope } }),
      prisma.leaveRequest.count({ where: { createdAt: { gte: today }, ...leaveScope } }),
      prisma.leaveRequest.count({
        where: { status: 'APPROVED', approvedAt: { gte: weekStart }, ...leaveScope },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'PENDING',
          createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
          ...leaveScope,
        },
      }),
    ]);

  return {
    type: user.role === 'ADMIN' ? 'admin' : user.role === 'HR' ? 'hr' : 'manager',
    stats: {
      totalEmployees: totalUsers,
      pendingRequests,
      todayRequests,
      weekApproved,
      overdueRequests,
    },
  };
}

export async function getDashboardSummary(user: { id: bigint; role: UserRole }) {
  if (user.role === 'EMPLOYEE') return getEmployeeSummary(user.id);
  return getManagerHRAdminSummary(user);
}

export async function getCalendarData(
  user: { id: bigint; role: UserRole },
  year: number,
  month: number,
  scope: 'default' | 'global' = 'default',
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const statusFilter = { in: ['APPROVED', 'PENDING'] as ('APPROVED' | 'PENDING')[] };
  const where =
    scope === 'global'
      ? { fromDate: { lte: end }, toDate: { gte: start }, status: statusFilter }
      : user.role === 'EMPLOYEE'
        ? { userId: user.id, fromDate: { lte: end }, toDate: { gte: start }, status: statusFilter }
        : user.role === 'MANAGER'
          ? {
              fromDate: { lte: end },
              toDate: { gte: start },
              status: statusFilter,
              ...buildManagerLeaveScope(user.id),
            }
          : { fromDate: { lte: end }, toDate: { gte: start }, status: statusFilter };

  const requests = await prisma.leaveRequest.findMany({
    where,
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      status: true,
      reason: true,
      user: { select: { id: true, fullName: true, username: true, department: true } },
      leaveType: { select: { code: true, name: true, color: true } },
      approver: { select: { fullName: true } },
    },
  });

  // Build map: dateStr → list of { name, status, reason, leaveType, approver } entries per user per day
  type CalendarUser = {
    requestId: string;
    name: string;
    status: 'approved' | 'pending';
    reason?: string;
    leaveType?: { code: string; name: string; color: string };
    approver?: string;
    department?: string | null;
  };
  const calendarMap: Record<string, { users: CalendarUser[] }> = {};

  for (const r of requests) {
    const safeRequest = sanitizeLeaveReasonForViewer(r, user);
    const userName = r.user?.fullName?.trim() || r.user?.username || 'NV';
    const status: 'approved' | 'pending' = r.status === 'APPROVED' ? 'approved' : 'pending';
    const leaveType = r.leaveType
      ? { code: r.leaveType.code, name: r.leaveType.name, color: r.leaveType.color }
      : undefined;
    const approver = r.approver?.fullName;

    const cur = new Date(r.fromDate);
    while (cur <= r.toDate) {
      const key = cur.toISOString().slice(0, 10);
      if (!calendarMap[key]) calendarMap[key] = { users: [] };
      // Avoid duplicate same user on same day (edge case: overlapping requests)
      const alreadyAdded = calendarMap[key].users.some(
        (u) => u.name === userName && u.status === status,
      );
      if (!alreadyAdded) {
        calendarMap[key].users.push({
          requestId: r.id.toString(),
          name: userName,
          status,
          reason: safeRequest.reason || undefined,
          leaveType,
          approver,
          department: r.user?.department,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return calendarMap;
}

export async function getRecentRequests(
  user: { id: bigint; role: UserRole },
  limit = 10,
  scope: 'default' | 'global' = 'default',
) {
  const where =
    scope === 'global'
      ? {}
      : user.role === 'EMPLOYEE'
        ? { userId: user.id }
        : user.role === 'MANAGER'
          ? buildManagerLeaveScope(user.id)
          : {};
  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true, avatar: true } },
      leaveType: { select: { id: true, code: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return requests.map((request) =>
    serializeLeaveRequestDates(sanitizeLeaveReasonForViewer(request, user)),
  );
}
