import prisma from "../../config/prisma";
import { getPaginationParams, buildMeta } from "../../utils/pagination";
import { UserRole } from "@prisma/client";

const COMP_OFF_INCLUDE = {
  user: { select: { id: true, fullName: true, department: true } },
  overtime: { select: { id: true, date: true, hours: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

function enrichRecord(r: { toDate: Date; totalDays: { toNumber?: () => number } | number | string }) {
  const now = new Date();
  const expireDays = Math.floor((new Date(r.toDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const totalHours = Number(r.totalDays) * 8;
  const derivedStatus = expireDays < 0 ? "expired" : expireDays < 30 ? "expiring" : "available";
  return { totalHours, expireDays, derivedStatus };
}

export async function getCompOffs(
  user: { id: bigint; role: UserRole },
  query: Record<string, unknown>
) {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = {};
  if (user.role === "EMPLOYEE") {
    where.userId = user.id;
  } else if (user.role === "MANAGER") {
    where.user = { OR: [{ id: user.id }, { managerId: user.id }] };
  }
  if (query.userId && user.role !== "EMPLOYEE") where.userId = BigInt(String(query.userId));
  if (query.status) where.status = query.status;

  const orderBy: Record<string, string> = {};
  if (query.sortBy === "expiry_asc") orderBy.toDate = "asc";
  else if (query.sortBy === "expiry_desc") orderBy.toDate = "desc";
  else if (query.sortBy === "hours_desc") orderBy.totalDays = "desc";
  else orderBy.createdAt = "desc";

  const [records, total] = await Promise.all([
    prisma.compOffRecord.findMany({ where, include: COMP_OFF_INCLUDE, skip, take: limit, orderBy }),
    prisma.compOffRecord.count({ where }),
  ]);

  return {
    data: records.map((r) => ({ ...r, ...enrichRecord(r) })),
    meta: buildMeta(total, page, limit),
  };
}

export async function getCompOffById(id: bigint, user: { id: bigint; role: UserRole }) {
  const record = await prisma.compOffRecord.findUnique({ where: { id }, include: COMP_OFF_INCLUDE });
  if (!record) throw Object.assign(new Error("Comp-off record not found"), { status: 404 });
  if (user.role === "EMPLOYEE" && record.userId !== user.id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return { ...record, ...enrichRecord(record) };
}

export async function getCompOffSummary(userId: bigint) {
  const records = await prisma.compOffRecord.findMany({
    where: { userId, status: "APPROVED" },
  });

  const now = new Date();
  const totalHours = records.reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);
  const expiredHours = records
    .filter((r) => new Date(r.toDate) < now)
    .reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);
  const expiringHours = records
    .filter((r) => {
      const days = Math.floor((new Date(r.toDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days < 30;
    })
    .reduce((sum, r) => sum + Number(r.totalDays) * 8, 0);

  return { totalHours, expiredHours, expiringHours, availableHours: totalHours - expiredHours };
}

export async function createCompOff(
  userId: bigint,
  data: { fromDate: string; toDate: string; totalDays: number; reason: string; overtimeId?: string }
) {
  return prisma.compOffRecord.create({
    data: {
      userId,
      overtimeId: data.overtimeId ? BigInt(data.overtimeId) : null,
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      totalDays: data.totalDays,
      reason: data.reason,
      status: "PENDING",
    },
    include: COMP_OFF_INCLUDE,
  });
}

export async function approveCompOff(id: bigint, approverId: bigint) {
  const record = await prisma.compOffRecord.findUnique({ where: { id } });
  if (!record || record.status !== "PENDING") {
    throw Object.assign(new Error("Cannot approve: record not found or not pending"), { status: 400 });
  }
  return prisma.compOffRecord.update({
    where: { id },
    data: { status: "APPROVED", approverId, approvedAt: new Date() },
  });
}

export async function rejectCompOff(id: bigint, approverId: bigint) {
  const record = await prisma.compOffRecord.findUnique({ where: { id } });
  if (!record || record.status !== "PENDING") {
    throw Object.assign(new Error("Cannot reject: record not found or not pending"), { status: 400 });
  }
  return prisma.compOffRecord.update({
    where: { id },
    data: { status: "REJECTED", approverId, approvedAt: new Date() },
  });
}
