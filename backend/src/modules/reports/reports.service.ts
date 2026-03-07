import prisma from "../../config/prisma";

export async function getLeaveReport(query: {
  year: number;
  department?: string;
  leaveTypeId?: bigint;
}) {
  const { year, department, leaveTypeId } = query;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const data = await Promise.all(
    months.map(async (month) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const baseWhere: Record<string, unknown> = {
        status: "APPROVED",
        fromDate: { gte: start },
        toDate: { lte: end },
      };
      if (department) baseWhere.user = { department };
      if (leaveTypeId) baseWhere.leaveTypeId = leaveTypeId;

      const [annualCount, sickCount, wfhCount] = await Promise.all([
        prisma.leaveRequest.count({ where: { ...baseWhere, leaveType: { code: "AL" } } }),
        prisma.leaveRequest.count({ where: { ...baseWhere, leaveType: { code: "SL" } } }),
        prisma.leaveRequest.count({ where: { ...baseWhere, leaveType: { code: "WFH" } } }),
      ]);

      return { month: String(month), annual: annualCount, sick: sickCount, wfh: wfhCount };
    })
  );

  return data;
}

export async function getDepartmentReport(year: number) {
  const departments = await prisma.user.findMany({
    where: { isActive: true, department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  });

  return Promise.all(
    departments.map(async ({ department }) => {
      const [totalDaysAgg, employeeCount, otHoursAgg] = await Promise.all([
        prisma.leaveRequest.aggregate({
          where: {
            status: "APPROVED",
            user: { department: department! },
            fromDate: { gte: new Date(year, 0, 1) },
          },
          _sum: { totalDays: true },
        }),
        prisma.user.count({ where: { department: department!, isActive: true } }),
        prisma.overtimeRecord.aggregate({
          where: {
            status: "APPROVED",
            user: { department: department! },
            date: { gte: new Date(year, 0, 1) },
          },
          _sum: { hours: true },
        }),
      ]);

      return {
        department,
        totalDays: Number(totalDaysAgg._sum.totalDays ?? 0),
        employeeCount,
        otHours: Number(otHoursAgg._sum.hours ?? 0),
      };
    })
  );
}

export async function getTopLeaveUsers(year: number, limit = 10) {
  const balances = await prisma.leaveBalance.findMany({
    where: { year, leaveType: { code: "AL" } },
    include: { user: { select: { fullName: true, department: true } } },
    orderBy: { usedDays: "desc" },
    take: limit,
  });

  return balances.map((b, i) => ({
    rank: i + 1,
    name: b.user.fullName,
    department: b.user.department,
    days: Number(b.usedDays),
    total: Number(b.totalDays),
    pct: Number(b.totalDays) > 0
      ? Math.round((Number(b.usedDays) / Number(b.totalDays)) * 100)
      : 0,
  }));
}

export async function getOvertimeReport(year: number) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return Promise.all(
    months.map(async (month) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const agg = await prisma.overtimeRecord.aggregate({
        where: { status: "APPROVED", date: { gte: start, lte: end } },
        _sum: { hours: true },
        _count: true,
      });

      return {
        month: String(month),
        totalHours: Number(agg._sum.hours ?? 0),
        count: agg._count,
      };
    })
  );
}

export async function exportLeaveReport(year: number): Promise<string> {
  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      fromDate: { gte: new Date(year, 0, 1) },
      toDate: { lte: new Date(year, 11, 31, 23, 59, 59) },
    },
    include: {
      user: { select: { fullName: true, department: true, email: true } },
      leaveType: { select: { code: true, name: true } },
    },
    orderBy: { fromDate: "asc" },
  });

  const header = "Employee,Department,Email,Leave Type,From,To,Days,Status\n";
  const rows = requests
    .map(
      (r) =>
        [
          `"${r.user.fullName}"`,
          `"${r.user.department ?? ""}"`,
          `"${r.user.email}"`,
          `"${r.leaveType.name}"`,
          r.fromDate.toISOString().slice(0, 10),
          r.toDate.toISOString().slice(0, 10),
          Number(r.totalDays),
          r.status,
        ].join(",")
    )
    .join("\n");

  return header + rows;
}
