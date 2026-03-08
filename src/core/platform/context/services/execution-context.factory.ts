import {
  type ExecutionActor,
  type ExecutionContext,
  type ExecutionTenantScope,
  type UserExecutionActor
} from '@/core/platform/context/types/execution-context.types';

interface ExecutionContextAuthSource {
  userId: string;
  sessionId?: string;
  scope?: UserExecutionActor['scope'];
  tenantId?: string;
  membershipId?: string;
}

interface ExecutionContextTenantSource {
  tenantId: string;
  membershipId?: string;
  roleKey?: string;
  authorization?: {
    isOwner?: boolean;
    effectiveRoleKeys?: string[];
  };
}

export interface CreateExecutionContextInput {
  traceId?: string;
  actor?: ExecutionActor;
  auth?: ExecutionContextAuthSource;
  tenant?: ExecutionContextTenantSource;
}

function buildActor(input: CreateExecutionContextInput): ExecutionActor {
  if (input.actor) {
    return input.actor;
  }

  if (input.auth?.userId) {
    return {
      kind: 'user',
      userId: input.auth.userId,
      sessionId: input.auth.sessionId,
      scope: input.auth.scope ?? []
    };
  }

  return {
    kind: 'unknown',
    reason: 'http_unauthenticated'
  };
}

function buildTenantScope(input: CreateExecutionContextInput): ExecutionTenantScope | undefined {
  if (input.tenant?.tenantId) {
    return {
      tenantId: input.tenant.tenantId,
      membershipId: input.tenant.membershipId,
      roleKey: input.tenant.roleKey,
      isOwner: input.tenant.authorization?.isOwner,
      effectiveRoleKeys: input.tenant.authorization?.effectiveRoleKeys
    };
  }

  if (input.auth?.tenantId) {
    return {
      tenantId: input.auth.tenantId,
      membershipId: input.auth.membershipId
    };
  }

  return undefined;
}

export function createExecutionContext(input: CreateExecutionContextInput): ExecutionContext {
  const context: ExecutionContext = {
    traceId: input.traceId?.trim() || 'unknown',
    actor: buildActor(input)
  };

  const tenantScope = buildTenantScope(input);

  if (tenantScope) {
    context.tenant = tenantScope;
  }

  return context;
}
