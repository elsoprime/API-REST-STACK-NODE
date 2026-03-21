import { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthScope } from '@/constants/security';
import { AuditLogModel } from '@/core/platform/audit/models/audit-log.model';
import { AuditOutboxModel } from '@/core/platform/audit/models/audit-outbox.model';
import {
  type AuditModuleKey,
  type GetTenantAuditMetricsInput,
  type ListPlatformAuditLogsInput,
  type ListTenantAuditLogsInput
} from '@/core/platform/audit/types/audit-query.types';
import {
  type AuditActor,
  type AuditJsonValue,
  type AuditJsonObject,
  type AuditLogView,
  type AuditServiceContract,
  type AuditSeverity,
  type CreateAuditLogInput,
  type ListAuditLogsResult,
  type TenantAuditMetricsResult,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import {
  redactAuditChanges,
  redactAuditMetadata
} from '@/core/platform/audit/policies/audit-redaction.policy';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

interface StoredAuditLog {
  id?: string;
  _id?: Types.ObjectId;
  scope?: 'platform' | 'tenant';
  traceId?: string;
  actor?: {
    kind?: 'user' | 'system' | 'unknown';
    userId?: string | null;
    sessionId?: string | null;
    scope?: AuthScope[];
    systemId?: string | null;
    label?: string | null;
    reason?: 'http_unauthenticated' | 'external_unresolved' | 'internal_unresolved' | null;
  } | null;
  tenant?: {
    tenantId?: Types.ObjectId | string | null;
    membershipId?: Types.ObjectId | string | null;
    roleKey?: string | null;
    isOwner?: boolean | null;
    effectiveRoleKeys?: string[];
  } | null;
  action?: string;
  resource?: {
    type?: string;
    id?: string | null;
    label?: string | null;
  } | null;
  severity?: 'info' | 'warning' | 'critical';
  changes?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    fields?: string[];
  } | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
}

interface NormalizedAuditPayload {
  scope: 'platform' | 'tenant';
  traceId: string;
  actor: AuditActor;
  tenant: {
    tenantId: Types.ObjectId;
    membershipId: Types.ObjectId | null;
    roleKey: string | null;
    isOwner: boolean | null;
    effectiveRoleKeys: string[];
  } | null;
  action: string;
  resource: {
    type: string;
    id: string | null;
    label: string | null;
  };
  severity: AuditSeverity;
  changes: {
    before: AuditJsonObject | null;
    after: AuditJsonObject | null;
    fields: string[];
  } | null;
  metadata: AuditJsonObject | null;
}

const CIRCULAR_REFERENCE_PLACEHOLDER = '[Circular]' as const;

function dedupeNonEmptyStrings(values: string[] | undefined): string[] {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function serializeAuditJsonValue(
  value: unknown,
  visited: WeakSet<object> = new WeakSet<object>()
): AuditJsonValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeAuditJsonValue(item, visited) ?? null);
  }

  if (value && typeof value === 'object') {
    if (visited.has(value)) {
      return CIRCULAR_REFERENCE_PLACEHOLDER;
    }

    visited.add(value);

    try {
      if (value instanceof Set) {
        return [...value].map((item) => serializeAuditJsonValue(item, visited) ?? null);
      }

      if (value instanceof Map) {
        const serializedMap: AuditJsonObject = {};

        for (const [key, item] of value.entries()) {
          const serializedItem = serializeAuditJsonValue(item, visited);

          if (typeof serializedItem !== 'undefined') {
            serializedMap[String(key)] = serializedItem;
          }
        }

        return serializedMap;
      }

      const serializedObject: AuditJsonObject = {};

      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        const serializedItem = serializeAuditJsonValue(item, visited);

        if (typeof serializedItem !== 'undefined') {
          serializedObject[key] = serializedItem;
        }
      }

      return serializedObject;
    } finally {
      visited.delete(value);
    }
  }

  return String(value);
}

