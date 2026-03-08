import { Types } from 'mongoose';

import { RoleModel } from '@/core/platform/rbac/models/role.model';
import { RbacService } from '@/core/platform/rbac/services/rbac.service';

describe('owner overlay resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grants owner-only permissions to a tenant owner without destroying the custom base role', async () => {
    const service = new RbacService();
    const tenantId = new Types.ObjectId();
    const ownerUserId = new Types.ObjectId();

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

    const authorization = await service.resolveTenantAuthorization({
      tenantId: tenantId.toString(),
      roleKey: 'tenant:auditor',
      ownerUserId: ownerUserId.toString(),
      membershipUserId: ownerUserId.toString(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    });

    expect(authorization.role.key).toBe('tenant:auditor');
    expect(authorization.isOwner).toBe(true);
    expect(authorization.permissionKeys).toEqual(
      expect.arrayContaining(['tenant:memberships:read', 'tenant:ownership:transfer'])
    );

    await expect(
      service.assertPermissionGranted(authorization, 'tenant:ownership:transfer')
    ).resolves.toBeUndefined();
    await expect(service.assertRoleGranted(authorization, 'tenant:owner')).resolves.toBeUndefined();
  });

  it('fails closed when a non-owner membership still carries the legacy tenant:owner role key', async () => {
    const service = new RbacService();
    const tenantId = new Types.ObjectId();

    await expect(
      service.resolveTenantAuthorization({
        tenantId: tenantId.toString(),
        roleKey: 'tenant:owner',
        ownerUserId: new Types.ObjectId().toString(),
        membershipUserId: new Types.ObjectId().toString(),
        planId: 'plan:starter',
        activeModuleKeys: ['inventory']
      })
    ).rejects.toMatchObject({
      code: 'RBAC_ROLE_DENIED',
      statusCode: 403
    });
  });
});
