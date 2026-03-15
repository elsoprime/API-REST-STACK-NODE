import { type AuthScope } from '@/constants/security';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';
import { type TenantAuthorizationContext } from '@/core/platform/rbac/types/rbac.types';
import {
  type InvitationStatus,
  type MembershipStatus,
  type TenantStatus,
  type TenantSubscriptionStatus
} from '@/constants/tenant';

export interface TenantView {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  subscriptionStatus?: TenantSubscriptionStatus;
  subscriptionGraceEndsAt?: string | null;
  ownerUserId: string;
  planId: string | null;
  activeModuleKeys: string[];
  memberLimit: number | null;
}

export interface MembershipView {
  id: string;
  tenantId: string;
  userId: string;
  roleKey: string;
  status: MembershipStatus;
}

export interface InvitationView {
  id: string;
  tenantId: string;
  email: string;
  roleKey: string;
  status: InvitationStatus;
  expiresAt: string;
}

export interface TenantMembershipSummary {
  tenant: TenantView;
  membership: MembershipView;
  isActive: boolean;
}

export interface TenantContext {
  tenantId: string;
  membershipId: string;
  roleKey: string;
  authorization: TenantAuthorizationContext;
}

export interface CreateTenantInput {
  userId: string;
  name: string;
  slug?: string;
  context?: ExecutionContext;
}

export interface CreateTenantResult {
  tenant: TenantView;
  membership: MembershipView;
}

export interface ListMyTenantsInput {
  userId: string;
  sessionId?: string;
  context?: ExecutionContext;
}

export interface ListMyTenantsResult {
  items: TenantMembershipSummary[];
}

export interface SwitchActiveTenantInput {
  userId: string;
  sessionId: string;
  tenantId: string;
  scope: AuthScope[];
  context?: ExecutionContext;
}

export interface SwitchActiveTenantResult {
  tenant: TenantView;
  membership: MembershipView;
  accessToken: string;
}

export interface CreateInvitationInput {
  userId: string;
  tenantId: string;
  email: string;
  roleKey?: string;
  context?: ExecutionContext;
}

export interface CreateInvitationResult {
  invitation: InvitationView;
}

export interface AcceptInvitationInput {
  userId: string;
  token: string;
  context?: ExecutionContext;
}

export interface AcceptInvitationResult {
  tenant: TenantView;
  membership: MembershipView;
}

export interface RevokeInvitationInput {
  userId: string;
  tenantId: string;
  invitationId: string;
  context?: ExecutionContext;
}

export interface RevokeInvitationResult {
  invitation: InvitationView;
}

export interface TransferOwnershipInput {
  userId: string;
  tenantId: string;
  targetUserId: string;
  context?: ExecutionContext;
}

export interface TransferOwnershipResult {
  tenant: TenantView;
  membership: MembershipView;
}

export interface AssignTenantSubscriptionInput {
  userId: string;
  tenantId: string;
  planId: string;
  checkoutSessionId: string;
  context?: ExecutionContext;
}

export interface CancelTenantSubscriptionInput {
  userId: string;
  tenantId: string;
  context?: ExecutionContext;
}

export interface TenantSubscriptionView {
  planId: string | null;
  activeModuleKeys: string[];
  status: 'activated' | 'canceled';
  lifecycleStatus: TenantSubscriptionStatus;
}

export interface TenantSubscriptionResult {
  tenant: TenantView;
  subscription: TenantSubscriptionView;
}

export interface TenantServiceContract {
  createTenant: (input: CreateTenantInput) => Promise<CreateTenantResult>;
  listMyTenants: (input: ListMyTenantsInput) => Promise<ListMyTenantsResult>;
  switchActiveTenant: (input: SwitchActiveTenantInput) => Promise<SwitchActiveTenantResult>;
  createInvitation: (input: CreateInvitationInput) => Promise<CreateInvitationResult>;
  acceptInvitation: (input: AcceptInvitationInput) => Promise<AcceptInvitationResult>;
  revokeInvitation: (input: RevokeInvitationInput) => Promise<RevokeInvitationResult>;
  transferOwnership: (input: TransferOwnershipInput) => Promise<TransferOwnershipResult>;
  assignSubscription: (input: AssignTenantSubscriptionInput) => Promise<TenantSubscriptionResult>;
  cancelSubscription: (input: CancelTenantSubscriptionInput) => Promise<TenantSubscriptionResult>;
}



