import prisma from '../../config/prisma';
import { deductBalance, restoreBalance } from '../leave-balances/leave-balances.service';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import { UserRole } from '@prisma/client';
import { GetLeaveRequestsQuery, CreateLeaveRequestDto } from './leave-requests.validation';

const LEAVE_REQUEST_INCLUDE = {
  user: { select: { id: true, fullName: true, username: true, department: true } },
  leaveType: { select: { id: true, code: true, name: true, color: true } },
  approver: { select: { id: true, fullName: true } },
} as const;

// Build Prisma where clause scoped to the requesting user's role
function buildScopeFilter(
  requestingUser: { id: bigint; role: UserRole },
  query: GetLeaveRequestsQuery,
) {
  const where: Record<string, unknown> = {};

  // Role scope
  if (requestingUser.role === 'EMPLOYEE') {
    where.userId = requestingUser.id;
  } else if (requestingUser.role === 'MANAGER') {
    // Manager sees own + direct subordinates
    where.user = { OR: [{ id: requestingUser.id }, { managerId: requestingUser.id }] };
  }
  // HR/ADMIN: no scope restriction

  // Query filters (HR/ADMIN can filter by any user)
  if (query.userId && requestingUser.role !== 'EMPLOYEE') where.userId = query.userId;
  if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
  if (query.status) where.status = query.status;
  if (query.department) {
    // merge with existing user filter
    where.user = { ...((where.user as object) ?? {}), department: query.department };
  }
  if (query.fromDate) where.fromDate = { gte: new Date(query.fromDate) };
  if (query.toDate) where.toDate = { lte: new Date(query.toDate) };

  return where;
}

export async function getLeaveRequests(
  requestingUser: { id: bigint; role: UserRole },
  query: GetLeaveRequestsQuery,
) {
  const { page, limit, skip } = getPaginationParams(query);
  const where = buildScopeFilter(requestingUser, query);

  const [requests, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: LEAVE_REQUEST_INCLUDE,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { data: requests, meta: buildMeta(total, page, limit) };
}

export async function getLeaveRequestById(
  id: bigint,
  requestingUser: { id: bigint; role: UserRole },
) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: LEAVE_REQUEST_INCLUDE,
  });

  if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });

  // EMPLOYEE can only view own requests
  if (requestingUser.role === 'EMPLOYEE' && request.userId !== requestingUser.id) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return request;
}

export async function createLeaveRequest(
  userId: bigint,
  data: CreateLeaveRequestDto,
  attachmentUrl?: string,
) {
  return prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeId: data.leaveTypeId,
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      totalDays: data.totalDays,
      reason: data.reason,
      status: 'PENDING',
      ...(attachmentUrl && { attachmentUrl }),
    },
    include: LEAVE_REQUEST_INCLUDE,
  });
}

export async function approveLeaveRequest(id: bigint, approverId: bigint, note?: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({ where: { id } });
    if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
    if (request.status !== 'PENDING') {
      throw Object.assign(new Error('Only PENDING requests can be approved'), { status: 400 });
    }

    const updated = await tx.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approverId, approvedAt: new Date(), approvedNote: note },
      include: LEAVE_REQUEST_INCLUDE,
    });

    // Deduct leave balance within same transaction
    await deductBalance(
      tx,
      request.userId,
      request.leaveTypeId,
      Number(request.totalDays),
      new Date(request.fromDate).getFullYear(),
    );

    return updated;
  });
}

export async function rejectLeaveRequest(id: bigint, approverId: bigint, note?: string) {
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Only PENDING requests can be rejected'), { status: 400 });
  }

  return prisma.leaveRequest.update({
    where: { id },
    data: { status: 'REJECTED', approverId, approvedAt: new Date(), approvedNote: note },
    include: LEAVE_REQUEST_INCLUDE,
  });
}

export async function cancelLeaveRequest(
  id: bigint,
  requestingUser: { id: bigint; role: UserRole },
) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({ where: { id } });
    if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });

    // Only owner can cancel
    if (request.userId !== requestingUser.id && requestingUser.role === 'EMPLOYEE') {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    if (!['PENDING'].includes(request.status)) {
      throw Object.assign(new Error('Only PENDING requests can be cancelled'), { status: 400 });
    }

    const updated = await tx.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return updated;
  });
}

export async function bulkApproveLeaveRequests(ids: bigint[], approverId: bigint, note?: string) {
  return prisma.$transaction(async (tx) => {
    // Only PENDING requests
    const requests = await tx.leaveRequest.findMany({
      where: { id: { in: ids }, status: 'PENDING' },
    });

    if (requests.length === 0) {
      throw Object.assign(new Error('No pending requests found'), { status: 400 });
    }

    await tx.leaveRequest.updateMany({
      where: { id: { in: requests.map((r) => r.id) } },
      data: { status: 'APPROVED', approverId, approvedAt: new Date(), approvedNote: note },
    });

    // Deduct balances for all approved requests
    for (const r of requests) {
      await deductBalance(
        tx,
        r.userId,
        r.leaveTypeId,
        Number(r.totalDays),
        new Date(r.fromDate).getFullYear(),
      );
    }

    return { approved: requests.length, skipped: ids.length - requests.length };
  });
}
