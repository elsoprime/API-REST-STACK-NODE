import { Types } from 'mongoose';

import { RoleModel } from '@/core/platform/rbac/models/role.model';
import { RbacService } from '@/core/platform/rbac/services/rbac.service';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';

describe('RbacService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves system roles from the bootstrap catalog', async () => {
    const service = new RbacService();

    const role = await service.resolveRole({
      roleKey: 'tenant:owner',
      tenantId: new Types.ObjectId().toString()
    });

    expect(role).toMatchObject({
      key: 'tenant:owner',
      isSystem: true,
      hierarchyLevel: 200
    });
    expect(role.permissions).toContain('tenant:ownership:transfer');
  });

  it('resolves custom tenant roles from the role model when not present in the system catalog', async () => {
    const service = new RbacService();
    const tenantId = new Types.ObjectId();

    vi.spyOn(RoleModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        key: 'tenant:auditor',
        name: 'Tenant Auditor',
        description: 'Read-only tenant role',
        scope: 'tenant',
        tenantId,
        isSystem: false,
        hierarchyLevel: 120,
        permissions: ['tenant:memberships:read']
      })
    } as never);

    const role = await service.resolveRole({
      roleKey: 'tenant:auditor',
      tenantId: tenantId.toString()
    });

    expect(role).toMatchObject({
      key: 'tenant:auditor',
      tenantId: tenantId.toString(),
      isSystem: false,
      permissions: ['tenant:memberships:read']
    });
  });

  it('resolves tenant authorization with plan-filtered modules and feature flags', async () => {
    const service = new RbacService();
    const tenantId = new Types.ObjectId().toString();
    vi.spyOn(PlatformSettingsModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        singletonKey: 'platform_settings',
        modules: {
          disabledModuleKeys: ['crm']
        },
        featureFlags: {
          disabledFeatureFlagKeys: ['inventory:analytics']
        }
      })
    } as never);

    const authorization = await service.resolveTenantAuthorization({
      tenantId,
      roleKey: 'tenant:owner',
      ownerUserId: tenantId,
      membershipUserId: tenantId,
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm', 'shadow-module']
    });

    expect(authorization.tenantId).toBe(tenantId);
    expect(authorization.role.key).toBe('tenant:owner');
    expect(authorization.isOwner).toBe(true);
    expect(authorization.effectiveHierarchyLevel).toBe(200);
    expect(authorization.effectiveRoleKeys).toEqual(['tenant:owner']);
    expect(authorization.plan?.key).toBe('plan:growth');
    expect(authorization.enabledModuleKeys).toEqual(['inventory']);
    expect(authorization.featureFlagKeys).toEqual(['inventory:base']);
  });

  it('denies permissions that are not granted to the resolved role', async () => {
    const service = new RbacService();
    const authorization = await service.resolveTenantAuthorization({
      tenantId: new Types.ObjectId().toString(),
      roleKey: 'tenant:member',
      ownerUserId: new Types.ObjectId().toString(),
      membershipUserId: new Types.ObjectId().toString(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    });

    await expect(
      service.assertPermissionGranted(authorization, 'tenant:ownership:transfer')
    ).rejects.toMatchObject({
      code: 'RBAC_PERMISSION_DENIED',
      statusCode: 403
    });
  });

  it('denies module-bound permissions when the effective tenant modules do not enable them', async () => {
    const service = new RbacService();
    const ownerUserId = new Types.ObjectId().toString();
    const authorization = await service.resolveTenantAuthorization({
      tenantId: new Types.ObjectId().toString(),
      roleKey: 'tenant:owner',
      ownerUserId,
      membershipUserId: ownerUserId,
      planId: 'plan:starter',
      activeModuleKeys: []
    });

    await expect(
      service.assertPermissionGranted(authorization, 'tenant:modules:inventory:use')
    ).rejects.toMatchObject({
      code: 'RBAC_MODULE_DENIED',
      statusCode: 403
    });
  });

  it('resolves tenant-scoped custom required roles against the current tenant context', async () => {
    const service = new RbacService();
    const tenantId = new Types.ObjectId();

    vi.spyOn(RoleModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        key: 'tenant:manager',
        name: 'Tenant Manager',
        description: 'Tenant manager role',
        scope: 'tenant',
        tenantId,
        isSystem: false,
        hierarchyLevel: 150,
        permissions: ['tenant:memberships:read']
      })
    } as never);

    const authorization = await service.resolveTenantAuthorization({
      tenantId: tenantId.toString(),
      roleKey: 'tenant:owner',
      ownerUserId: tenantId.toString(),
      membershipUserId: tenantId.toString(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    });

    await expect(
      service.assertRoleGranted(authorization, 'tenant:manager')
    ).resolves.toBeUndefined();
  });
});
