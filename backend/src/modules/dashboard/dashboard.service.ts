import prisma from "../../config/prisma";
import { UserRole } from "@prisma/client";

async function getEmployeeSummary(userId: bigint) {
  const year = new Date().getFullYear();

  const [balance, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.leaveBalance.findFirst({
      where: { userId, year, leaveType: { code: "AL" } },
    }),
    prisma.leaveRequest.count({ where: { userId, status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { userId, status: "APPROVED" } }),
    prisma.leaveRequest.count({ where: { userId, status: "REJECTED" } }),
  ]);

  return {
    type: "employee",
    stats: {
      remainingLeaveDays: balance ? Number(balance.totalDays) - Number(balance.usedDays) : 0,
      usedLeaveDays: balance ? Number(balance.usedDays) : 0,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      rejectedRequests: rejectedCount,
    },
  };
}

async function getManagerHRAdminSummary(role: UserRole) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const [totalUsers, pendingRequests, todayRequests, weekApproved, overdueRequests] =
    await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.leaveRequest.count({ where: { status: "PENDING" } }),
      prisma.leaveRequest.count({ where: { createdAt: { gte: today } } }),
      prisma.leaveRequest.count({
        where: { status: "APPROVED", approvedAt: { gte: weekStart } },
      }),
      prisma.leaveRequest.count({
        where: {
          status: "PENDING",
          createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

  return {
    type: role === "ADMIN" ? "admin" : role === "HR" ? "hr" : "manager",
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
  if (user.role === "EMPLOYEE") return getEmployeeSummary(user.id);
  return getManagerHRAdminSummary(user.role);
}

export async function getCalendarData(
  user: { id: bigint; role: UserRole },
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const statusFilter = { in: ["APPROVED", "PENDING"] as ("APPROVED" | "PENDING")[] };
  const where =
    user.role === "EMPLOYEE"
      ? { userId: user.id, fromDate: { lte: end }, toDate: { gte: start }, status: statusFilter }
      : { fromDate: { lte: end }, toDate: { gte: start }, status: statusFilter };

  const requests = await prisma.leaveRequest.findMany({
    where,
    select: { fromDate: true, toDate: true, status: true },
  });

  const calendarMap: Record<string, { approved?: boolean; pending?: boolean }> = {};
  for (const r of requests) {
    const cur = new Date(r.fromDate);
    while (cur <= r.toDate) {
      const key = cur.toISOString().slice(0, 10);
      if (!calendarMap[key]) calendarMap[key] = {};
      if (r.status === "APPROVED") calendarMap[key].approved = true;
      if (r.status === "PENDING") calendarMap[key].pending = true;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return calendarMap;
}

export async function getRecentRequests(user: { id: bigint; role: UserRole }, limit = 10) {
  const where = user.role === "EMPLOYEE" ? { userId: user.id } : {};
  return prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true } },
      leaveType: { select: { id: true, code: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
