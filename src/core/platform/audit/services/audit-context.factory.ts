import {
  type AuditActor,
  type AuditContext,
  type CreateAuditContextInput
} from '@/core/platform/audit/types/audit.types';
import { type ExecutionActor } from '@/core/platform/context/types/execution-context.types';

function toAuditActor(actor: ExecutionActor | undefined): AuditActor {
  if (!actor) {
    return {
      kind: 'unknown',
      reason: 'internal_unresolved'
    };
  }

  if (actor.kind === 'user') {
    return {
      kind: 'user',
      userId: actor.userId,
      sessionId: actor.sessionId,
      scope: [...actor.scope]
    };
  }

  if (actor.kind === 'system') {
    return {
      kind: 'system',
      systemId: actor.systemId,
      label: actor.label
    };
  }

  return {
    kind: 'unknown',
    reason: actor.reason
  };
}

export class AuditContextFactory {
  create(input: CreateAuditContextInput): AuditContext {
    const executionContext = input.executionContext;
    const tenant = input.tenant ?? executionContext?.tenant;

    return {
      scope: tenant ? 'tenant' : 'platform',
      traceId: executionContext?.traceId ?? 'unknown',
      actor: toAuditActor(executionContext?.actor),
      ...(tenant ? { tenant } : {}),
      action: input.action,
      resource: {
        ...input.resource
      },
      severity: input.severity ?? 'info',
      ...(input.changes ? { changes: input.changes } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    };
  }
}

export const auditContextFactory = new AuditContextFactory();
