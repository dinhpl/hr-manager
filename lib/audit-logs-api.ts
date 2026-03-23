import { apiClient } from './api-client';

export type AuditLogItem = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  ipAddress: string | null;
  createdAt: string;
};

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  module?: string;
  action?: string;
  actorId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
};

export async function fetchAuditLogs(filters: AuditLogFilters) {
  return apiClient.get<AuditLogItem[]>('/api/audit-logs', { params: filters });
}
