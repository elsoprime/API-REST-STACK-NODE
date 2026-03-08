import { type AuthScope } from '@/constants/security';

export interface UserExecutionActor {
  kind: 'user';
  userId: string;
  sessionId?: string;
  scope: AuthScope[];
}

export interface SystemExecutionActor {
  kind: 'system';
  systemId: string;
  label: string;
}

export interface UnknownExecutionActor {
  kind: 'unknown';
  reason: 'http_unauthenticated' | 'external_unresolved' | 'internal_unresolved';
}

export type ExecutionActor = UserExecutionActor | SystemExecutionActor | UnknownExecutionActor;

export interface ExecutionTenantScope {
  tenantId: string;
  membershipId?: string;
  roleKey?: string;
  isOwner?: boolean;
  effectiveRoleKeys?: string[];
}

export interface ExecutionContext {
  traceId: string;
  actor: ExecutionActor;
  tenant?: ExecutionTenantScope;
}
