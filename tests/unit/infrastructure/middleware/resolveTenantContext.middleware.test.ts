import { Types } from 'mongoose';

import { APP_CONFIG } from '@/config/app';
import { RoleModel } from '@/core/platform/rbac/models/role.model';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

describe('resolveTenantContext middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires the tenant header', async () => {
    const next = vi.fn();

    await resolveTenantContextMiddleware(
      {
        header: vi.fn().mockReturnValue(undefined)
      } as never,
      {
        locals: {
          auth: {
            userId: 'user-1'
          }
        }
      } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'TENANT_HEADER_REQUIRED',
        statusCode: 400
      })
    );
  });

  it('resolves tenant context for an active tenant membership', async () => {
    const fakeTenantId = new Types.ObjectId();
    const fakeMembershipId = new Types.ObjectId();
    const fakeUserId = new Types.ObjectId();
    const res = {
      locals: {
        auth: {
          userId: fakeUserId.toString()
        }
      }
    };
    const next = vi.fn();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: fakeMembershipId,
      userId: fakeUserId,
      roleKey: 'tenant:owner',
      status: 'active'
    } as never);

    await resolveTenantContextMiddleware(
      {
        header: vi.fn((name: string) =>
          name === APP_CONFIG.TENANT_ID_HEADER ? fakeTenantId.toString() : undefined
        )
      } as never,
      res as never,
      next
    );

    expect(res.locals.tenantContext).toEqual({
      tenantId: fakeTenantId.toString(),
      membershipId: fakeMembershipId.toString(),
      roleKey: 'tenant:owner',
      authorization: expect.objectContaining({
        role: expect.objectContaining({
          key: 'tenant:owner'
        }),
        tenantId: fakeTenantId.toString(),
        isOwner: true,
        effectiveHierarchyLevel: 200,
        effectiveRoleKeys: expect.arrayContaining(['tenant:owner']),
        permissionKeys: expect.arrayContaining(['tenant:invitations:create']),
        plan: null,
        activeModuleKeys: [],
        enabledModuleKeys: [],
        featureFlagKeys: []
      })
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects memberships with an unresolvable role key', async () => {
    const fakeTenantId = new Types.ObjectId();
    const fakeUserId = new Types.ObjectId();
    const next = vi.fn();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      roleKey: 'tenant:ghost',
      status: 'active'
    } as never);
    vi.spyOn(RoleModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    await resolveTenantContextMiddleware(
      {
        header: vi.fn((name: string) =>
          name === APP_CONFIG.TENANT_ID_HEADER ? fakeTenantId.toString() : undefined
        )
      } as never,
      {
        locals: {
          auth: {
            userId: fakeUserId.toString()
          }
        }
      } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RBAC_ROLE_NOT_FOUND',
        statusCode: 403
      })
    );
  });

  it('rejects authenticated subjects that are not valid ObjectIds before querying tenant data', async () => {
    const next = vi.fn();
    const tenantFindByIdSpy = vi.spyOn(TenantModel, 'findById');
    const membershipFindOneSpy = vi.spyOn(MembershipModel, 'findOne');

    await resolveTenantContextMiddleware(
      {
        header: vi.fn((name: string) =>
          name === APP_CONFIG.TENANT_ID_HEADER ? '507f1f77bcf86cd799439011' : undefined
        )
      } as never,
      {
        locals: {
          auth: {
            userId: 'user-1'
          }
        }
      } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_UNAUTHENTICATED',
        statusCode: 401
      })
    );
    expect(tenantFindByIdSpy).not.toHaveBeenCalled();
    expect(membershipFindOneSpy).not.toHaveBeenCalled();
  });
});
