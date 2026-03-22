import { type ClientSession } from 'mongoose';

import { type AuthScope } from '@/constants/security';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const AUDIT_SCOPE_VALUES = ['platform', 'tenant'] as const;
export const AUDIT_SEVERITY_VALUES = ['info', 'warning', 'critical'] as const;
export const AUDIT_OUTBOX_STATUS_VALUES = ['pending', 'delivered'] as const;

export type AuditScope = (typeof AUDIT_SCOPE_VALUES)[number];
export type AuditSeverity = (typeof AUDIT_SEVERITY_VALUES)[number];
export type AuditOutboxStatus = (typeof AUDIT_OUTBOX_STATUS_VALUES)[number];

export type AuditJsonPrimitive = string | number | boolean | null;
export type AuditJsonValue = AuditJsonPrimitive | AuditJsonObject | AuditJsonValue[];
export interface AuditJsonObject {
  [key: string]: AuditJsonValue;
}

export interface AuditChanges {
  before?: AuditJsonObject | null;
  after?: AuditJsonObject | null;
  fields?: string[];
}

export interface AuditUserActor {
  kind: 'user';
  userId: string;
  sessionId?: string;
  scope: AuthScope[];
}

export interface AuditSystemActor {
  kind: 'system';
  systemId: string;
  label: string;
}

export interface AuditUnknownActor {
  kind: 'unknown';
  reason: 'http_unauthenticated' | 'external_unresolved' | 'internal_unresolved';
}

export type AuditActor = AuditUserActor | AuditSystemActor | AuditUnknownActor;

export interface AuditTenantScope {
  tenantId: string;
  membershipId?: string;
  roleKey?: string;
  isOwner?: boolean;
  effectiveRoleKeys?: string[];
}

export interface AuditResource {
  type: string;
  id?: string;
  label?: string;
}

export interface AuditContext {
  scope: AuditScope;
  traceId: string;
  actor: AuditActor;
  tenant?: AuditTenantScope;
  action: string;
  resource: AuditResource;
  severity: AuditSeverity;
  changes?: AuditChanges;
  metadata?: AuditJsonObject;
}

export interface CreateAuditContextInput {
  executionContext?: ExecutionContext;
  tenant?: AuditTenantScope;
  action: string;
  resource: AuditResource;
  severity?: AuditSeverity;
  changes?: AuditChanges;
  metadata?: AuditJsonObject;
}

export type CreateAuditLogInput = AuditContext;

export interface AuditLogView {
  id: string;
  scope: AuditScope;
  traceId: string;
  actor: AuditActor;
  tenant?: AuditTenantScope;
  action: string;
  resource: AuditResource;
  severity: AuditSeverity;
  changes?: AuditChanges;
  metadata?: AuditJsonObject;
  createdAt: string;
}

export interface RecordAuditLogOptions {
  session?: ClientSession;
}

export interface ListAuditLogsResult {
  items: AuditLogView[];
  page: number;
  limit: number;
  total: number;
}

export interface AuditMetricsPoint {
  bucketStart: string;
  bucketLabel: string;
  total: number;
  info: number;
  warning: number;
  critical: number;
}

export interface AuditMetricsShare {
  key: string;
  count: number;
  pct: number;
}

export interface TenantAuditMetricsResult {
  from: string;
  to: string;
  granularity: 'day' | 'week';
  summary: {
    totalEvents: number;
    criticalEvents: number;
    criticalPct: number;
    previousTotal: number;
    trendPct: number;
  };
  trend: AuditMetricsPoint[];
  severityDistribution: AuditMetricsShare[];
  topActions: AuditMetricsShare[];
  topModules: AuditMetricsShare[];
}

export interface AuditServiceContract {
  record: (input: CreateAuditLogInput, options?: RecordAuditLogOptions) => Promise<AuditLogView>;
  list: (
    input: import('@/core/platform/audit/types/audit-query.types').ListTenantAuditLogsInput
  ) => Promise<ListAuditLogsResult>;
  listPlatform: (
    input: import('@/core/platform/audit/types/audit-query.types').ListPlatformAuditLogsInput
  ) => Promise<ListAuditLogsResult>;
  getTenantMetrics: (
    input: import('@/core/platform/audit/types/audit-query.types').GetTenantAuditMetricsInput
  ) => Promise<TenantAuditMetricsResult>;
}
