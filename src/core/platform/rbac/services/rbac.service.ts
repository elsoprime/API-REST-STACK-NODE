import { Types } from 'mongoose';

import { TENANT_ROLE_KEYS } from '@/constants/tenant';
import { HTTP_STATUS } from '@/constants/http';
import { systemRbacCatalog } from '@/core/platform/rbac/catalog/system-rbac.catalog';
import { PLATFORM_SETTINGS_SINGLETON_KEY } from '@/core/platform/settings/types/platform-settings.types';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { FeatureFlagModel } from '@/core/platform/rbac/models/feature-flag.model';
import { ModuleModel } from '@/core/platform/rbac/models/module.model';
import { PermissionModel } from '@/core/platform/rbac/models/permission.model';
import { PlanModel } from '@/core/platform/rbac/models/plan.model';
import { RoleModel } from '@/core/platform/rbac/models/role.model';
import {
  type FeatureFlagDefinition,
  type ModuleDefinition,
  type PermissionDefinition,
  type PlanDefinition,
  type RbacServiceContract,
  type ResolveRoleInput,
  type ResolveTenantRuntimeInput,
  type ResolveTenantAuthorizationInput,
  type RoleDefinition,
  type TenantRuntimeResolution,
  type TenantAuthorizationContext
} from '@/core/platform/rbac/types/rbac.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function buildRbacError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function ensureUniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function canQueryModel(
  model: { db?: { readyState?: number }; findOne?: unknown }
): boolean {
  const findOne = model.findOne as { mock?: unknown } | undefined;

  return model.db?.readyState === 1 || typeof findOne?.mock !== 'undefined';
}

function toRoleDefinition(role: {
  key: string;
  name: string;
  description: string;
  scope: 'platform' | 'tenant';
  tenantId?: Types.ObjectId | string | null;
  isSystem: boolean;
  hierarchyLevel: number;
  permissions: string[];
}): RoleDefinition {
  return {
    key: role.key,
    name: role.name,
    description: role.description,
    scope: role.scope,
    tenantId:
      typeof role.tenantId === 'undefined' || role.tenantId === null
        ? null
        : role.tenantId.toString(),
    isSystem: role.isSystem,
    hierarchyLevel: role.hierarchyLevel,
    permissions: ensureUniqueStrings(role.permissions)
  };
}

function toPermissionDefinition(permission: {
  key: string;
  scope: 'platform' | 'tenant';
  description: string;
  moduleKey?: string | null;
}): PermissionDefinition {
  return {
    key: permission.key,
    scope: permission.scope,
    description: permission.description,
    moduleKey: permission.moduleKey ?? null
  };
}

function toPlanDefinition(plan: {
  key: string;
  name: string;
  description: string;
  rank: number;
  allowedModuleKeys: string[];
  featureFlagKeys: string[];
  memberLimit?: number | null;
}): PlanDefinition {
  return {
    key: plan.key,
    name: plan.name,
    description: plan.description,
    rank: plan.rank,
    allowedModuleKeys: ensureUniqueStrings(plan.allowedModuleKeys),
    featureFlagKeys: ensureUniqueStrings(plan.featureFlagKeys),
    memberLimit: plan.memberLimit ?? null
  };
}

function toModuleDefinition(module: {
  key: string;
  name: string;
  description: string;
}): ModuleDefinition {
  return {
    key: module.key,
    name: module.name,
    description: module.description
  };
}

function toFeatureFlagDefinition(featureFlag: {
  key: string;
  name: string;
  description: string;
  moduleKey?: string | null;
  allowAdminBypass: boolean;
}): FeatureFlagDefinition {
  return {
    key: featureFlag.key,
    name: featureFlag.name,
    description: featureFlag.description,
    moduleKey: featureFlag.moduleKey ?? null,
    allowAdminBypass: featureFlag.allowAdminBypass
  };
}

function buildPlanLookupQuery(planId: string) {
  if (Types.ObjectId.isValid(planId)) {
    return {
      $or: [{ key: planId }, { _id: new Types.ObjectId(planId) }]
    };
  }

  return {
    key: planId
  };
}

function buildEffectivePermissionKeys(role: RoleDefinition, isOwner: boolean): string[] {
  if (!isOwner) {
    return ensureUniqueStrings(role.permissions);
  }

  const ownerRole = systemRbacCatalog.getRole(TENANT_ROLE_KEYS.OWNER);

  return ensureUniqueStrings([...(ownerRole?.permissions ?? []), ...role.permissions]);
}