function toSerializableAuditObject(
  value: AuditJsonObject | null | undefined
): AuditJsonObject | null | undefined {
  if (typeof value === 'undefined' || value === null) {
    return value;
  }

  const serialized = serializeAuditJsonValue(value);

  if (!serialized || Array.isArray(serialized) || typeof serialized !== 'object') {
    return {};
  }

  return serialized;
}

function assertAuditScopeConsistency(input: CreateAuditLogInput): void {
  if (input.scope === 'tenant' && !input.tenant?.tenantId) {
    throw new AppError({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      message: 'Tenant-scoped audit logs require tenant context.',
      statusCode: HTTP_STATUS.BAD_REQUEST
    });
  }

  if (input.scope === 'platform' && input.tenant?.tenantId) {
    throw new AppError({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      message: 'Platform-scoped audit logs cannot include tenant context.',
      statusCode: HTTP_STATUS.BAD_REQUEST
    });
  }
}

function toAuditLogView(document: StoredAuditLog): AuditLogView {
  const tenant = document.tenant?.tenantId
    ? {
        tenantId:
          typeof document.tenant.tenantId === 'string'
            ? document.tenant.tenantId
            : document.tenant.tenantId.toString(),
        ...(document.tenant.membershipId
          ? {
              membershipId:
                typeof document.tenant.membershipId === 'string'
                  ? document.tenant.membershipId
                  : document.tenant.membershipId.toString()
            }
          : {}),
        ...(document.tenant.roleKey ? { roleKey: document.tenant.roleKey } : {}),
        ...(typeof document.tenant.isOwner === 'boolean' ? { isOwner: document.tenant.isOwner } : {}),
        ...(document.tenant.effectiveRoleKeys?.length
          ? {
              effectiveRoleKeys: [...document.tenant.effectiveRoleKeys]
            }
          : {})
      }
    : undefined;

  const actor = document.actor ?? {
    kind: 'unknown' as const,
    reason: 'internal_unresolved' as const
  };

  const normalizedActor =
    actor.kind === 'user'
      ? {
          kind: 'user' as const,
          userId: actor.userId ?? '',
          ...(actor.sessionId ? { sessionId: actor.sessionId } : {}),
          scope: [...(actor.scope ?? [])]
        }
      : actor.kind === 'system'
        ? {
            kind: 'system' as const,
            systemId: actor.systemId ?? '',
            label: actor.label ?? ''
          }
        : {
            kind: 'unknown' as const,
            reason: actor.reason ?? 'internal_unresolved'
          };

  const resource = document.resource ?? {
    type: ''
  };

  return {
    id: document.id ?? document._id?.toString() ?? '',
    scope: document.scope ?? (tenant ? 'tenant' : 'platform'),
    traceId: document.traceId ?? 'unknown',
    actor: normalizedActor,
    ...(tenant ? { tenant } : {}),
    action: document.action ?? '',
    resource: {
      type: resource.type ?? '',
      ...(resource.id ? { id: resource.id } : {}),
      ...(resource.label ? { label: resource.label } : {})
    },
    severity: document.severity ?? 'info',
    ...(document.changes
      ? {
          changes: {
            ...(document.changes.before ? { before: document.changes.before as never } : {}),
            ...(document.changes.after ? { after: document.changes.after as never } : {}),
            ...(document.changes.fields?.length ? { fields: [...document.changes.fields] } : {})
          }
        }
      : {}),
    ...(document.metadata ? { metadata: document.metadata as never } : {}),
    createdAt: (document.createdAt ?? new Date(0)).toISOString()
  };
}

function applyCommonListFilters(
  query: Record<string, unknown>,
  input: ListTenantAuditLogsInput | ListPlatformAuditLogsInput
) {
  if (input.action) {
    query.action = input.action;
  }

  if (input.resourceType) {
    query['resource.type'] = input.resourceType;
  }

  if (input.severity) {
    query.severity = input.severity;
  }

  if (input.actorKind) {
    query['actor.kind'] = input.actorKind;
  }

  if (input.from || input.to) {
    query.createdAt = {
      ...(input.from ? { $gte: new Date(input.from) } : {}),
      ...(input.to ? { $lte: new Date(input.to) } : {})
    };
  }

  return query;
}

