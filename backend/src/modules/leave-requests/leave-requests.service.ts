import { Prisma, UserRole } from '@prisma/client';
import prisma from '../../config/prisma';
import {
  countInclusiveVietnamDates,
  formatVietnamDateTime,
  getVietnamDatePart,
  parseVietnamDateTime,
  serializeLeaveRequestDates,
} from '../../utils/date-time';
import { buildMeta, getPaginationParams } from '../../utils/pagination';
import { deductBalance, restoreBalance } from '../leave-balances/leave-balances.service';
import {
  buildLeaveRequestNotification,
  createManyNotifications,
  createNotification,
} from '../notifications/notifications.service';
import { getApprovalFlow, getLeavePolicy } from '../settings/settings.service';
import {
  CreateLeaveRequestDto,
  GetLeaveRequestsQuery,
  UpdateLeaveRequestDto,
} from './leave-requests.validation';

type AuthUser = {
  id: bigint;
  role: UserRole;
};

type LeavePolicySettings = {
  advanceRequestDays?: number;
  maxConsecutiveDays?: number;
};

type ApprovalFlowSettings = {
  autoApproveWFH?: boolean;
  requireDocumentTypes?: string[];
};

const LEAVE_REQUEST_INCLUDE = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      department: true,
      managerId: true,
    },
  },
  leaveType: { select: { id: true, code: true, name: true, color: true } },
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

function calculateTotalDays(data: CreateLeaveRequestDto | UpdateLeaveRequestDto) {
  const startDate = parseVietnamDateTime(data.fromDate);
  const endDate = parseVietnamDateTime(data.toDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw Object.assign(new Error('Invalid leave request dates'), { status: 400 });
  }

  const inclusiveDays = countInclusiveVietnamDates(startDate, endDate);
  const durationMode = data.durationMode ?? 'FULL_DAY';

  if (durationMode === 'HALF_DAY') {
    return inclusiveDays * 0.5;
  }

  if (durationMode === 'HOURLY') {
    if (!data.fromTime || !data.toTime) {
      throw Object.assign(new Error('fromTime and toTime are required for hourly leave'), {
        status: 400,
      });
    }

    const startTime = new Date(`2000-01-01T${data.fromTime}:00`);
    const endTime = new Date(`2000-01-01T${data.toTime}:00`);
    const hours = (endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000);

    if (hours <= 0) {
      throw Object.assign(new Error('toTime must be greater than fromTime'), { status: 400 });
    }

    return hours / 8;
  }

  return inclusiveDays;
}

function getVietnamStartOfToday() {
  const now = new Date();
  const todayDatePart = getVietnamDatePart(now);
  return parseVietnamDateTime(`${todayDatePart} 00:00`);
}

function getLeavePolicySettings(value: unknown): LeavePolicySettings {
  if (!value || typeof value !== 'object') return {};
  return value as LeavePolicySettings;
}

function getApprovalFlowSettings(value: unknown): ApprovalFlowSettings {
  if (!value || typeof value !== 'object') return {};
  return value as ApprovalFlowSettings;
}

function buildScopeFilter(requestingUser: AuthUser, query: GetLeaveRequestsQuery) {
  const and: Prisma.LeaveRequestWhereInput[] = [];

  if (requestingUser.role === 'EMPLOYEE') {
    and.push({ userId: requestingUser.id });
  } else if (requestingUser.role === 'MANAGER') {
    and.push({
      OR: [
        { userId: requestingUser.id },
        { approverId: requestingUser.id },
        { user: { managerId: requestingUser.id } },
      ],
    });
  }

  if (query.userId && requestingUser.role !== 'EMPLOYEE') and.push({ userId: query.userId });
  if (query.leaveTypeId) and.push({ leaveTypeId: query.leaveTypeId });
  if (query.status) and.push({ status: query.status });
  if (query.department) and.push({ user: { department: query.department } });
  if (query.fromDate) and.push({ fromDate: { gte: parseVietnamDateTime(query.fromDate) } });
  if (query.toDate) and.push({ toDate: { lte: parseVietnamDateTime(query.toDate) } });

  return and.length > 0 ? { AND: and } : {};
}

