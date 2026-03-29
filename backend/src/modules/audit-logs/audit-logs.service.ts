import { Request } from 'express';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import type { CreateAuditLogPayload, AuditLogQueryParams, SerializedAuditLog } from './audit-logs.types';

function serializeAuditLog(log: {
  id: bigint;
  actorId: bigint;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  module: AuditModule;
  entityId: string | null;
  entityName: string | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: Date;
}): SerializedAuditLog {
  return {
    id: log.id.toString(),
    actorId: log.actorId.toString(),
    actorName: log.actorName,
    actorRole: log.actorRole,
    action: log.action,
    module: log.module,
    entityId: log.entityId,
    entityName: log.entityName,
    changes: log.changes as Record<string, { from: unknown; to: unknown }> | null,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function createAuditLog(payload: CreateAuditLogPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId,
        actorName: payload.actorName,
        actorRole: payload.actorRole,
        action: payload.action,
        module: payload.module,
        entityId: payload.entityId ?? null,
        entityName: payload.entityName ?? null,
        changes: (payload.changes ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: payload.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Fire-and-forget: log error but do not throw
    console.error('[AuditLog] Failed to create audit log:', err);
  }
}

export async function getAuditLogs(query: AuditLogQueryParams) {
  const { page, limit, skip } = getPaginationParams(query);

  const where: Record<string, unknown> = {};

  if (query.actorId) {
    where.actorId = BigInt(query.actorId);
  }

  if (query.module) {
    where.module = query.module as AuditModule;
  }

  if (query.action) {
    where.action = query.action as AuditAction;
  }

  if (query.entityId) {
    where.entityId = query.entityId;
  }

  if (query.fromDate || query.toDate) {
    where.createdAt = {
      ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
      ...(query.toDate ? { lte: new Date(query.toDate + 'T23:59:59.999Z') } : {}),
    };
  }

  if (query.search) {
    where.OR = [
      { actorName: { contains: query.search, mode: 'insensitive' } },
      { entityName: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: items.map(serializeAuditLog),
    meta: buildMeta(total, page, limit),
  };
}

export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  watchedFields: string[],
): Record<string, { from: unknown; to: unknown }> | undefined {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const field of watchedFields) {
    const fromVal = before[field];
    const toVal = after[field];
    // Convert BigInt to string for JSON serialization
    const from = typeof fromVal === 'bigint' ? fromVal.toString() : fromVal;
    const to = typeof toVal === 'bigint' ? toVal.toString() : toVal;
    if (String(from) !== String(to)) {
      changes[field] = { from, to };
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.ip ?? undefined;
}
