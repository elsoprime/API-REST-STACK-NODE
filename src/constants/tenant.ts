export const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
} as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const TENANT_ROLE_KEYS = {
  OWNER: 'tenant:owner',
  MEMBER: 'tenant:member'
} as const;

export type TenantRoleKey = (typeof TENANT_ROLE_KEYS)[keyof typeof TENANT_ROLE_KEYS];

export const TENANT_ROLE_VALUES = [TENANT_ROLE_KEYS.OWNER, TENANT_ROLE_KEYS.MEMBER] as const;

export function isTenantRoleKey(value: string): value is TenantRoleKey {
  return TENANT_ROLE_VALUES.includes(value as TenantRoleKey);
}

export const TENANT_POLICY = {
  INVITATION_TTL_MS: 604_800_000
} as const;