function canViewRequest(
  request: {
    userId: bigint;
    approverId: bigint | null;
    user: { managerId: bigint | null };
  },
  requestingUser: AuthUser,
) {
  if (requestingUser.role === 'ADMIN' || requestingUser.role === 'HR') return true;
  if (requestingUser.role === 'EMPLOYEE') return request.userId === requestingUser.id;
  return (
    request.userId === requestingUser.id ||
    request.approverId === requestingUser.id ||
    request.user.managerId === requestingUser.id
  );
}

function canApproveRequest(
  request: {
    userId: bigint;
    approverId: bigint | null;
    user: { managerId: bigint | null };
  },
  requestingUser: AuthUser,
) {
  if (requestingUser.role === 'ADMIN' || requestingUser.role === 'HR') return true;
  if (requestingUser.role !== 'MANAGER') return false;
  return request.approverId === requestingUser.id;
}

async function validateApprover(approverId: bigint) {
  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { id: true, role: true, isActive: true },
  });

  if (!approver || !approver.isActive) {
    throw Object.assign(new Error('Approver not found'), { status: 400 });
  }

  if (!['MANAGER', 'HR', 'ADMIN'].includes(approver.role)) {
    throw Object.assign(new Error('Approver must have MANAGER, HR, or ADMIN role'), {
      status: 400,
    });
  }

  return approver.id;
}

async function resolveApproverId(
  targetUserId: bigint,
  requestingUser: AuthUser,
  requestedApproverId?: bigint,
) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      isActive: true,
      manager: { select: { id: true, role: true, isActive: true } },
    },
  });

  if (!targetUser || !targetUser.isActive) {
    throw Object.assign(new Error('Target user not found'), { status: 404 });
  }

  if (requestedApproverId && ['ADMIN', 'HR'].includes(requestingUser.role)) {
    const approverId = await validateApprover(requestedApproverId);
    if (approverId === targetUserId) {
      throw Object.assign(new Error('Self-approval is not allowed'), { status: 400 });
    }
    return approverId;
  }

  if (
    targetUser.manager?.isActive &&
    ['MANAGER', 'HR', 'ADMIN'].includes(targetUser.manager.role)
  ) {
    return targetUser.manager.id;
  }

  const fallbackApprover = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: { in: ['HR', 'ADMIN'] },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: { id: true },
  });

  if (!fallbackApprover) {
    throw Object.assign(
      new Error('No valid approver available. Please configure a manager, HR, or admin approver.'),
      { status: 400 },
    );
  }

  return fallbackApprover.id;
}

async function assertNoOverlap(
  userId: bigint,
  fromDate: Date,
  toDate: Date,
  excludeRequestId?: bigint,
) {
  const overlappingRequest = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ['PENDING', 'APPROVED'] },
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: { id: true },
  });

  if (overlappingRequest) {
    throw Object.assign(
      new Error(
        `Leave request overlaps with existing request #${overlappingRequest.id.toString()}`,
      ),
      { status: 400 },
    );
  }
}

async function validateBalanceAvailable(
  userId: bigint,
  leaveTypeId: bigint,
  totalDays: number,
  year: number,
) {
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    select: { totalDays: true, usedDays: true },
  });

  if (!balance) {
    throw Object.assign(new Error('Leave balance has not been initialized for this user.'), {
      status: 400,
    });
  }

  const remainingDays = Number(balance.totalDays) - Number(balance.usedDays);
  if (remainingDays < totalDays) {
    throw Object.assign(
      new Error(
        `Insufficient leave balance. Remaining ${remainingDays} day(s), requested ${totalDays}.`,
      ),
      { status: 400 },
    );
  }
}

