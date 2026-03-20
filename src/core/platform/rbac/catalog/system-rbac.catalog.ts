import {
  type FeatureFlagDefinition,
  type ModuleDefinition,
  type PermissionDefinition,
  type PlanDefinition,
  type RoleDefinition
} from '@/core/platform/rbac/types/rbac.types';

const SYSTEM_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'platform:settings:read',
    scope: 'platform',
    description: 'Read platform settings singleton information.',
    moduleKey: null
  },
  {
    key: 'platform:settings:update',
    scope: 'platform',
    description: 'Update platform settings singleton information.',
    moduleKey: null
  },
  {
    key: 'platform:audit:read',
    scope: 'platform',
    description: 'Read platform-scoped audit log information.',
    moduleKey: null
  },
  {
    key: 'tenant:memberships:read',
    scope: 'tenant',
    description: 'Read tenant membership information.',
    moduleKey: null
  },
  {
    key: 'tenant:memberships:update',
    scope: 'tenant',
    description: 'Update tenant membership information.',
    moduleKey: null
  },
  {
    key: 'tenant:memberships:delete',
    scope: 'tenant',
    description: 'Delete tenant memberships.',
    moduleKey: null
  },
  {
    key: 'tenant:invitations:create',
    scope: 'tenant',
    description: 'Create tenant invitations.',
    moduleKey: null
  },
  {
    key: 'tenant:invitations:revoke',
    scope: 'tenant',
    description: 'Revoke tenant invitations.',
    moduleKey: null
  },
  {
    key: 'tenant:ownership:transfer',
    scope: 'tenant',
    description: 'Transfer tenant ownership.',
    moduleKey: null
  },
  {
    key: 'tenant:audit:read',
    scope: 'tenant',
    description: 'Read tenant audit log information.',
    moduleKey: null
  },
  {
    key: 'tenant:settings:read',
    scope: 'tenant',
    description: 'Read tenant settings information.',
    moduleKey: null
  },
  {
    key: 'tenant:settings:update',
    scope: 'tenant',
    description: 'Update tenant settings information.',
    moduleKey: null
  },
  {
    key: 'tenant:modules:inventory:use',
    scope: 'tenant',
    description: 'Use the inventory module.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:inventory:read',
    scope: 'tenant',
    description: 'Read inventory resources.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:inventory:create',
    scope: 'tenant',
    description: 'Create inventory resources.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:inventory:update',
    scope: 'tenant',
    description: 'Update inventory resources.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:inventory:delete',
    scope: 'tenant',
    description: 'Delete inventory resources.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:inventory:stock:write',
    scope: 'tenant',
    description: 'Register inventory stock movements.',
    moduleKey: 'inventory'
  },
  {
    key: 'tenant:modules:crm:use',
    scope: 'tenant',
    description: 'Use the CRM module.',
    moduleKey: 'crm'
  },
  {
    key: 'tenant:crm:read',
    scope: 'tenant',
    description: 'Read CRM resources.',
    moduleKey: 'crm'
  },
  {
    key: 'tenant:crm:write',
    scope: 'tenant',
    description: 'Create and update CRM resources.',
    moduleKey: 'crm'
  },
  {
    key: 'tenant:crm:delete',
    scope: 'tenant',
    description: 'Delete CRM resources.',
    moduleKey: 'crm'
  },
  {
    key: 'tenant:crm:stage:update',
    scope: 'tenant',
    description: 'Change CRM opportunity stage.',
    moduleKey: 'crm'
  },
  {
    key: 'tenant:modules:hr:use',
    scope: 'tenant',
    description: 'Use the HR module.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:employee:read',
    scope: 'tenant',
    description: 'Read HR employee records.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:employee:write',
    scope: 'tenant',
    description: 'Create and update HR employee records.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:employee:delete',
    scope: 'tenant',
    description: 'Delete HR employee records.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:personal:read',
    scope: 'tenant',
    description: 'Read HR personal employee data.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:compensation:read',
    scope: 'tenant',
    description: 'Read HR compensation data.',
    moduleKey: 'hr'
  },
  {
    key: 'tenant:hr:compensation:update',
    scope: 'tenant',
    description: 'Update HR compensation data.',
    moduleKey: 'hr'
  }
];