function buildTenantListQuery(input: ListTenantAuditLogsInput) {
  return applyCommonListFilters(
    {
      scope: 'tenant',
      'tenant.tenantId': new Types.ObjectId(input.tenantId)
    },
    input
  );
}

function buildPlatformListQuery(input: ListPlatformAuditLogsInput) {
  return applyCommonListFilters(
    {
      scope: 'platform'
    },
    input
  );
}


function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTenantMetricsBaseQuery(input: GetTenantAuditMetricsInput, range: { from: Date; to: Date }) {
  const query: Record<string, unknown> = {
    scope: 'tenant',
    'tenant.tenantId': new Types.ObjectId(input.tenantId),
    createdAt: {
      $gte: range.from,
      $lt: range.to
    }
  };

  if (input.severities?.length) {
    query.severity = { $in: input.severities };
  }

  if (input.modules?.length) {
    query.$or = input.modules.map((moduleKey) => ({
      action: {
        $regex: `^${escapeRegex(moduleKey)}\\.`,
        $options: 'i'
      }
    }));
  }

  return query;
}

function safePct(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Number(((count / total) * 100).toFixed(2));
}

function resolveBucketLabel(start: Date, granularity: 'day' | 'week'): string {
  if (granularity === 'week') {
    return start.toISOString().slice(0, 10);
  }

  return start.toISOString().slice(0, 10);
}
function normalizeAuditPayload(input: CreateAuditLogInput): NormalizedAuditPayload {
  assertAuditScopeConsistency(input);

  const serializableChanges = input.changes
    ? {
        ...(typeof input.changes.before !== 'undefined'
          ? {
              before: toSerializableAuditObject(input.changes.before)
            }
          : {}),
        ...(typeof input.changes.after !== 'undefined'
          ? {
              after: toSerializableAuditObject(input.changes.after)
            }
          : {}),
        ...(input.changes.fields
          ? {
              fields: dedupeNonEmptyStrings(input.changes.fields)
            }
          : {})
      }
    : undefined;

  const redactedChanges = redactAuditChanges(serializableChanges);
  const redactedMetadata = redactAuditMetadata(toSerializableAuditObject(input.metadata) ?? undefined);

  return {
    scope: input.scope,
    traceId: input.traceId.trim() || 'unknown',
    actor: input.actor,
    tenant: input.tenant
      ? {
          tenantId: new Types.ObjectId(input.tenant.tenantId),
          membershipId: input.tenant.membershipId ? new Types.ObjectId(input.tenant.membershipId) : null,
          roleKey: input.tenant.roleKey ?? null,
          isOwner: typeof input.tenant.isOwner === 'boolean' ? input.tenant.isOwner : null,
          effectiveRoleKeys: dedupeNonEmptyStrings(input.tenant.effectiveRoleKeys)
        }
      : null,
    action: input.action.trim(),
    resource: {
      type: input.resource.type.trim(),
      id: input.resource.id?.trim() || null,
      label: input.resource.label?.trim() || null
    },
    severity: input.severity,
    changes: redactedChanges
      ? {
          before: redactedChanges.before ?? null,
          after: redactedChanges.after ?? null,
          fields: dedupeNonEmptyStrings(redactedChanges.fields)
        }
      : null,
    metadata: redactedMetadata ?? null
  };
}

function toAuditLogStorageDocument(payload: NormalizedAuditPayload, sourceOutboxId?: string) {
  return {
    scope: payload.scope,
    traceId: payload.traceId,
    actor: payload.actor,
    tenant: payload.tenant,
    action: payload.action,
    resource: payload.resource,
    severity: payload.severity,
    changes: payload.changes,
    metadata: payload.metadata,
    ...(sourceOutboxId ? { sourceOutboxId: new Types.ObjectId(sourceOutboxId) } : {})
  };
}

