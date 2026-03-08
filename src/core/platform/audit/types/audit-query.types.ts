import { type AuditActor, type AuditSeverity } from '@/core/platform/audit/types/audit.types';

export interface AuditListFilters {
  page: number;
  limit: number;
  action?: string;
  resourceType?: string;
  severity?: AuditSeverity;
  actorKind?: AuditActor['kind'];
  from?: string;
  to?: string;
}

export interface ListTenantAuditLogsInput extends AuditListFilters {
  tenantId: string;
}

export type ListPlatformAuditLogsInput = AuditListFilters;
