import { Prisma, UserRole } from '@prisma/client';
import prisma from '../../config/prisma';
import { ReportsQuery } from './reports.validation';

type AuthUser = {
  id: bigint;
  role: UserRole;
};

type DateRange = {
  fromDate: Date;
  toDate: Date;
};

function getDateRange(query: ReportsQuery): DateRange {
  if (query.fromDate && query.toDate) {
    const fromDate = new Date(`${query.fromDate}T00:00:00.000Z`);
    const toDate = new Date(`${query.toDate}T23:59:59.999Z`);

    if (fromDate > toDate) {
      throw Object.assign(new Error('fromDate must be earlier than or equal to toDate'), {
        status: 400,
      });
    }

    return { fromDate, toDate };
  }

  const year = query.year ?? new Date().getFullYear();
  return {
    fromDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    toDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

function buildLeaveScopeWhere(
  user: AuthUser,
  query: ReportsQuery,
  range: DateRange,
): Prisma.LeaveRequestWhereInput {
  const and: Prisma.LeaveRequestWhereInput[] = [
    { status: 'APPROVED' },
    { fromDate: { gte: range.fromDate } },
    { fromDate: { lte: range.toDate } },
  ];

  if (query.department) {
    and.push({ user: { department: query.department } });
  }

  if (query.leaveTypeId) {
    and.push({ leaveTypeId: query.leaveTypeId });
  }

  if (user.role === 'MANAGER') {
    and.push({
      OR: [{ userId: user.id }, { user: { managerId: user.id } }],
    });
  }

  return { AND: and };
}

function buildOvertimeScopeWhere(
  user: AuthUser,
  query: ReportsQuery,
  range: DateRange,
): Prisma.OvertimeRecordWhereInput {
  const and: Prisma.OvertimeRecordWhereInput[] = [
    { status: 'APPROVED' },
    { date: { gte: range.fromDate } },
    { date: { lte: range.toDate } },
  ];

  if (query.department) {
    and.push({ user: { department: query.department } });
  }

  if (user.role === 'MANAGER') {
    and.push({
      OR: [{ userId: user.id }, { user: { managerId: user.id } }],
    });
  }

  return { AND: and };
}

function buildUserScopeWhere(user: AuthUser, query: ReportsQuery): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ isActive: true }];

  if (query.department) {
    and.push({ department: query.department });
  }

  if (user.role === 'MANAGER') {
    and.push({ OR: [{ id: user.id }, { managerId: user.id }] });
  }

  return { AND: and };
}

