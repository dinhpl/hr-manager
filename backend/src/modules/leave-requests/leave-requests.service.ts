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
  mailService,
  sendLeaveRequestApprovedEmail,
  sendLeaveRequestCreatedEmail,
  sendLeaveRequestRejectedEmail,
} from '../mail/mail.service';
import {
  buildLeaveRequestNotification,
  createManyNotifications,
  createNotification,
} from '../notifications/notifications.service';
import { getApprovalFlow, getLeavePolicy } from '../settings/settings.service';
import { getLeaveTypeByCode } from '../leave-types/leave-types.service';
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
  resetCarryOverDate?: string;
};

type ApprovalFlowSettings = {
  autoApproveWFH?: boolean;
  requireDocumentTypes?: string[];
};

const BALANCE_EXEMPT_LEAVE_TYPE_CODES = new Set(['WFH']);

const LEAVE_REQUEST_INCLUDE = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      department: true,
      managerId: true,
      email: true,
    },
  },
  leaveType: {
    select: {
      id: true,
      code: true,
      name: true,
      color: true,
      usesAnnualBalance: true,
      maxConsecutiveDays: true,
    },
  },
  approver: { select: { id: true, fullName: true, email: true } },
  handoverPerson: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

function calculateTotalDays(data: CreateLeaveRequestDto | UpdateLeaveRequestDto) {
  const startDate = parseVietnamDateTime(data.fromDate);
  const endDate = parseVietnamDateTime(data.toDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw Object.assign(new Error('Invalid leave request dates'), { status: 400 });
  }

  const inclusiveDays = countInclusiveVietnamDates(startDate, endDate);
  const durationMode = data.durationMode ?? 'FULL_DAY';

  if (durationMode === 'HALF_DAY_AM' || durationMode === 'HALF_DAY_PM') {
    return inclusiveDays * 0.5;
  }

  return inclusiveDays;
}

function getVietnamStartOfToday() {
  const now = new Date();
  const todayDatePart = getVietnamDatePart(now);
  return parseVietnamDateTime(`${todayDatePart} 00:00`);
}

function shouldEnforceAdvanceRequestDays(
  fromDate: Date,
  todayStart: Date,
  advanceRequestDays?: number,
) {
  return typeof advanceRequestDays === 'number' && advanceRequestDays > 0 && fromDate > todayStart;
}

function getLeavePolicySettings(value: unknown): LeavePolicySettings {
  if (!value || typeof value !== 'object') return {};
  return value as LeavePolicySettings;
}

function getApprovalFlowSettings(value: unknown): ApprovalFlowSettings {
  if (!value || typeof value !== 'object') return {};
  return value as ApprovalFlowSettings;
}

function formatLeaveTotalDaysLabel(totalDays: string | number | Prisma.Decimal) {
  const numericTotalDays = Number(totalDays);
  if (Number.isInteger(numericTotalDays)) {
    return `${numericTotalDays} ngay`;
  }

  return `${numericTotalDays.toFixed(1)} ngay`;
}

async function sendLeaveMailSafely(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error('[mail] Failed to send leave request email', error);
  }
}

function requiresLeaveBalanceCheck(leaveTypeCode?: string | null) {
  return !BALANCE_EXEMPT_LEAVE_TYPE_CODES.has((leaveTypeCode ?? '').toUpperCase());
}

