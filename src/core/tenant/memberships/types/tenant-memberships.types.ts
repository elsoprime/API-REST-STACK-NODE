import { type MembershipStatus } from '@/constants/tenant';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export interface TenantMembershipListItem {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: MembershipStatus;
  joinedAt: string | null;
  createdAt: string | null;
  isEffectiveOwner: boolean;
}

export interface TenantMembershipListResult {
  items: TenantMembershipListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListTenantMembershipsInput {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  roleKey?: string;
  status?: MembershipStatus;
  context?: ExecutionContext;
}

export interface UpdateTenantMembershipPatch {
  roleKey?: string;
  status?: MembershipStatus;
}

export interface UpdateTenantMembershipInput {
  tenantId: string;
  membershipId: string;
  patch: UpdateTenantMembershipPatch;
  context?: ExecutionContext;
}

export interface DeleteTenantMembershipInput {
  tenantId: string;
  membershipId: string;
  context?: ExecutionContext;
}

export interface TenantMembershipsServiceContract {
  listMemberships: (input: ListTenantMembershipsInput) => Promise<TenantMembershipListResult>;
  updateMembership: (input: UpdateTenantMembershipInput) => Promise<TenantMembershipListItem>;
  deleteMembership: (input: DeleteTenantMembershipInput) => Promise<TenantMembershipListItem>;
}
