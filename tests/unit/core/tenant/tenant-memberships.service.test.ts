import mongoose, { Types } from 'mongoose';

import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { UserModel } from '@/core/platform/users/models/user.model';
import { TenantMembershipsService } from '@/core/tenant/memberships/services/tenant-memberships.service';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-tenant-membership'
    })
  };
}

function createAuthorizationStub() {
  return {
    resolveRole: vi.fn().mockImplementation(async ({ roleKey }: { roleKey: string }) => ({
      key: roleKey
    }))
  };
}

describe('TenantMembershipsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists tenant memberships with pagination metadata', async () => {
    const service = new TenantMembershipsService(
      createAuthorizationStub() as never,
      createAuditStub() as never
    );
    const tenantId = new Types.ObjectId();
    const ownerUserId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const memberUserId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: tenantId,
        ownerUserId
      })
    } as never);
    vi.spyOn(MembershipModel, 'aggregate').mockResolvedValue([
      {
        items: [
          {
            membershipId,
            userId: memberUserId,
            fullName: 'John Doe',
            email: 'john@example.com',
            roleKey: 'tenant:member',
            status: 'active',
            joinedAt: new Date('2026-03-01T00:00:00.000Z'),
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            isEffectiveOwner: false
          }
        ],
        totalCount: [{ value: 1 }]
      }
    ] as never);

    const result = await service.listMemberships({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 10,
      search: 'john'
    });

    expect(result).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    });
    expect(result.items[0]).toMatchObject({
      membershipId: membershipId.toString(),
      userId: memberUserId.toString(),
      fullName: 'John Doe',
      email: 'john@example.com'
    });
  });

  it('updates a tenant membership when it is not the effective owner', async () => {
    const audit = createAuditStub();
    const authorization = createAuthorizationStub();
    const service = new TenantMembershipsService(authorization as never, audit as never);
    const tenantId = new Types.ObjectId();
    const ownerUserId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const memberUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const membershipSave = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantModel, 'findById').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: tenantId,
        ownerUserId
      })
    }) as never);
    vi.spyOn(MembershipModel, 'findOne').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: membershipId,
        tenantId,
        userId: memberUserId,
        roleKey: 'tenant:member',
        status: 'active',
        joinedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        save: membershipSave
      })
    }) as never);
    vi.spyOn(UserModel, 'findById').mockImplementation(() => ({
      session: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: memberUserId,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com'
        })
      })
    }) as never);

    const result = await service.updateMembership({
      tenantId: tenantId.toString(),
      membershipId: membershipId.toString(),
      patch: {
        roleKey: 'tenant:admin',
        status: 'suspended'
      }
    });

    expect(authorization.resolveRole).toHaveBeenCalledWith({
      roleKey: 'tenant:admin',
      tenantId: tenantId.toString()
    });
    expect(membershipSave).toHaveBeenCalled();
    expect(result).toMatchObject({
      membershipId: membershipId.toString(),
      roleKey: 'tenant:admin',
      status: 'suspended'
    });
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects membership updates when the target is the effective owner', async () => {
    const service = new TenantMembershipsService(
      createAuthorizationStub() as never,
      createAuditStub() as never
    );
    const tenantId = new Types.ObjectId();
    const ownerUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantModel, 'findById').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: tenantId,
        ownerUserId
      })
    }) as never);
    vi.spyOn(MembershipModel, 'findOne').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        tenantId,
        userId: ownerUserId,
        roleKey: 'tenant:owner',
        status: 'active'
      })
    }) as never);

    await expect(
      service.updateMembership({
        tenantId: tenantId.toString(),
        membershipId: new Types.ObjectId().toString(),
        patch: {
          status: 'suspended'
        }
      })
    ).rejects.toMatchObject({
      code: 'TENANT_MEMBERSHIP_OWNER_PROTECTED',
      statusCode: 409
    });
  });

  it('deletes a tenant membership when it is not the effective owner', async () => {
    const audit = createAuditStub();
    const service = new TenantMembershipsService(
      createAuthorizationStub() as never,
      audit as never
    );
    const tenantId = new Types.ObjectId();
    const ownerUserId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const memberUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantModel, 'findById').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: tenantId,
        ownerUserId
      })
    }) as never);
    vi.spyOn(MembershipModel, 'findOne').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({
        _id: membershipId,
        tenantId,
        userId: memberUserId,
        roleKey: 'tenant:member',
        status: 'active',
        joinedAt: new Date('2026-03-01T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z')
      })
    }) as never);
    vi.spyOn(UserModel, 'findById').mockImplementation(() => ({
      session: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: memberUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      })
    }) as never);
    vi.spyOn(MembershipModel, 'deleteOne').mockImplementation(() => ({
      session: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 })
    }) as never);

    const result = await service.deleteMembership({
      tenantId: tenantId.toString(),
      membershipId: membershipId.toString()
    });

    expect(result).toMatchObject({
      membershipId: membershipId.toString(),
      email: 'john@example.com'
    });
    expect(audit.record).toHaveBeenCalled();
  });
});
