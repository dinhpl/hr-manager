import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import * as service from './leave-requests.service';
import {
  createLeaveRequestSchema,
  getLeaveRequestsQuerySchema,
  approveRejectSchema,
  bulkApproveSchema,
  updateLeaveRequestSchema,
} from './leave-requests.validation';
import { sendSuccess } from '../../utils/response';
import { buildChanges, createAuditLog, getClientIp } from '../audit-logs/audit-logs.service';
import prisma from '../../config/prisma';
import { formatVietnamDateTime } from '../../utils/date-time';

const LEAVE_REQUEST_AUDIT_INCLUDE = {
  user: { select: { fullName: true, username: true } },
  leaveType: { select: { code: true, name: true } },
  approver: { select: { fullName: true, username: true } },
  handoverPerson: { select: { fullName: true, username: true } },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRequestAuditRecord = Prisma.LeaveRequestGetPayload<{
  include: typeof LEAVE_REQUEST_AUDIT_INCLUDE;
}>;

type LeaveRequestAuditLike = {
  user?: { fullName?: string | null; username?: string | null } | null;
  leaveType?: { code?: string | null; name?: string | null } | null;
  approver?: { fullName?: string | null; username?: string | null } | null;
  handoverPerson?: { fullName?: string | null; username?: string | null } | null;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
  durationMode?: string | null;
  totalDays?: unknown;
  reason?: string | null;
  status?: string | null;
  approvedNote?: string | null;
};

const LEAVE_REQUEST_AUDIT_FIELDS = [
  'userName',
  'leaveType',
  'fromDate',
  'toDate',
  'durationMode',
  'totalDays',
  'reason',
  'handoverPerson',
  'approver',
  'status',
  'approvedNote',
] as const;

function getPersonName(person?: { fullName?: string | null; username?: string | null } | null) {
  return person?.fullName?.trim() || person?.username?.trim() || null;
}

function getLeaveTypeLabel(leaveType?: { code?: string | null; name?: string | null } | null) {
  if (!leaveType) return null;
  if (leaveType.code && leaveType.name) return `${leaveType.code} - ${leaveType.name}`;
  return leaveType.name?.trim() || leaveType.code?.trim() || null;
}

function toLeaveRequestAuditSnapshot(request: LeaveRequestAuditLike) {
  return {
    userName: getPersonName(request.user),
    leaveType: getLeaveTypeLabel(request.leaveType),
    fromDate: formatVietnamDateTime(request.fromDate ?? null),
    toDate: formatVietnamDateTime(request.toDate ?? null),
    durationMode: request.durationMode ?? null,
    totalDays:
      request.totalDays === null || request.totalDays === undefined
        ? null
        : Number(request.totalDays),
    reason: request.reason ?? null,
    handoverPerson: getPersonName(request.handoverPerson),
    approver: getPersonName(request.approver),
    status: request.status ?? null,
    approvedNote: request.approvedNote ?? null,
  } satisfies Record<(typeof LEAVE_REQUEST_AUDIT_FIELDS)[number], unknown>;
}

function buildLeaveRequestAuditChanges(
  before: LeaveRequestAuditRecord | null,
  after: LeaveRequestAuditLike,
) {
  const beforeSnapshot = before
    ? toLeaveRequestAuditSnapshot(before)
    : Object.fromEntries(LEAVE_REQUEST_AUDIT_FIELDS.map((field) => [field, null]));
  const afterSnapshot = toLeaveRequestAuditSnapshot(after);

  return buildChanges(
    beforeSnapshot as Record<string, unknown>,
    afterSnapshot as Record<string, unknown>,
    [...LEAVE_REQUEST_AUDIT_FIELDS],
  );
}

function getLeaveRequestEntityName(request: {
  id?: bigint | string;
  user?: { fullName?: string | null; username?: string | null } | null;
  leaveType?: { code?: string | null; name?: string | null } | null;
  fromDate?: Date | string | null;
  toDate?: Date | string | null;
}) {
  const requester = getPersonName(request.user) ?? `Đơn nghỉ #${String(request.id ?? '')}`;
  const leaveType = getLeaveTypeLabel(request.leaveType) ?? 'Nghỉ phép';
  const fromDate = formatVietnamDateTime(request.fromDate ?? null);
  const toDate = formatVietnamDateTime(request.toDate ?? null);

  if (fromDate && toDate) {
    return `${requester} • ${leaveType} • ${fromDate} → ${toDate}`;
  }

  return `${requester} • ${leaveType}`;
}

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const query = getLeaveRequestsQuerySchema.parse(req.query);
    const result = await service.getLeaveRequests(req.user!, query);
    sendSuccess(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await service.getLeaveRequestById(BigInt(String(req.params.id)), req.user!);
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createLeaveRequestSchema.parse(req.body);
    // attachment_url from multer file upload (optional)
    const attachmentUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const request = await service.createLeaveRequest(req.user!, data, attachmentUrl);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CREATE',
      module: 'LEAVE_REQUEST',
      entityId: request.id.toString(),
      entityName: getLeaveRequestEntityName(request),
      changes: buildLeaveRequestAuditChanges(null, request),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, request, undefined, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const data = updateLeaveRequestSchema.parse(req.body);
    const before = await prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_AUDIT_INCLUDE,
    });
    const attachmentUrl = (req.file as Express.Multer.File | undefined)?.filename;
    const request = await service.updateLeaveRequest(id, req.user!, data, attachmentUrl);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'UPDATE',
      module: 'LEAVE_REQUEST',
      entityId: id.toString(),
      entityName: getLeaveRequestEntityName(request),
      changes: buildLeaveRequestAuditChanges(before, request),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const { note } = approveRejectSchema.parse(req.body);
    const before = await prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_AUDIT_INCLUDE,
    });
    const request = await service.approveLeaveRequest(id, req.user!, note);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'APPROVE',
      module: 'LEAVE_REQUEST',
      entityId: id.toString(),
      entityName: getLeaveRequestEntityName(request),
      changes: buildLeaveRequestAuditChanges(before, request),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const { note } = approveRejectSchema.parse(req.body);
    const before = await prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_AUDIT_INCLUDE,
    });
    const request = await service.rejectLeaveRequest(id, req.user!, note);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'REJECT',
      module: 'LEAVE_REQUEST',
      entityId: id.toString(),
      entityName: getLeaveRequestEntityName(request),
      changes: buildLeaveRequestAuditChanges(before, request),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const id = BigInt(String(req.params.id));
    const before = await prisma.leaveRequest.findUnique({
      where: { id },
      include: LEAVE_REQUEST_AUDIT_INCLUDE,
    });
    const request = await service.cancelLeaveRequest(id, req.user!);
    void createAuditLog({
      actorId: req.user!.id,
      actorName: req.user!.username || req.user!.email,
      actorRole: req.user!.role,
      action: 'CANCEL',
      module: 'LEAVE_REQUEST',
      entityId: id.toString(),
      entityName: getLeaveRequestEntityName(request),
      changes: buildLeaveRequestAuditChanges(before, request),
      ipAddress: getClientIp(req),
    });
    sendSuccess(res, request);
  } catch (err) {
    next(err);
  }
}

export async function bulkApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const { ids, note } = bulkApproveSchema.parse(req.body);
    const result = await service.bulkApproveLeaveRequests(ids, req.user!, note);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