export class RbacService implements RbacServiceContract {
  async resolveRole(input: ResolveRoleInput): Promise<RoleDefinition> {
    const systemRole = systemRbacCatalog.getRole(input.roleKey);

    if (systemRole) {
      return systemRole;
    }

    if (!input.tenantId || !Types.ObjectId.isValid(input.tenantId)) {
      throw buildRbacError(ERROR_CODES.RBAC_ROLE_NOT_FOUND, 'Role could not be resolved', HTTP_STATUS.FORBIDDEN);
    }

    const role = await RoleModel.findOne({
      key: input.roleKey,
      scope: 'tenant',
      tenantId: new Types.ObjectId(input.tenantId)
    }).lean();

    if (!role) {
      throw buildRbacError(ERROR_CODES.RBAC_ROLE_NOT_FOUND, 'Role could not be resolved', HTTP_STATUS.FORBIDDEN);
    }

    return toRoleDefinition(role);
  }

  async resolvePermission(permissionKey: string): Promise<PermissionDefinition | null> {
    const systemPermission = systemRbacCatalog.getPermission(permissionKey);

    if (systemPermission) {
      return systemPermission;
    }

    const permission = await PermissionModel.findOne({ key: permissionKey }).lean();

    return permission ? toPermissionDefinition(permission) : null;
  }

  async resolvePlan(planId: string | null): Promise<PlanDefinition | null> {
    if (!planId) {
      return null;
    }

    const systemPlan = systemRbacCatalog.getPlan(planId);

    if (systemPlan) {
      return systemPlan;
    }

    const plan = await PlanModel.findOne(buildPlanLookupQuery(planId)).lean();

    return plan ? toPlanDefinition(plan) : null;
  }

  async resolveModule(moduleKey: string): Promise<ModuleDefinition | null> {
    const systemModule = systemRbacCatalog.getModule(moduleKey);

    if (systemModule) {
      return systemModule;
    }

    if (!canQueryModel(ModuleModel)) {
      return null;
    }

    const module = await ModuleModel.findOne({ key: moduleKey }).lean();

    return module ? toModuleDefinition(module) : null;
  }

  async resolveFeatureFlag(featureFlagKey: string): Promise<FeatureFlagDefinition | null> {
    const systemFeatureFlag = systemRbacCatalog.getFeatureFlag(featureFlagKey);

    if (systemFeatureFlag) {
      return systemFeatureFlag;
    }

    if (!canQueryModel(FeatureFlagModel)) {
      return null;
    }

    const featureFlag = await FeatureFlagModel.findOne({ key: featureFlagKey }).lean();

    return featureFlag ? toFeatureFlagDefinition(featureFlag) : null;
  }

  async resolveTenantAuthorization(
    input: ResolveTenantAuthorizationInput
  ): Promise<TenantAuthorizationContext> {
    const role = await this.resolveRole({
      roleKey: input.roleKey,
      tenantId: input.tenantId
    });

    if (role.scope !== 'tenant') {
      throw buildRbacError(ERROR_CODES.RBAC_ROLE_DENIED, 'Tenant role is not valid for this resource', HTTP_STATUS.FORBIDDEN);
    }

    const isOwner = input.membershipUserId === input.ownerUserId;
    const ownerRole = systemRbacCatalog.getRole(TENANT_ROLE_KEYS.OWNER);

    if (role.key === TENANT_ROLE_KEYS.OWNER && !isOwner) {
      throw buildRbacError(
        ERROR_CODES.RBAC_ROLE_DENIED,
        'Tenant owner role is inconsistent with the current owner',
        HTTP_STATUS.FORBIDDEN
      );
    }

    const platformSettings = canQueryModel(PlatformSettingsModel)
      ? await PlatformSettingsModel.findOne({
          singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY
        }).lean()
      : null;
    const runtime = await this.resolveTenantRuntime({
      planId: input.planId,
      activeModuleKeys: input.activeModuleKeys,
      disabledModuleKeys: platformSettings?.modules?.disabledModuleKeys ?? [],
      disabledFeatureFlagKeys: platformSettings?.featureFlags?.disabledFeatureFlagKeys ?? []
    });

    return {
      tenantId: input.tenantId,
      role,
      isOwner,
      effectiveHierarchyLevel:
        isOwner && ownerRole
          ? Math.max(role.hierarchyLevel, ownerRole.hierarchyLevel)
          : role.hierarchyLevel,
      effectiveRoleKeys:
        isOwner && ownerRole ? ensureUniqueStrings([role.key, ownerRole.key]) : [role.key],
      permissionKeys: buildEffectivePermissionKeys(role, isOwner),
      plan: runtime.plan,
      activeModuleKeys: runtime.activeModuleKeys,
      enabledModuleKeys: runtime.enabledModuleKeys,
      featureFlagKeys: runtime.featureFlagKeys
    };
  }