function toFallbackAuditLogView(
  payload: NormalizedAuditPayload,
  createdAt: Date,
  id: string
): AuditLogView {
  return toAuditLogView({
    _id: new Types.ObjectId(id),
    scope: payload.scope,
    traceId: payload.traceId,
    actor: payload.actor,
    tenant: payload.tenant,
    action: payload.action,
    resource: payload.resource,
    severity: payload.severity,
    changes: payload.changes,
    metadata: payload.metadata,
    createdAt
  });
}

function toNormalizedPayloadFromOutbox(outboxEntry: {
  scope: 'platform' | 'tenant';
  traceId: string;
  actor: AuditActor;
  tenant?: {
    tenantId?: Types.ObjectId | string | null;
    membershipId?: Types.ObjectId | string | null;
    roleKey?: string | null;
    isOwner?: boolean | null;
    effectiveRoleKeys?: string[];
  } | null;
  action: string;
  resource: {
    type: string;
    id?: string | null;
    label?: string | null;
  };
  severity: AuditSeverity;
  changes?: {
    before?: AuditJsonObject | null;
    after?: AuditJsonObject | null;
    fields?: string[];
  } | null;
  metadata?: AuditJsonObject | null;
}): NormalizedAuditPayload {
  return {
    scope: outboxEntry.scope,
    traceId: outboxEntry.traceId,
    actor: outboxEntry.actor,
    tenant: outboxEntry.tenant?.tenantId
      ? {
          tenantId:
            typeof outboxEntry.tenant.tenantId === 'string'
              ? new Types.ObjectId(outboxEntry.tenant.tenantId)
              : outboxEntry.tenant.tenantId,
          membershipId: outboxEntry.tenant.membershipId
            ? typeof outboxEntry.tenant.membershipId === 'string'
              ? new Types.ObjectId(outboxEntry.tenant.membershipId)
              : outboxEntry.tenant.membershipId
            : null,
          roleKey: outboxEntry.tenant.roleKey ?? null,
          isOwner: typeof outboxEntry.tenant.isOwner === 'boolean' ? outboxEntry.tenant.isOwner : null,
          effectiveRoleKeys: dedupeNonEmptyStrings(outboxEntry.tenant.effectiveRoleKeys)
        }
      : null,
    action: outboxEntry.action,
    resource: {
      type: outboxEntry.resource.type,
      id: outboxEntry.resource.id ?? null,
      label: outboxEntry.resource.label ?? null
    },
    severity: outboxEntry.severity,
    changes: outboxEntry.changes
      ? {
          before: outboxEntry.changes.before ?? null,
          after: outboxEntry.changes.after ?? null,
          fields: dedupeNonEmptyStrings(outboxEntry.changes.fields)
        }
      : null,
    metadata: outboxEntry.metadata ?? null
  };
}

export class AuditService implements AuditServiceContract {
  async record(input: CreateAuditLogInput, options: RecordAuditLogOptions = {}): Promise<AuditLogView> {
    const payload = normalizeAuditPayload(input);

    if (options.session) {
      const [createdLog] = await AuditLogModel.create(
        [toAuditLogStorageDocument(payload)],
        { session: options.session }
      );

      return toAuditLogView(createdLog.toObject() as StoredAuditLog);
    }

    const [outboxEntry] = await AuditOutboxModel.create([
      {
        ...toAuditLogStorageDocument(payload),
        delivery: {
          status: 'pending',
          attempts: 0,
          auditLogId: null,
          deliveredAt: null,
          lastError: null
        }
      }
    ]);

    const deliveredLog = await this.deliverOutboxEntry(outboxEntry._id.toString());

    if (deliveredLog) {
      return deliveredLog;
    }

    return toFallbackAuditLogView(payload, outboxEntry.createdAt ?? new Date(), outboxEntry._id.toString());
  }