function getMonthBuckets(range: DateRange) {
  const buckets: Array<{ key: string; start: Date; end: Date }> = [];
  const cursor = new Date(
    Date.UTC(range.fromDate.getUTCFullYear(), range.fromDate.getUTCMonth(), 1),
  );
  const last = new Date(Date.UTC(range.toDate.getUTCFullYear(), range.toDate.getUTCMonth(), 1));

  while (cursor <= last) {
    const start = new Date(cursor);
    const end = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    buckets.push({
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
      start,
      end,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return buckets;
}

export async function getLeaveReport(user: AuthUser, query: ReportsQuery) {
  const range = getDateRange(query);
  const buckets = getMonthBuckets(range);

  return Promise.all(
    buckets.map(async (bucket) => {
      const monthWhere: Prisma.LeaveRequestWhereInput = {
        AND: [
          buildLeaveScopeWhere(user, query, range),
          { fromDate: { gte: bucket.start } },
          { fromDate: { lte: bucket.end } },
        ],
      };

      const [annualCount, sickCount, wfhCount] = await Promise.all([
        prisma.leaveRequest.count({ where: { AND: [monthWhere, { leaveType: { code: 'AL' } }] } }),
        prisma.leaveRequest.count({ where: { AND: [monthWhere, { leaveType: { code: 'SL' } }] } }),
        prisma.leaveRequest.count({ where: { AND: [monthWhere, { leaveType: { code: 'WFH' } }] } }),
      ]);

      return { month: bucket.key, annual: annualCount, sick: sickCount, wfh: wfhCount };
    }),
  );
}

export async function getDepartmentReport(user: AuthUser, query: ReportsQuery) {
  const range = getDateRange(query);
  const [departments, userScopeWhere] = await Promise.all([
    prisma.user.findMany({
      where: buildUserScopeWhere(user, query),
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    }),
    Promise.resolve(buildUserScopeWhere(user, query)),
  ]);

  const departmentNames = departments
    .map((item) => item.department)
    .filter((department): department is string => Boolean(department));

  return Promise.all(
    departmentNames.map(async (department) => {
      const [totalDaysAgg, employeeCount, otHoursAgg] = await Promise.all([
        prisma.leaveRequest.aggregate({
          where: buildLeaveScopeWhere(user, { ...query, department }, range),
          _sum: { totalDays: true },
        }),
        prisma.user.count({ where: { AND: [userScopeWhere, { department }] } }),
        prisma.overtimeRecord.aggregate({
          where: buildOvertimeScopeWhere(user, { ...query, department }, range),
          _sum: { hours: true },
        }),
      ]);

      return {
        department,
        totalDays: Number(totalDaysAgg._sum.totalDays ?? 0),
        employeeCount,
        otHours: Number(otHoursAgg._sum.hours ?? 0),
      };
    }),
  );
}

export async function getTopLeaveUsers(user: AuthUser, query: ReportsQuery) {
  const range = getDateRange(query);
  const requests = await prisma.leaveRequest.groupBy({
    by: ['userId'],
    where: buildLeaveScopeWhere(user, query, range),
    _sum: { totalDays: true },
    orderBy: { _sum: { totalDays: 'desc' } },
    take: query.limit,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: requests.map((item) => item.userId) } },
    select: { id: true, fullName: true, department: true },
  });
  const userMap = new Map(users.map((item) => [item.id.toString(), item]));
  const maxDays = Math.max(...requests.map((item) => Number(item._sum.totalDays ?? 0)), 0);

  return requests.map((item, index) => {
    const matchedUser = userMap.get(item.userId.toString());
    const days = Number(item._sum.totalDays ?? 0);

    return {
      rank: index + 1,
      name: matchedUser?.fullName ?? 'Unknown',
      department: matchedUser?.department ?? null,
      days,
      total: days,
      pct: maxDays > 0 ? Math.round((days / maxDays) * 100) : 0,
    };
  });
}

export async function getOvertimeReport(user: AuthUser, query: ReportsQuery) {
  const range = getDateRange(query);
  const buckets = getMonthBuckets(range);

  return Promise.all(
    buckets.map(async (bucket) => {
      const agg = await prisma.overtimeRecord.aggregate({
        where: {
          AND: [
            buildOvertimeScopeWhere(user, query, range),
            { date: { gte: bucket.start } },
            { date: { lte: bucket.end } },
          ],
        },
        _sum: { hours: true },
        _count: true,
      });

      return {
        month: bucket.key,
        totalHours: Number(agg._sum.hours ?? 0),
        count: agg._count,
      };
    }),
  );
}

export async function exportLeaveReport(user: AuthUser, query: ReportsQuery): Promise<string> {
  const range = getDateRange(query);
  const requests = await prisma.leaveRequest.findMany({
    where: buildLeaveScopeWhere(user, query, range),
    include: {
      user: { select: { fullName: true, department: true, email: true } },
      leaveType: { select: { code: true, name: true } },
    },
    orderBy: { fromDate: 'asc' },
  });

  const header = 'Employee,Department,Email,Leave Type,From,To,Days,Status\n';
  const rows = requests
    .map((request) =>
      [
        `"${request.user.fullName}"`,
        `"${request.user.department ?? ''}"`,
        `"${request.user.email}"`,
        `"${request.leaveType.name}"`,
        request.fromDate.toISOString().slice(0, 10),
        request.toDate.toISOString().slice(0, 10),
        Number(request.totalDays),
        request.status,
      ].join(','),
    )
    .join('\n');

  return header + rows;
}
