export const RBAC_ROLE_SCOPE_VALUES = ['platform', 'tenant'] as const;

export type RbacRoleScope = (typeof RBAC_ROLE_SCOPE_VALUES)[number];

export interface PermissionDefinition {
  key: string;
  scope: RbacRoleScope;
  description: string;
  moduleKey: string | null;
}

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  scope: RbacRoleScope;
  tenantId: string | null;
  isSystem: boolean;
  hierarchyLevel: number;
  permissions: string[];
}

export interface PlanDefinition {
  key: string;
  name: string;
  description: string;
  rank: number;
  allowedModuleKeys: string[];
  featureFlagKeys: string[];
  memberLimit: number | null;
}

export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
}

export interface FeatureFlagDefinition {
  key: string;
  name: string;
  description: string;
  moduleKey: string | null;
  allowAdminBypass: boolean;
}

export interface TenantAuthorizationContext {
  tenantId: string;
  role: RoleDefinition;
  isOwner: boolean;
  effectiveHierarchyLevel: number;
  effectiveRoleKeys: string[];
  permissionKeys: string[];
  plan: PlanDefinition | null;
  activeModuleKeys: string[];
  enabledModuleKeys: string[];
  featureFlagKeys: string[];
}

export interface ResolveTenantRuntimeInput {
  planId: string | null;
  activeModuleKeys: string[];
  disabledModuleKeys?: string[];
  disabledFeatureFlagKeys?: string[];
}

export interface TenantRuntimeResolution {
  plan: PlanDefinition | null;
  activeModuleKeys: string[];
  enabledModuleKeys: string[];
  featureFlagKeys: string[];
}

export interface ResolveRoleInput {
  roleKey: string;
  tenantId?: string;
}

export interface ResolveTenantAuthorizationInput {
  tenantId: string;
  roleKey: string;
  ownerUserId: string;
  membershipUserId: string;
  planId: string | null;
  activeModuleKeys: string[];
}

export interface RbacServiceContract {
  resolveRole: (input: ResolveRoleInput) => Promise<RoleDefinition>;
  resolvePermission: (permissionKey: string) => Promise<PermissionDefinition | null>;
  resolvePlan: (planId: string | null) => Promise<PlanDefinition | null>;
  resolveModule: (moduleKey: string) => Promise<ModuleDefinition | null>;
  resolveFeatureFlag: (featureFlagKey: string) => Promise<FeatureFlagDefinition | null>;
  resolveTenantAuthorization: (
    input: ResolveTenantAuthorizationInput
  ) => Promise<TenantAuthorizationContext>;
  resolveTenantRuntime: (
    input: ResolveTenantRuntimeInput
  ) => Promise<TenantRuntimeResolution>;
  assertRoleGranted: (
    authorization: TenantAuthorizationContext,
    requiredRoleKey: string,
    options?: { allowPlatformSuperAdmin?: boolean }
  ) => Promise<void>;
  assertPermissionGranted: (
    authorization: TenantAuthorizationContext,
    permissionKey: string,
    options?: { allowPlatformSuperAdmin?: boolean }
  ) => Promise<void>;
  assertPlanGranted: (authorization: TenantAuthorizationContext, requiredPlanKey: string) => Promise<void>;
  assertModuleGranted: (authorization: TenantAuthorizationContext, moduleKey: string) => Promise<void>;
}