const SYSTEM_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'platform:super_admin',
    name: 'Platform Super Admin',
    description: 'Administrative platform role with explicit contract-driven bypasses only.',
    scope: 'platform',
    tenantId: null,
    isSystem: true,
    hierarchyLevel: 1000,
    permissions: ['*']
  },
  {
    key: 'tenant:owner',
    name: 'Tenant Owner',
    description: 'System tenant owner role.',
    scope: 'tenant',
    tenantId: null,
    isSystem: true,
    hierarchyLevel: 200,
    permissions: [
      'tenant:memberships:read',
      'tenant:memberships:update',
      'tenant:memberships:delete',
      'tenant:invitations:create',
      'tenant:invitations:revoke',
      'tenant:audit:read',
      'tenant:settings:read',
      'tenant:settings:update',
      'tenant:ownership:transfer',
      'tenant:modules:inventory:use',
      'tenant:modules:inventory:read',
      'tenant:modules:inventory:create',
      'tenant:modules:inventory:update',
      'tenant:modules:inventory:delete',
      'tenant:modules:inventory:stock:write',
      'tenant:modules:crm:use',
      'tenant:modules:hr:use',
      'tenant:crm:read',
      'tenant:crm:write',
      'tenant:crm:delete',
      'tenant:crm:stage:update',
      'tenant:hr:employee:read',
      'tenant:hr:employee:write',
      'tenant:hr:employee:delete',
      'tenant:hr:personal:read',
      'tenant:hr:compensation:read',
      'tenant:hr:compensation:update'
    ]
  },
  {
    key: 'tenant:admin',
    name: 'Tenant Admin',
    description: 'System tenant admin role with delegated operational management.',
    scope: 'tenant',
    tenantId: null,
    isSystem: true,
    hierarchyLevel: 150,
    permissions: [
      'tenant:memberships:read',
      'tenant:memberships:update',
      'tenant:memberships:delete',
      'tenant:invitations:create',
      'tenant:invitations:revoke',
      'tenant:audit:read',
      'tenant:settings:read',
      'tenant:settings:update',
      'tenant:modules:inventory:use',
      'tenant:modules:inventory:read',
      'tenant:modules:inventory:create',
      'tenant:modules:inventory:update',
      'tenant:modules:inventory:delete',
      'tenant:modules:inventory:stock:write',
      'tenant:modules:crm:use',
      'tenant:modules:hr:use',
      'tenant:crm:read',
      'tenant:crm:write',
      'tenant:crm:delete',
      'tenant:crm:stage:update',
      'tenant:hr:employee:read',
      'tenant:hr:employee:write',
      'tenant:hr:employee:delete',
      'tenant:hr:personal:read',
      'tenant:hr:compensation:read',
      'tenant:hr:compensation:update'
    ]
  },
  {
    key: 'tenant:member',
    name: 'Tenant Member',
    description: 'Base tenant member role.',
    scope: 'tenant',
    tenantId: null,
    isSystem: true,
    hierarchyLevel: 100,
    permissions: [
      'tenant:memberships:read',
      'tenant:settings:read',
      'tenant:modules:inventory:use',
      'tenant:modules:inventory:read',
      'tenant:modules:crm:use',
      'tenant:modules:hr:use',
      'tenant:crm:read',
      'tenant:hr:employee:read'
    ]
  }
];
const SYSTEM_MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Inventory pilot module.'
  },
  {
    key: 'crm',
    name: 'CRM',
    description: 'Customer relationship management module.'
  },
  {
    key: 'hr',
    name: 'HR',
    description: 'Human resources module.'
  }
];