async function validateLeaveRequestRules(params: {
  userId: bigint;
  leaveTypeId: bigint;
  fromDate: Date;
  toDate: Date;
  totalDays: number;
  attachmentUrl?: string;
  existingAttachmentUrl?: string | null;
  excludeRequestId?: bigint;
}) {
  const [leaveType, leavePolicyRaw, approvalFlowRaw] = await Promise.all([
    prisma.leaveType.findUnique({
      where: { id: params.leaveTypeId },
      select: { id: true, code: true, isActive: true },
    }),
    getLeavePolicy(),
    getApprovalFlow(),
  ]);

  if (!leaveType || !leaveType.isActive) {
    throw Object.assign(new Error('Leave type not found or inactive'), { status: 400 });
  }

  const leavePolicy = getLeavePolicySettings(leavePolicyRaw);
  const approvalFlow = getApprovalFlowSettings(approvalFlowRaw);
  const inclusiveDays = countInclusiveVietnamDates(params.fromDate, params.toDate);
  const todayStart = getVietnamStartOfToday();

  if (typeof leavePolicy.advanceRequestDays === 'number') {
    const minStartDate = new Date(todayStart);
    minStartDate.setUTCDate(minStartDate.getUTCDate() + leavePolicy.advanceRequestDays);
    if (params.fromDate < minStartDate) {
      throw Object.assign(
        new Error(
          `Requests must be submitted at least ${leavePolicy.advanceRequestDays} day(s) in advance.`,
        ),
        { status: 400 },
      );
    }
  }

  if (
    typeof leavePolicy.maxConsecutiveDays === 'number' &&
    inclusiveDays > leavePolicy.maxConsecutiveDays
  ) {
    throw Object.assign(
      new Error(`Leave request exceeds max consecutive days (${leavePolicy.maxConsecutiveDays}).`),
      { status: 400 },
    );
  }

  const requiredDocumentTypes = approvalFlow.requireDocumentTypes ?? [];
  if (
    requiredDocumentTypes.includes(leaveType.code) &&
    !params.attachmentUrl &&
    !params.existingAttachmentUrl
  ) {
    throw Object.assign(new Error(`Attachment is required for leave type ${leaveType.code}.`), {
      status: 400,
    });
  }

  await assertNoOverlap(params.userId, params.fromDate, params.toDate, params.excludeRequestId);
  await validateBalanceAvailable(
    params.userId,
    params.leaveTypeId,
    params.totalDays,
    Number(getVietnamDatePart(params.fromDate).slice(0, 4)),
  );

  return {
    leaveTypeCode: leaveType.code,
    autoApproveWFH: Boolean(approvalFlow.autoApproveWFH),
  };
}

async function serializeRequestById(tx: Prisma.TransactionClient, id: bigint) {
  const request = await tx.leaveRequest.findUnique({
    where: { id },
    include: LEAVE_REQUEST_INCLUDE,
  });
  if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
  return serializeLeaveRequestDates(request);
}

function getActorName(requestingUser: AuthUser, fallback?: string | null) {
  if (fallback && fallback.trim()) return fallback;
  return requestingUser.role === 'EMPLOYEE' ? 'Nhan vien' : requestingUser.role;
}

export async function getLeaveRequests(requestingUser: AuthUser, query: GetLeaveRequestsQuery) {
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

  return { data: requests.map(serializeLeaveRequestDates), meta: buildMeta(total, page, limit) };
}

export async function getLeaveRequestById(id: bigint, requestingUser: AuthUser) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: LEAVE_REQUEST_INCLUDE,
  });

  if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
  if (!canViewRequest(request, requestingUser)) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  return serializeLeaveRequestDates(request);
}