  async resolveTenantRuntime(
    input: ResolveTenantRuntimeInput
  ): Promise<TenantRuntimeResolution> {
    const plan = await this.resolvePlan(input.planId);
    const requestedActiveModuleKeys = ensureUniqueStrings(input.activeModuleKeys);
    const activeModuleKeys =
      plan && requestedActiveModuleKeys.length === 0
        ? [...plan.allowedModuleKeys]
        : requestedActiveModuleKeys;
    const globallyDisabledModuleKeys = ensureUniqueStrings(input.disabledModuleKeys ?? []);
    const globallyDisabledFeatureFlagKeys = ensureUniqueStrings(
      input.disabledFeatureFlagKeys ?? []
    );
    const enabledModuleKeys = plan
      ? activeModuleKeys.filter(
          (moduleKey) =>
            plan.allowedModuleKeys.includes(moduleKey) &&
            !globallyDisabledModuleKeys.includes(moduleKey)
        )
      : [];
    const featureFlagKeys = plan
      ? (
          await Promise.all(
            plan.featureFlagKeys.map(async (featureFlagKey) => {
              const featureFlag = await this.resolveFeatureFlag(featureFlagKey);

              if (!featureFlag) {
                return null;
              }

              if (globallyDisabledFeatureFlagKeys.includes(featureFlag.key)) {
                return null;
              }

              if (!featureFlag.moduleKey || enabledModuleKeys.includes(featureFlag.moduleKey)) {
                return featureFlag.key;
              }

              return null;
            })
          )
        ).filter((featureFlagKey): featureFlagKey is string => Boolean(featureFlagKey))
      : [];

    return {
      plan,
      activeModuleKeys,
      enabledModuleKeys,
      featureFlagKeys
    };
  }

  async assertRoleGranted(
    authorization: TenantAuthorizationContext,
    requiredRoleKey: string,
    options: { allowPlatformSuperAdmin?: boolean } = {}
  ): Promise<void> {
    if (options.allowPlatformSuperAdmin && authorization.role.key === 'platform:super_admin') {
      return;
    }

    const requiredRole = await this.resolveRole({
      roleKey: requiredRoleKey,
      tenantId: authorization.tenantId
    });

    if (requiredRole.scope === 'tenant' && requiredRole.key === TENANT_ROLE_KEYS.OWNER) {
      if (!authorization.isOwner) {
        throw buildRbacError(ERROR_CODES.RBAC_ROLE_DENIED, 'Role requirements are not satisfied', HTTP_STATUS.FORBIDDEN);
      }

      return;
    }

    if (
      authorization.role.scope !== requiredRole.scope ||
      authorization.effectiveHierarchyLevel < requiredRole.hierarchyLevel
    ) {
      throw buildRbacError(ERROR_CODES.RBAC_ROLE_DENIED, 'Role requirements are not satisfied', HTTP_STATUS.FORBIDDEN);
    }
  }

  async assertPermissionGranted(
    authorization: TenantAuthorizationContext,
    permissionKey: string,
    options: { allowPlatformSuperAdmin?: boolean } = {}
  ): Promise<void> {
    if (options.allowPlatformSuperAdmin && authorization.role.key === 'platform:super_admin') {
      return;
    }

    const permission = await this.resolvePermission(permissionKey);

    if (!permission || !authorization.permissionKeys.includes(permission.key)) {
      throw buildRbacError(
        ERROR_CODES.RBAC_PERMISSION_DENIED,
        'Permission requirements are not satisfied',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (permission.scope !== authorization.role.scope) {
      throw buildRbacError(
        ERROR_CODES.RBAC_PERMISSION_DENIED,
        'Permission scope is not valid for the current authorization context',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (permission.moduleKey && !authorization.enabledModuleKeys.includes(permission.moduleKey)) {
      throw buildRbacError(
        ERROR_CODES.RBAC_MODULE_DENIED,
        'Module requirements are not satisfied',
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  async assertPlanGranted(
    authorization: TenantAuthorizationContext,
    requiredPlanKey: string
  ): Promise<void> {
    const requiredPlan = await this.resolvePlan(requiredPlanKey);

    if (!authorization.plan || !requiredPlan || authorization.plan.rank < requiredPlan.rank) {
      throw buildRbacError(ERROR_CODES.RBAC_PLAN_DENIED, 'Plan requirements are not satisfied', HTTP_STATUS.FORBIDDEN);
    }
  }

  async assertModuleGranted(
    authorization: TenantAuthorizationContext,
    moduleKey: string
  ): Promise<void> {
    const module = await this.resolveModule(moduleKey);

    if (!module || !authorization.enabledModuleKeys.includes(module.key)) {
      throw buildRbacError(ERROR_CODES.RBAC_MODULE_DENIED, 'Module requirements are not satisfied', HTTP_STATUS.FORBIDDEN);
    }
  }
}

export const rbacService = new RbacService();