function buildScopeFilter(requestingUser: AuthUser, query: GetLeaveRequestsQuery) {
  const and: Prisma.LeaveRequestWhereInput[] = [];
  const isGlobalScope = query.scope === 'global';

  if (isGlobalScope) {
    // Intentionally skip role-based scoping so the leave history screen can show the same dataset to all members.
  } else if (requestingUser.role === 'EMPLOYEE') {
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

  if (query.userId && (isGlobalScope || requestingUser.role !== 'EMPLOYEE')) {
    and.push({ userId: query.userId });
  }
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
  return Boolean(requestingUser?.id);
}

function sanitizeLeaveRequestForViewer<
  T extends {
    userId?: bigint;
    user?: { id?: bigint } | null;
    reason?: string | null;
  },
>(request: T, requestingUser: AuthUser) {
  const ownerId = request.userId ?? request.user?.id;
  if (ownerId === requestingUser.id) return request;

  return {
    ...request,
    reason: null,
  };
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

  if (requestedApproverId) {
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
  isCompOff?: boolean,
  fromDate?: Date,
  resetCarryOverDate?: string,
) {
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    select: {
      annualDays: true,
      carryOverDays: true,
      usedCarryOverDays: true,
      seniorityDays: true,
      usedDays: true,
      compOffDays: true,
      usedCompOffDays: true,
    },
  });

  if (!balance) {
    throw Object.assign(new Error('Leave balance has not been initialized for this user.'), {
      status: 400,
    });
  }

  const effectiveCarryOver =
    isCompOff || !fromDate
      ? 0
      : computeEffectiveCarryOver(balance, fromDate, resetCarryOverDate, year);

  const remainingDays = isCompOff
    ? Number(balance.compOffDays) - Number(balance.usedCompOffDays)
    : Number(balance.annualDays) +
      effectiveCarryOver +
      Number(balance.seniorityDays) -
      Number(balance.usedDays);

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
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        maxConsecutiveDays: true,
        usesAnnualBalance: true,
      },
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

  if (
    shouldEnforceAdvanceRequestDays(params.fromDate, todayStart, leavePolicy.advanceRequestDays)
  ) {
    const minStartDate = new Date(todayStart);
    minStartDate.setUTCDate(minStartDate.getUTCDate() + (leavePolicy.advanceRequestDays ?? 0));
    if (params.fromDate < minStartDate) {
      throw Object.assign(
        new Error(
          `Future leave requests must be submitted at least ${leavePolicy.advanceRequestDays ?? 0} day(s) in advance.`,
        ),
        { status: 400 },
      );
    }
  }

  // Check max consecutive days from leave type first, fallback to global policy
  const maxConsecutiveDays = leaveType.maxConsecutiveDays ?? leavePolicy.maxConsecutiveDays;
  if (typeof maxConsecutiveDays === 'number' && inclusiveDays > maxConsecutiveDays) {
    throw Object.assign(
      new Error(`Loại nghỉ ${leaveType.name} tối đa ${maxConsecutiveDays} ngày liên tiếp.`),
      { status: 400 },
    );
  }

  // Attachment requirement removed — file upload is always optional
  // const requiredDocumentTypes = approvalFlow.requireDocumentTypes ?? [];

  await assertNoOverlap(params.userId, params.fromDate, params.toDate, params.excludeRequestId);

  // Check balance: if usesAnnualBalance, check AL balance; otherwise check leave type's own balance
  if (leaveType.usesAnnualBalance) {
    const annualLeaveType = await getLeaveTypeByCode('AL');
    if (annualLeaveType) {
      await validateBalanceAvailable(
        params.userId,
        annualLeaveType.id,
        params.totalDays,
        Number(getVietnamDatePart(params.fromDate).slice(0, 4)),
        false,
        params.fromDate,
        leavePolicy.resetCarryOverDate,
      );
    }
  } else if (requiresLeaveBalanceCheck(leaveType.code)) {
    // Only check balance for types that require it (non-exempt types)
    await validateBalanceAvailable(
      params.userId,
      params.leaveTypeId,
      params.totalDays,
      Number(getVietnamDatePart(params.fromDate).slice(0, 4)),
      leaveType.code === 'CO',
    );
  }

  return {
    leaveTypeCode: leaveType.code,
    usesAnnualBalance: leaveType.usesAnnualBalance,
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

/**
 * Compute the effective carry-over balance for the remaining-days formula.
 * If fromDate is before the reset date of the given year, carry-over days
 * (minus already-used carry-over) contribute to the remaining balance.
 * After the reset date, carry-over has expired.
 */
function computeEffectiveCarryOver(
  balance: { carryOverDays: unknown; usedCarryOverDays: unknown },
  fromDate: Date,
  resetCarryOverDate: string | undefined,
  year: number,
): number {
  if (!resetCarryOverDate) {
    return Math.max(0, Number(balance.carryOverDays) - Number(balance.usedCarryOverDays));
  }
  const parts = resetCarryOverDate.split('-');
  if (parts.length !== 2) return 0;
  const resetDate = new Date(year, Number(parts[0]) - 1, Number(parts[1]), 0, 0, 0, 0);
  if (fromDate < resetDate) {
    return Math.max(0, Number(balance.carryOverDays) - Number(balance.usedCarryOverDays));
  }
  return 0;
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

  return {
    data: requests.map((request) =>
      serializeLeaveRequestDates(sanitizeLeaveRequestForViewer(request, requestingUser)),
    ),
    meta: buildMeta(total, page, limit),
  };
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

  return serializeLeaveRequestDates(sanitizeLeaveRequestForViewer(request, requestingUser));
}

export async function createLeaveRequest(
  requestingUser: AuthUser,
  data: CreateLeaveRequestDto,
  attachmentUrl?: string,
) {
  const leavePolicyRaw = await getLeavePolicy();
  const leavePolicy = getLeavePolicySettings(leavePolicyRaw);
  const resetCarryOverDate = leavePolicy.resetCarryOverDate;

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
        durationMode: data.durationMode ?? 'FULL_DAY',
        totalDays,
        reason: data.reason,
        handoverPersonId: data.handoverPersonId || null,
        status: shouldAutoApprove ? 'APPROVED' : 'PENDING',
        approvedAt: shouldAutoApprove ? new Date() : null,
        approvedNote: shouldAutoApprove ? 'Auto-approved by approval flow setting.' : null,
        ...(attachmentUrl ? { attachmentUrl } : {}),
      },
    });

    // Deduct balance: if usesAnnualBalance, deduct from AL; otherwise deduct from leave type's own balance
    if (shouldAutoApprove && ruleResult.usesAnnualBalance) {
      const annualLeaveType = await getLeaveTypeByCode('AL');
      if (annualLeaveType) {
        await deductBalance(
          tx,
          targetUserId,
          data.leaveTypeId,
          totalDays,
          Number(getVietnamDatePart(fromDate).slice(0, 4)),
          annualLeaveType.id,
          false,
          fromDate,
          resetCarryOverDate,
        );
      }
    } else if (shouldAutoApprove && requiresLeaveBalanceCheck(ruleResult.leaveTypeCode)) {
      await deductBalance(
        tx,
        targetUserId,
        data.leaveTypeId,
        totalDays,
        Number(getVietnamDatePart(fromDate).slice(0, 4)),
        undefined,
        ruleResult.leaveTypeCode === 'CO',
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

    await sendLeaveMailSafely(() =>
      sendLeaveRequestCreatedEmail(mailService, {
        approverEmail: createdRequest.approver?.email,
        approverName: createdRequest.approver?.fullName,
        requesterName: createdRequest.user?.fullName || 'Nhan vien',
        leaveTypeName:
          createdRequest.leaveType?.name || createdRequest.leaveType?.code || 'nghi phep',
        fromDateLabel: formatVietnamDateTime(createdRequest.fromDate) || createdRequest.fromDate,
        toDateLabel: formatVietnamDateTime(createdRequest.toDate) || createdRequest.toDate,
        totalDaysLabel: formatLeaveTotalDaysLabel(createdRequest.totalDays),
        reason: createdRequest.reason || 'Khong co ly do',
        detailUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/approval`,
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
      durationMode: data.durationMode ?? 'FULL_DAY',
      totalDays,
      reason: data.reason,
      handoverPersonId: data.handoverPersonId || null,
      ...(attachmentUrl ? { attachmentUrl } : {}),
    },
    include: LEAVE_REQUEST_INCLUDE,
  });

  return serializeLeaveRequestDates(updatedRequest);
}

export async function approveLeaveRequest(id: bigint, requestingUser: AuthUser, note?: string) {
  const leavePolicyRaw = await getLeavePolicy();
  const leavePolicy = getLeavePolicySettings(leavePolicyRaw);
  const resetCarryOverDate = leavePolicy.resetCarryOverDate;

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

    const year = Number(getVietnamDatePart(request.fromDate).slice(0, 4));

    // Check balance: if usesAnnualBalance, check AL balance; otherwise check leave type's own balance
    if (request.leaveType.usesAnnualBalance) {
      const annualLeaveType = await getLeaveTypeByCode('AL');
      if (annualLeaveType) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: request.userId,
              leaveTypeId: annualLeaveType.id,
              year,
            },
          },
          select: {
            annualDays: true,
            carryOverDays: true,
            usedCarryOverDays: true,
            seniorityDays: true,
            usedDays: true,
          },
        });

        if (!balance) {
          throw Object.assign(new Error('Leave balance has not been initialized for this user.'), {
            status: 400,
          });
        }

        const effectiveCarryOver = computeEffectiveCarryOver(
          balance,
          request.fromDate,
          resetCarryOverDate,
          year,
        );
        const remainingDays =
          Number(balance.annualDays) +
          effectiveCarryOver +
          Number(balance.seniorityDays) -
          Number(balance.usedDays);
        if (remainingDays < Number(request.totalDays)) {
          throw Object.assign(
            new Error(
              `Insufficient annual leave balance. Remaining ${remainingDays} day(s), requested ${Number(request.totalDays)}.`,
            ),
            { status: 400 },
          );
        }
      }
    } else if (requiresLeaveBalanceCheck(request.leaveType.code)) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: request.userId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        select: {
          annualDays: true,
          carryOverDays: true,
          usedCarryOverDays: true,
          seniorityDays: true,
          usedDays: true,
          compOffDays: true,
          usedCompOffDays: true,
        },
      });

      if (!balance) {
        throw Object.assign(new Error('Leave balance has not been initialized for this user.'), {
          status: 400,
        });
      }

      const isCompOff = request.leaveType.code === 'CO';
      const effectiveCarryOver = isCompOff
        ? 0
        : computeEffectiveCarryOver(balance, request.fromDate, resetCarryOverDate, year);
      const remainingDays = isCompOff
        ? Number(balance.compOffDays) - Number(balance.usedCompOffDays)
        : Number(balance.annualDays) +
          effectiveCarryOver +
          Number(balance.seniorityDays) -
          Number(balance.usedDays);
      if (remainingDays < Number(request.totalDays)) {
        throw Object.assign(
          new Error(
            `Insufficient leave balance. Remaining ${remainingDays} day(s), requested ${Number(request.totalDays)}.`,
          ),
          { status: 400 },
        );
      }
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

    // Deduct balance: if usesAnnualBalance, deduct from AL; otherwise deduct from leave type's own balance
    if (request.leaveType.usesAnnualBalance) {
      const annualLeaveType = await getLeaveTypeByCode('AL');
      if (annualLeaveType) {
        await deductBalance(
          tx,
          request.userId,
          request.leaveTypeId,
          Number(request.totalDays),
          year,
          annualLeaveType.id,
          false,
          request.fromDate,
          resetCarryOverDate,
        );
      }
    } else if (requiresLeaveBalanceCheck(request.leaveType.code)) {
      await deductBalance(
        tx,
        request.userId,
        request.leaveTypeId,
        Number(request.totalDays),
        year,
        undefined,
        request.leaveType.code === 'CO',
      );
    }

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

  await sendLeaveMailSafely(() =>
    sendLeaveRequestApprovedEmail(mailService, {
      requesterEmail: approvedRequest.user.email,
      requesterName: approvedRequest.user.fullName || 'Nhan vien',
      approverName: getActorName(requestingUser, approvedRequest.approver?.fullName),
      leaveTypeName:
        approvedRequest.leaveType?.name || approvedRequest.leaveType?.code || 'nghi phep',
      fromDateLabel: formatVietnamDateTime(approvedRequest.fromDate) || approvedRequest.fromDate,
      toDateLabel: formatVietnamDateTime(approvedRequest.toDate) || approvedRequest.toDate,
      totalDaysLabel: formatLeaveTotalDaysLabel(approvedRequest.totalDays),
      note: approvedRequest.approvedNote,
      detailUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/leave-history`,
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

  await sendLeaveMailSafely(() =>
    sendLeaveRequestRejectedEmail(mailService, {
      requesterEmail: serializedRequest.user.email,
      requesterName: serializedRequest.user.fullName || 'Nhan vien',
      approverName: getActorName(requestingUser, serializedRequest.approver?.fullName),
      leaveTypeName:
        serializedRequest.leaveType?.name || serializedRequest.leaveType?.code || 'nghi phep',
      fromDateLabel:
        formatVietnamDateTime(serializedRequest.fromDate) || serializedRequest.fromDate,
      toDateLabel: formatVietnamDateTime(serializedRequest.toDate) || serializedRequest.toDate,
      totalDaysLabel: formatLeaveTotalDaysLabel(serializedRequest.totalDays),
      note,
      detailUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/leave-history`,
    }),
  );

  return serializedRequest;
}

export async function cancelLeaveRequest(id: bigint, requestingUser: AuthUser) {
  const leavePolicyRaw = await getLeavePolicy();
  const leavePolicy = getLeavePolicySettings(leavePolicyRaw);
  const resetCarryOverDate = leavePolicy.resetCarryOverDate;

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

    // Restore balance: if usesAnnualBalance, restore to AL; otherwise restore to leave type's own balance
    if (request.status === 'APPROVED') {
      const year = Number(getVietnamDatePart(request.fromDate).slice(0, 4));
      if (request.leaveType.usesAnnualBalance) {
        const annualLeaveType = await getLeaveTypeByCode('AL');
        if (annualLeaveType) {
          await restoreBalance(
            tx,
            request.userId,
            request.leaveTypeId,
            Number(request.totalDays),
            year,
            annualLeaveType.id,
            false,
            request.fromDate,
            resetCarryOverDate,
          );
        }
      } else if (requiresLeaveBalanceCheck(request.leaveType.code)) {
        await restoreBalance(
          tx,
          request.userId,
          request.leaveTypeId,
          Number(request.totalDays),
          year,
          undefined,
          request.leaveType.code === 'CO',
        );
      }
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
  const leavePolicyRaw = await getLeavePolicy();
  const leavePolicy = getLeavePolicySettings(leavePolicyRaw);
  const resetCarryOverDate = leavePolicy.resetCarryOverDate;

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
      const year = Number(getVietnamDatePart(request.fromDate).slice(0, 4));

      // Check balance: if usesAnnualBalance, check AL balance; otherwise check leave type's own balance
      if (request.leaveType.usesAnnualBalance) {
        const annualLeaveType = await getLeaveTypeByCode('AL');
        if (annualLeaveType) {
          const balance = await tx.leaveBalance.findUnique({
            where: {
              userId_leaveTypeId_year: {
                userId: request.userId,
                leaveTypeId: annualLeaveType.id,
                year,
              },
            },
            select: {
              annualDays: true,
              carryOverDays: true,
              usedCarryOverDays: true,
              seniorityDays: true,
              usedDays: true,
            },
          });

          if (!balance) {
            throw Object.assign(
              new Error(
                `Leave balance has not been initialized for request #${request.id.toString()}.`,
              ),
              { status: 400 },
            );
          }

          const effectiveCarryOver = computeEffectiveCarryOver(
            balance,
            request.fromDate,
            resetCarryOverDate,
            year,
          );
          const remainingDays =
            Number(balance.annualDays) +
            effectiveCarryOver +
            Number(balance.seniorityDays) -
            Number(balance.usedDays);
          if (remainingDays < Number(request.totalDays)) {
            throw Object.assign(
              new Error(
                `Insufficient annual leave balance for request #${request.id.toString()}. Remaining ${remainingDays} day(s).`,
              ),
              { status: 400 },
            );
          }
        }
      } else if (requiresLeaveBalanceCheck(request.leaveType.code)) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: request.userId,
              leaveTypeId: request.leaveTypeId,
              year,
            },
          },
          select: {
            annualDays: true,
            carryOverDays: true,
            usedCarryOverDays: true,
            seniorityDays: true,
            usedDays: true,
            compOffDays: true,
            usedCompOffDays: true,
          },
        });

        if (!balance) {
          throw Object.assign(
            new Error(
              `Leave balance has not been initialized for request #${request.id.toString()}.`,
            ),
            { status: 400 },
          );
        }

        const isCompOff = request.leaveType.code === 'CO';
        const effectiveCarryOver = isCompOff
          ? 0
          : computeEffectiveCarryOver(balance, request.fromDate, resetCarryOverDate, year);
        const remainingDays = isCompOff
          ? Number(balance.compOffDays) - Number(balance.usedCompOffDays)
          : Number(balance.annualDays) +
            effectiveCarryOver +
            Number(balance.seniorityDays) -
            Number(balance.usedDays);
        if (remainingDays < Number(request.totalDays)) {
          throw Object.assign(
            new Error(
              `Insufficient leave balance for request #${request.id.toString()}. Remaining ${remainingDays} day(s).`,
            ),
            { status: 400 },
          );
        }
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

      // Deduct balance: if usesAnnualBalance, deduct from AL; otherwise deduct from leave type's own balance
      if (request.leaveType.usesAnnualBalance) {
        const annualLeaveType = await getLeaveTypeByCode('AL');
        if (annualLeaveType) {
          await deductBalance(
            tx,
            request.userId,
            request.leaveTypeId,
            Number(request.totalDays),
            year,
            annualLeaveType.id,
            false,
            request.fromDate,
            resetCarryOverDate,
          );
        }
      } else if (requiresLeaveBalanceCheck(request.leaveType.code)) {
        await deductBalance(
          tx,
          request.userId,
          request.leaveTypeId,
          Number(request.totalDays),
          year,
          undefined,
          request.leaveType.code === 'CO',
        );
      }
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