export async function createLeaveRequest(
  requestingUser: AuthUser,
  data: CreateLeaveRequestDto,
  attachmentUrl?: string,
) {
  const canCreateForOtherUser = requestingUser.role === 'ADMIN';
  const requestedUserId = data.userId;

  if (requestedUserId && requestedUserId !== requestingUser.id && !canCreateForOtherUser) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  const targetUserId =
    canCreateForOtherUser && requestedUserId ? requestedUserId : requestingUser.id;
  const totalDays = data.durationMode ? calculateTotalDays(data) : data.totalDays;
  const fromDate = parseVietnamDateTime(data.fromDate);
  const toDate = parseVietnamDateTime(data.toDate);
  const approverId = await resolveApproverId(targetUserId, requestingUser, data.approverId);

  const ruleResult = await validateLeaveRequestRules({
    userId: targetUserId,
    leaveTypeId: data.leaveTypeId,
    fromDate,
    toDate,
    totalDays,
    attachmentUrl,
  });

  const createdRequest = await prisma.$transaction(async (tx) => {
    const shouldAutoApprove = ruleResult.autoApproveWFH && ruleResult.leaveTypeCode === 'WFH';
    const request = await tx.leaveRequest.create({
      data: {
        userId: targetUserId,
        leaveTypeId: data.leaveTypeId,
        approverId,
        fromDate,
        toDate,
        totalDays,
        reason: data.reason,
        handoverPerson: data.handoverPerson || null,
        status: shouldAutoApprove ? 'APPROVED' : 'PENDING',
        approvedAt: shouldAutoApprove ? new Date() : null,
        approvedNote: shouldAutoApprove ? 'Auto-approved by approval flow setting.' : null,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      },
    });

    if (shouldAutoApprove) {
      await deductBalance(
        tx,
        targetUserId,
        data.leaveTypeId,
        totalDays,
        Number(getVietnamDatePart(fromDate).slice(0, 4)),
      );
    }

    return serializeRequestById(tx, request.id);
  });

  if (createdRequest.status === 'APPROVED') {
    await createNotification(
      buildLeaveRequestNotification({
        recipientUserId: BigInt(createdRequest.user.id),
        type: 'LEAVE_REQUEST_APPROVED',
        requestId: BigInt(createdRequest.id),
        actorName: createdRequest.approver?.fullName || 'He thong',
        requesterName: createdRequest.user?.fullName || 'Nhan vien',
        leaveTypeName:
          createdRequest.leaveType?.name || createdRequest.leaveType?.code || 'nghi phep',
        fromDateLabel: getVietnamDatePart(parseVietnamDateTime(createdRequest.fromDate)),
        toDateLabel: getVietnamDatePart(parseVietnamDateTime(createdRequest.toDate)),
      }),
    );
  } else if (createdRequest.approver?.id) {
    await createNotification(
      buildLeaveRequestNotification({
        recipientUserId: BigInt(createdRequest.approver.id),
        type: 'LEAVE_REQUEST_CREATED',
        requestId: BigInt(createdRequest.id),
        actorName: createdRequest.user?.fullName || 'Nhan vien',
        requesterName: createdRequest.user?.fullName || 'Nhan vien',
        leaveTypeName:
          createdRequest.leaveType?.name || createdRequest.leaveType?.code || 'nghi phep',
        fromDateLabel: getVietnamDatePart(parseVietnamDateTime(createdRequest.fromDate)),
        toDateLabel: getVietnamDatePart(parseVietnamDateTime(createdRequest.toDate)),
      }),
    );
  }

  return createdRequest;
}

export async function updateLeaveRequest(
  id: bigint,
  requestingUser: AuthUser,
  data: UpdateLeaveRequestDto,
  attachmentUrl?: string,
) {
  const existingRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: LEAVE_REQUEST_INCLUDE,
  });

  if (!existingRequest) throw Object.assign(new Error('Leave request not found'), { status: 404 });
  if (existingRequest.status !== 'PENDING') {
    throw Object.assign(new Error('Only PENDING requests can be updated'), { status: 400 });
  }

  const canUpdate = requestingUser.role === 'ADMIN' || existingRequest.userId === requestingUser.id;
  if (!canUpdate) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  const targetUserId =
    requestingUser.role === 'ADMIN' && data.userId ? data.userId : existingRequest.userId;
  const totalDays = data.durationMode ? calculateTotalDays(data) : data.totalDays;
  const fromDate = parseVietnamDateTime(data.fromDate);
  const toDate = parseVietnamDateTime(data.toDate);
  const approverId = await resolveApproverId(
    targetUserId,
    requestingUser,
    data.approverId ?? existingRequest.approverId ?? undefined,
  );

  await validateLeaveRequestRules({
    userId: targetUserId,
    leaveTypeId: data.leaveTypeId,
    fromDate,
    toDate,
    totalDays,
    attachmentUrl,
    existingAttachmentUrl: existingRequest.attachmentUrl,
    excludeRequestId: id,
  });

  const updatedRequest = await prisma.leaveRequest.update({
    where: { id },
    data: {
      userId: targetUserId,
      leaveTypeId: data.leaveTypeId,
      approverId,
      fromDate,
      toDate,
      totalDays,
      reason: data.reason,
      handoverPerson: data.handoverPerson || null,
      ...(attachmentUrl ? { attachmentUrl } : {}),
    },
    include: LEAVE_REQUEST_INCLUDE,
  });

  return serializeLeaveRequestDates(updatedRequest);
}

