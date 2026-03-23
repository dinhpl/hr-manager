import { AuditAction, AuditModule } from '@prisma/client';

export type CreateAuditLogPayload = {
  actorId: bigint;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  module: AuditModule;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  ipAddress?: string;
};

export type AuditLogQueryParams = {
  page?: string;
  limit?: string;
  module?: string;
  action?: string;
  actorId?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
};

export type SerializedAuditLog = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  module: AuditModule;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ipAddress: string | null;
  createdAt: string;
};