  async list(input: ListTenantAuditLogsInput): Promise<ListAuditLogsResult> {
    await this.flushPendingOutbox({
      scope: 'tenant',
      tenantId: input.tenantId
    });

    const page = input.page;
    const limit = input.limit;
    const skip = (page - 1) * limit;
    const query = buildTenantListQuery(input);
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(query)
    ]);

    return {
      items: items.map((item) => toAuditLogView(item as StoredAuditLog)),
      page,
      limit,
      total
    };
  }

  async listPlatform(input: ListPlatformAuditLogsInput): Promise<ListAuditLogsResult> {
    await this.flushPendingOutbox({
      scope: 'platform'
    });

    const page = input.page;
    const limit = input.limit;
    const skip = (page - 1) * limit;
    const query = buildPlatformListQuery(input);
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(query)
    ]);

    return {
      items: items.map((item) => toAuditLogView(item as StoredAuditLog)),
      page,
      limit,
      total
    };
  }


  async getTenantMetrics(input: GetTenantAuditMetricsInput): Promise<TenantAuditMetricsResult> {
    await this.flushPendingOutbox({
      scope: 'tenant',
      tenantId: input.tenantId
    });

    const fromDate = new Date(input.from);
    const toDate = new Date(input.to);
    const windowMs = toDate.getTime() - fromDate.getTime();
    const previousFromDate = new Date(fromDate.getTime() - windowMs);
    const previousToDate = new Date(fromDate.getTime());

    const currentQuery = buildTenantMetricsBaseQuery(input, { from: fromDate, to: toDate });
    const previousQuery = buildTenantMetricsBaseQuery(input, { from: previousFromDate, to: previousToDate });

    const [currentTotal, previousTotal, severityRows, trendRows, actionRows, moduleRows] = await Promise.all([
      AuditLogModel.countDocuments(currentQuery),
      AuditLogModel.countDocuments(previousQuery),
      AuditLogModel.aggregate([
        { $match: currentQuery },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      AuditLogModel.aggregate([
        { $match: currentQuery },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: '$createdAt',
                unit: input.granularity,
                timezone: 'UTC'
              }
            },
            total: { $sum: 1 },
            info: { $sum: { $cond: [{ $eq: ['$severity', 'info'] }, 1, 0] } },
            warning: { $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] } },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      AuditLogModel.aggregate([
        { $match: currentQuery },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: input.topN }
      ]),
      AuditLogModel.aggregate([
        { $match: currentQuery },
        {
          $project: {
            module: {
              $arrayElemAt: [{ $split: ['$action', '.'] }, 0]
            }
          }
        },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: input.topN }
      ])
    ]);

    const severityMap = new Map<string, number>(
      (severityRows as Array<{ _id: string; count: number }>).map((row) => [row._id, row.count])
    );

    const criticalEvents = severityMap.get('critical') ?? 0;
    const trendPct = previousTotal === 0 ? (currentTotal > 0 ? 100 : 0) : ((currentTotal - previousTotal) / previousTotal) * 100;

    const trend = (trendRows as Array<{ _id: Date; total: number; info: number; warning: number; critical: number }>).map((row) => {
      const start = new Date(row._id);
      return {
        bucketStart: start.toISOString(),
        bucketLabel: resolveBucketLabel(start, input.granularity),
        total: row.total,
        info: row.info,
        warning: row.warning,
        critical: row.critical
      };
    });

    const severityDistribution = ['info', 'warning', 'critical'].map((key) => {
      const count = severityMap.get(key) ?? 0;
      return {
        key,
        count,
        pct: safePct(count, currentTotal)
      };
    });

    const topActions = (actionRows as Array<{ _id: string; count: number }>).map((row) => ({
      key: row._id,
      count: row.count,
      pct: safePct(row.count, currentTotal)
    }));

    const moduleAllowList = new Set<AuditModuleKey>(['auth', 'tenant', 'billing', 'inventory', 'crm', 'hr', 'audit', 'expenses']);
    const topModules = (moduleRows as Array<{ _id: string; count: number }>)
      .filter((row) => moduleAllowList.has(row._id as AuditModuleKey))
      .map((row) => ({
        key: row._id,
        count: row.count,
        pct: safePct(row.count, currentTotal)
      }));

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      granularity: input.granularity,
      summary: {
        totalEvents: currentTotal,
        criticalEvents,
        criticalPct: safePct(criticalEvents, currentTotal),
        previousTotal,
        trendPct: Number(trendPct.toFixed(2))
      },
      trend,
      severityDistribution,
      topActions,
      topModules
    };
  }
  private async flushPendingOutbox(input: { scope: 'platform' | 'tenant'; tenantId?: string }): Promise<void> {
    const query: Record<string, unknown> = {
      scope: input.scope,
      'delivery.status': 'pending'
    };

    if (input.scope === 'tenant' && input.tenantId) {
      query['tenant.tenantId'] = new Types.ObjectId(input.tenantId);
    }

    const entries = await AuditOutboxModel.find(query).sort({ createdAt: 1 }).limit(50).lean();

    await Promise.all(entries.map(async (entry) => this.deliverOutboxEntry(entry._id.toString())));
  }

  private async deliverOutboxEntry(outboxEntryId: string): Promise<AuditLogView | null> {
    const outboxEntry = await AuditOutboxModel.findById(outboxEntryId);

    if (!outboxEntry) {
      return null;
    }

    const delivery = outboxEntry.delivery ?? {
      status: 'pending' as const,
      attempts: 0,
      auditLogId: null,
      deliveredAt: null,
      lastError: null
    };
    const resource = outboxEntry.resource ?? {
      type: 'unknown',
      id: null,
      label: null
    };

    if (delivery.status === 'delivered' && delivery.auditLogId) {
      const existingLog = await AuditLogModel.findById(delivery.auditLogId).lean();

      return existingLog ? toAuditLogView(existingLog as StoredAuditLog) : null;
    }

    try {
      const payload = toNormalizedPayloadFromOutbox({
        scope: outboxEntry.scope,
        traceId: outboxEntry.traceId,
        actor: outboxEntry.actor as AuditActor,
        tenant: outboxEntry.tenant,
        action: outboxEntry.action,
        resource: {
          type: resource.type,
          id: resource.id ?? null,
          label: resource.label ?? null
        },
        severity: outboxEntry.severity,
        changes: outboxEntry.changes
          ? {
              before: outboxEntry.changes.before as AuditJsonObject | null,
              after: outboxEntry.changes.after as AuditJsonObject | null,
              fields: outboxEntry.changes.fields ?? []
            }
          : null,
        metadata: outboxEntry.metadata as AuditJsonObject | null
      });

      let createdLog;

      try {
        [createdLog] = await AuditLogModel.create([
          toAuditLogStorageDocument(payload, outboxEntry._id.toString())
        ]);
      } catch {
        createdLog = await AuditLogModel.findOne({
          sourceOutboxId: outboxEntry._id
        });
      }

      if (!createdLog) {
        throw new Error('Audit outbox delivery did not produce an audit log.');
      }

      outboxEntry.delivery = {
        ...delivery,
        status: 'delivered',
        attempts: delivery.attempts + 1,
        auditLogId: createdLog._id,
        deliveredAt: new Date(),
        lastError: null
      };
      await outboxEntry.save();

      return toAuditLogView(createdLog.toObject() as StoredAuditLog);
    } catch (error) {
      outboxEntry.delivery = {
        ...delivery,
        status: 'pending',
        attempts: delivery.attempts + 1,
        lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown audit delivery error'
      };
      await outboxEntry.save();

      return null;
    }
  }
}

export const auditService = new AuditService();