export async function approveLeaveRequest(id: bigint, requestingUser: AuthUser, note?: string) {
  const approvedRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_INCLUDE,
    });
    if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
    if (request.status !== 'PENDING') {
      throw Object.assign(new Error('Only PENDING requests can be approved'), { status: 400 });
    }
    if (!canApproveRequest(request, requestingUser)) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    const balance = await tx.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: request.userId,
          leaveTypeId: request.leaveTypeId,
          year: Number(getVietnamDatePart(request.fromDate).slice(0, 4)),
        },
      },
      select: { totalDays: true, usedDays: true },
    });

    if (!balance) {
      throw Object.assign(new Error('Leave balance has not been initialized for this user.'), {
        status: 400,
      });
    }

    const remainingDays = Number(balance.totalDays) - Number(balance.usedDays);
    if (remainingDays < Number(request.totalDays)) {
      throw Object.assign(
        new Error(
          `Insufficient leave balance. Remaining ${remainingDays} day(s), requested ${Number(request.totalDays)}.`,
        ),
        { status: 400 },
      );
    }

    await tx.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: requestingUser.id,
        approvedAt: new Date(),
        approvedNote: note,
      },
    });

    await deductBalance(
      tx,
      request.userId,
      request.leaveTypeId,
      Number(request.totalDays),
      Number(getVietnamDatePart(request.fromDate).slice(0, 4)),
    );

    return serializeRequestById(tx, id);
  });

  await createNotification(
    buildLeaveRequestNotification({
      recipientUserId: BigInt(approvedRequest.user.id),
      type: 'LEAVE_REQUEST_APPROVED',
      requestId: BigInt(approvedRequest.id),
      actorName: getActorName(requestingUser, approvedRequest.approver?.fullName),
      requesterName: approvedRequest.user.fullName || 'Nhan vien',
      leaveTypeName:
        approvedRequest.leaveType?.name || approvedRequest.leaveType?.code || 'nghi phep',
      fromDateLabel: getVietnamDatePart(parseVietnamDateTime(approvedRequest.fromDate)),
      toDateLabel: getVietnamDatePart(parseVietnamDateTime(approvedRequest.toDate)),
    }),
  );

  return approvedRequest;
}

export async function rejectLeaveRequest(id: bigint, requestingUser: AuthUser, note?: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: LEAVE_REQUEST_INCLUDE,
  });
  if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Only PENDING requests can be rejected'), { status: 400 });
  }
  if (!canApproveRequest(request, requestingUser)) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  const updatedRequest = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      approverId: requestingUser.id,
      approvedAt: new Date(),
      approvedNote: note,
    },
    include: LEAVE_REQUEST_INCLUDE,
  });

  const serializedRequest = serializeLeaveRequestDates(updatedRequest);

  await createNotification(
    buildLeaveRequestNotification({
      recipientUserId: BigInt(serializedRequest.user.id),
      type: 'LEAVE_REQUEST_REJECTED',
      requestId: BigInt(serializedRequest.id),
      actorName: getActorName(requestingUser, serializedRequest.approver?.fullName),
      requesterName: serializedRequest.user.fullName || 'Nhan vien',
      leaveTypeName:
        serializedRequest.leaveType?.name || serializedRequest.leaveType?.code || 'nghi phep',
      fromDateLabel: getVietnamDatePart(parseVietnamDateTime(serializedRequest.fromDate)),
      toDateLabel: getVietnamDatePart(parseVietnamDateTime(serializedRequest.toDate)),
    }),
  );

  return serializedRequest;
}