const SYSTEM_FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: 'inventory:base',
    name: 'Inventory Base',
    description: 'Base inventory features enabled by plan.',
    moduleKey: 'inventory',
    allowAdminBypass: false
  },
  {
    key: 'inventory:analytics',
    name: 'Inventory Analytics',
    description: 'Inventory analytics features.',
    moduleKey: 'inventory',
    allowAdminBypass: false
  },
  {
    key: 'crm:base',
    name: 'CRM Base',
    description: 'Base CRM features enabled by plan.',
    moduleKey: 'crm',
    allowAdminBypass: false
  },
  {
    key: 'hr:base',
    name: 'HR Base',
    description: 'Base HR features enabled by plan.',
    moduleKey: 'hr',
    allowAdminBypass: false
  }
];

const SYSTEM_PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'plan:starter',
    name: 'Starter',
    description: 'Entry plan for small tenants.',
    rank: 100,
    allowedModuleKeys: ['inventory'],
    featureFlagKeys: ['inventory:base'],
    memberLimit: 5
  },
  {
    key: 'plan:growth',
    name: 'Growth',
    description: 'Expanded plan for active tenants.',
    rank: 200,
    allowedModuleKeys: ['inventory', 'crm', 'hr'],
    featureFlagKeys: ['inventory:base', 'inventory:analytics', 'crm:base', 'hr:base'],
    memberLimit: 25
  }
];

function cloneRole(role: RoleDefinition): RoleDefinition {
  return {
    ...role,
    permissions: [...role.permissions]
  };
}

function clonePermission(permission: PermissionDefinition): PermissionDefinition {
  return {
    ...permission
  };
}

function clonePlan(plan: PlanDefinition): PlanDefinition {
  return {
    ...plan,
    allowedModuleKeys: [...plan.allowedModuleKeys],
    featureFlagKeys: [...plan.featureFlagKeys]
  };
}

function cloneModule(module: ModuleDefinition): ModuleDefinition {
  return {
    ...module
  };
}

function cloneFeatureFlag(featureFlag: FeatureFlagDefinition): FeatureFlagDefinition {
  return {
    ...featureFlag
  };
}

const rolesByKey = new Map(SYSTEM_ROLE_DEFINITIONS.map((role) => [role.key, role]));
const permissionsByKey = new Map(
  SYSTEM_PERMISSION_DEFINITIONS.map((permission) => [permission.key, permission])
);
const plansByKey = new Map(SYSTEM_PLAN_DEFINITIONS.map((plan) => [plan.key, plan]));
const modulesByKey = new Map(SYSTEM_MODULE_DEFINITIONS.map((module) => [module.key, module]));
const featureFlagsByKey = new Map(
  SYSTEM_FEATURE_FLAG_DEFINITIONS.map((featureFlag) => [featureFlag.key, featureFlag])
);

export const systemRbacCatalog = {
  listRoles(): RoleDefinition[] {
    return SYSTEM_ROLE_DEFINITIONS.map(cloneRole);
  },
  getRole(roleKey: string): RoleDefinition | null {
    const role = rolesByKey.get(roleKey);

    return role ? cloneRole(role) : null;
  },
  listPermissions(): PermissionDefinition[] {
    return SYSTEM_PERMISSION_DEFINITIONS.map(clonePermission);
  },
  getPermission(permissionKey: string): PermissionDefinition | null {
    const permission = permissionsByKey.get(permissionKey);

    return permission ? clonePermission(permission) : null;
  },
  listPlans(): PlanDefinition[] {
    return SYSTEM_PLAN_DEFINITIONS.map(clonePlan);
  },
  getPlan(planKey: string): PlanDefinition | null {
    const plan = plansByKey.get(planKey);

    return plan ? clonePlan(plan) : null;
  },
  listModules(): ModuleDefinition[] {
    return SYSTEM_MODULE_DEFINITIONS.map(cloneModule);
  },
  getModule(moduleKey: string): ModuleDefinition | null {
    const module = modulesByKey.get(moduleKey);

    return module ? cloneModule(module) : null;
  },
  listFeatureFlags(): FeatureFlagDefinition[] {
    return SYSTEM_FEATURE_FLAG_DEFINITIONS.map(cloneFeatureFlag);
  },
  getFeatureFlag(featureFlagKey: string): FeatureFlagDefinition | null {
    const featureFlag = featureFlagsByKey.get(featureFlagKey);

    return featureFlag ? cloneFeatureFlag(featureFlag) : null;
  }
};