export async function cancelLeaveRequest(id: bigint, requestingUser: AuthUser) {
  const cancelledRequest = await prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_INCLUDE,
    });
    if (!request) throw Object.assign(new Error('Leave request not found'), { status: 404 });

    const canCancel =
      requestingUser.role === 'ADMIN' ||
      requestingUser.role === 'HR' ||
      (request.userId === requestingUser.id && request.status === 'PENDING');
    if (!canCancel) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    if (!['PENDING', 'APPROVED'].includes(request.status)) {
      throw Object.assign(new Error('Only PENDING or APPROVED requests can be cancelled'), {
        status: 400,
      });
    }

    if (request.status === 'APPROVED' && !['ADMIN', 'HR'].includes(requestingUser.role)) {
      throw Object.assign(new Error('Only HR or admin can cancel APPROVED requests'), {
        status: 403,
      });
    }

    await tx.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    if (request.status === 'APPROVED') {
      await restoreBalance(
        tx,
        request.userId,
        request.leaveTypeId,
        Number(request.totalDays),
        Number(getVietnamDatePart(request.fromDate).slice(0, 4)),
      );
    }

    return serializeRequestById(tx, id);
  });

  const recipientIds = new Set<string>();
  if (cancelledRequest.user?.id) recipientIds.add(cancelledRequest.user.id.toString());
  if (cancelledRequest.approver?.id) recipientIds.add(cancelledRequest.approver.id.toString());

  await createManyNotifications(
    Array.from(recipientIds).map((recipientId) =>
      buildLeaveRequestNotification({
        recipientUserId: BigInt(recipientId),
        type: 'LEAVE_REQUEST_CANCELLED',
        requestId: BigInt(cancelledRequest.id),
        actorName:
          cancelledRequest.user?.id === requestingUser.id
            ? cancelledRequest.user?.fullName || 'Nhan vien'
            : getActorName(requestingUser),
        requesterName: cancelledRequest.user?.fullName || 'Nhan vien',
        leaveTypeName:
          cancelledRequest.leaveType?.name || cancelledRequest.leaveType?.code || 'nghi phep',
        fromDateLabel: getVietnamDatePart(parseVietnamDateTime(cancelledRequest.fromDate)),
        toDateLabel: getVietnamDatePart(parseVietnamDateTime(cancelledRequest.toDate)),
      }),
    ),
  );

  return cancelledRequest;
}

export async function bulkApproveLeaveRequests(
  ids: bigint[],
  requestingUser: AuthUser,
  note?: string,
) {
  const approvedRequests = await prisma.$transaction(async (tx) => {
    const requests = await tx.leaveRequest.findMany({
      where: { id: { in: ids } },
      include: LEAVE_REQUEST_INCLUDE,
    });

    if (requests.length !== ids.length) {
      throw Object.assign(new Error('Some leave requests were not found'), { status: 404 });
    }

    const pendingRequests = requests.filter((request) => request.status === 'PENDING');
    if (pendingRequests.length !== requests.length) {
      throw Object.assign(new Error('Bulk approve only supports PENDING requests'), {
        status: 400,
      });
    }

    const forbiddenRequest = pendingRequests.find(
      (request) => !canApproveRequest(request, requestingUser),
    );
    if (forbiddenRequest) {
      throw Object.assign(
        new Error(`Access denied for leave request #${forbiddenRequest.id.toString()}`),
        { status: 403 },
      );
    }

    for (const request of pendingRequests) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: request.userId,
            leaveTypeId: request.leaveTypeId,
            year: Number(getVietnamDatePart(request.fromDate).slice(0, 4)),
          },
        },
        select: { totalDays: true, usedDays: true },
      });

      if (!balance) {
        throw Object.assign(
          new Error(
            `Leave balance has not been initialized for request #${request.id.toString()}.`,
          ),
          { status: 400 },
        );
      }

      const remainingDays = Number(balance.totalDays) - Number(balance.usedDays);
      if (remainingDays < Number(request.totalDays)) {
        throw Object.assign(
          new Error(
            `Insufficient leave balance for request #${request.id.toString()}. Remaining ${remainingDays} day(s).`,
          ),
          { status: 400 },
        );
      }

      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approverId: requestingUser.id,
          approvedAt: new Date(),
          approvedNote: note,
        },
      });

      await deductBalance(
        tx,
        request.userId,
        request.leaveTypeId,
        Number(request.totalDays),
        Number(getVietnamDatePart(request.fromDate).slice(0, 4)),
      );
    }

    const serializedRequests = await Promise.all(
      pendingRequests.map((request) => serializeRequestById(tx, request.id)),
    );

    return serializedRequests;
  });

  await createManyNotifications(
    approvedRequests.map((request) =>
      buildLeaveRequestNotification({
        recipientUserId: BigInt(request.user.id),
        type: 'LEAVE_REQUEST_APPROVED',
        requestId: BigInt(request.id),
        actorName: getActorName(requestingUser),
        requesterName: request.user.fullName || 'Nhan vien',
        leaveTypeName: request.leaveType?.name || request.leaveType?.code || 'nghi phep',
        fromDateLabel: getVietnamDatePart(parseVietnamDateTime(request.fromDate)),
        toDateLabel: getVietnamDatePart(parseVietnamDateTime(request.toDate)),
      }),
    ),
  );

  return { approved: approvedRequests.length, skipped: 0 };
}

export function getLeaveRequestTimeSummary(value: Date | string | null | undefined) {
  return formatVietnamDateTime(value);
}
