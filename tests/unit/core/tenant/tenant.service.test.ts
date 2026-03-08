import mongoose, { Types } from 'mongoose';

import { AUTH_SESSION_STATUS } from '@/constants/security';
import { DEFAULT_AUTH_SCOPE } from '@/core/platform/auth/types/auth.types';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { UserModel } from '@/core/platform/users/models/user.model';
import { InvitationModel } from '@/core/tenant/models/invitation.model';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantService } from '@/core/tenant/services/tenant.service';
import { InMemoryTenantInvitationDeliveryAdapter } from '@/infrastructure/tenant/tenant-invitation-delivery.memory';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

function createAuthorizationStub() {
  return {
    resolveRole: vi.fn().mockImplementation(async ({ roleKey }: { roleKey: string }) => ({
      key: roleKey
    })),
    resolvePlan: vi.fn().mockResolvedValue(null)
  };
}

describe('TenantService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a tenant with its initial owner membership', async () => {
    const service = new TenantService(undefined, undefined, undefined, createAuditStub() as never);
    const fakeUserId = new Types.ObjectId();
    const fakeTenantId = new Types.ObjectId();
    const fakeMembershipId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(TenantModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: fakeUserId
      })
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantModel, 'create').mockResolvedValue([
      {
        _id: fakeTenantId,
        toObject: () => ({
          _id: fakeTenantId,
          name: 'Acme',
          slug: 'acme',
          status: 'active',
          ownerUserId: fakeUserId,
          planId: null,
          activeModuleKeys: [],
          memberLimit: null
        })
      }
    ] as never);
    vi.spyOn(MembershipModel, 'create').mockResolvedValue([
      {
        _id: fakeMembershipId,
        toObject: () => ({
          _id: fakeMembershipId,
          tenantId: fakeTenantId,
          userId: fakeUserId,
          roleKey: 'tenant:owner',
          status: 'active'
        })
      }
    ] as never);

    const result = await service.createTenant({
      userId: fakeUserId.toString(),
      name: 'Acme'
    });

    expect(result.tenant).toMatchObject({
      name: 'Acme',
      slug: 'acme',
      ownerUserId: fakeUserId.toString()
    });
    expect(result.membership).toMatchObject({
      tenantId: fakeTenantId.toString(),
      userId: fakeUserId.toString(),
      roleKey: 'tenant:owner'
    });
  });

  it('delivers invitation tokens through the configured adapter instead of HTTP', async () => {
    const deliveryAdapter = new InMemoryTenantInvitationDeliveryAdapter();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new TenantService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyAccessToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      deliveryAdapter,
      createAuthorizationStub() as never,
      createAuditStub() as never
    );
    const fakeTenantId = new Types.ObjectId();
    const fakeOwnerUserId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeOwnerUserId,
      planId: null,
      activeModuleKeys: []
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);
    vi.spyOn(InvitationModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(InvitationModel, 'create').mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        roleKey: 'tenant:member',
        toObject: () => ({
          _id: new Types.ObjectId(),
          tenantId: fakeTenantId,
          email: 'member@example.com',
          roleKey: 'tenant:member',
          status: 'pending',
          expiresAt: new Date('2026-03-14T00:00:00.000Z')
        })
      }
    ] as never);

    const result = await service.createInvitation({
      userId: fakeOwnerUserId.toString(),
      tenantId: fakeTenantId.toString(),
      email: 'member@example.com'
    });
    const delivery = deliveryAdapter.peekLatestByEmail('member@example.com');

    expect(result.invitation.email).toBe('member@example.com');
    expect(delivery).toMatchObject({
      email: 'member@example.com',
      tenantId: fakeTenantId.toString()
    });
    expect(delivery?.token).toBeDefined();
  });

  it('switches the active tenant and returns a tenant-bound access token', async () => {
    const signAccessToken = vi.fn().mockReturnValue('tenant-access-token');
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new TenantService({
      signAccessToken,
      hashToken: vi.fn(),
      signRefreshToken: vi.fn(),
      generateCsrfToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn()
    } as never, undefined, undefined, createAuditStub() as never);
    const fakeUserId = new Types.ObjectId();
    const fakeTenantId = new Types.ObjectId();
    const fakeMembershipId = new Types.ObjectId();
    const fakeSessionId = new Types.ObjectId();
    const sessionSave = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      name: 'Acme',
      slug: 'acme',
      status: 'active',
      ownerUserId: fakeUserId,
      planId: null,
      activeModuleKeys: [],
      memberLimit: null,
      toObject: () => ({
        _id: fakeTenantId,
        name: 'Acme',
        slug: 'acme',
        status: 'active',
        ownerUserId: fakeUserId,
        planId: null,
        activeModuleKeys: [],
        memberLimit: null
      })
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: fakeMembershipId,
      tenantId: fakeTenantId,
      userId: fakeUserId,
      roleKey: 'tenant:owner',
      status: 'active',
      toObject: () => ({
        _id: fakeMembershipId,
        tenantId: fakeTenantId,
        userId: fakeUserId,
        roleKey: 'tenant:owner',
        status: 'active'
      })
    } as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: fakeSessionId,
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
      save: sessionSave
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.switchActiveTenant({
      userId: fakeUserId.toString(),
      sessionId: fakeSessionId.toString(),
      tenantId: fakeTenantId.toString(),
      scope: [...DEFAULT_AUTH_SCOPE]
    });

    expect(sessionSave).toHaveBeenCalled();
    expect(signAccessToken).toHaveBeenCalledWith({
      sub: fakeUserId.toString(),
      sid: fakeSessionId.toString(),
      scope: [...DEFAULT_AUTH_SCOPE],
      tenantId: fakeTenantId.toString(),
      membershipId: fakeMembershipId.toString()
    });
    expect(result.accessToken).toBe('tenant-access-token');
  });

  it('rejects tenant switch when the auth session has already been revoked', async () => {
    const service = new TenantService(undefined, undefined, undefined, createAuditStub() as never);
    const fakeUserId = new Types.ObjectId();
    const fakeTenantId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active'
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      tenantId: fakeTenantId,
      userId: fakeUserId,
      roleKey: 'tenant:member',
      status: 'active'
    } as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.REVOKED,
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    await expect(
      service.switchActiveTenant({
        userId: fakeUserId.toString(),
        sessionId: new Types.ObjectId().toString(),
        tenantId: fakeTenantId.toString(),
        scope: [...DEFAULT_AUTH_SCOPE]
      })
    ).rejects.toMatchObject({
      code: 'AUTH_UNAUTHENTICATED',
      statusCode: 401
    });
  });

  it('transfers ownership to another active membership in the same tenant', async () => {
    const service = new TenantService(undefined, undefined, undefined, createAuditStub() as never);
    const fakeTenantId = new Types.ObjectId();
    const currentOwnerUserId = new Types.ObjectId();
    const nextOwnerUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const tenantSave = vi.fn().mockResolvedValue(undefined);
    const currentOwnerSave = vi.fn().mockResolvedValue(undefined);
    const nextOwnerSave = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      ownerUserId: currentOwnerUserId,
      save: tenantSave,
      toObject: () => ({
        _id: fakeTenantId,
        name: 'Acme',
        slug: 'acme',
        status: 'active',
        ownerUserId: nextOwnerUserId,
        planId: null,
        activeModuleKeys: [],
        memberLimit: null
      })
    } as never);
    vi.spyOn(MembershipModel, 'findOne')
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId: fakeTenantId,
        userId: currentOwnerUserId,
        roleKey: 'tenant:owner',
        status: 'active',
        save: currentOwnerSave
      } as never)
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId: fakeTenantId,
        userId: nextOwnerUserId,
        roleKey: 'tenant:member',
        status: 'active',
        save: nextOwnerSave,
        toObject: () => ({
          _id: new Types.ObjectId(),
          tenantId: fakeTenantId,
          userId: nextOwnerUserId,
          roleKey: 'tenant:member',
          status: 'active'
        })
      } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.transferOwnership({
      userId: currentOwnerUserId.toString(),
      tenantId: fakeTenantId.toString(),
      targetUserId: nextOwnerUserId.toString()
    });

    expect(tenantSave).toHaveBeenCalled();
    expect(currentOwnerSave).toHaveBeenCalled();
    expect(nextOwnerSave).toHaveBeenCalled();
    expect(result.membership).toMatchObject({
      userId: nextOwnerUserId.toString(),
      roleKey: 'tenant:member'
    });
  });

  it('rejects ownership transfer when the actor is not the current owner even if the membership is active', async () => {
    const service = new TenantService(undefined, undefined, undefined, createAuditStub() as never);
    const fakeTenantId = new Types.ObjectId();
    const actorUserId = new Types.ObjectId();
    const actualOwnerUserId = new Types.ObjectId();
    const targetUserId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      ownerUserId: actualOwnerUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne')
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId: fakeTenantId,
        userId: actorUserId,
        roleKey: 'tenant:owner',
        status: 'active'
      } as never)
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId: fakeTenantId,
        userId: targetUserId,
        roleKey: 'tenant:member',
        status: 'active'
      } as never);

    await expect(
      service.transferOwnership({
        userId: actorUserId.toString(),
        tenantId: fakeTenantId.toString(),
        targetUserId: targetUserId.toString()
      })
    ).rejects.toMatchObject({
      code: 'TENANT_OWNER_REQUIRED',
      statusCode: 403
    });
  });

  it('preserves custom roles during ownership transfer while updating the owner invariant', async () => {
    const service = new TenantService(undefined, undefined, undefined, createAuditStub() as never);
    const fakeTenantId = new Types.ObjectId();
    const currentOwnerUserId = new Types.ObjectId();
    const nextOwnerUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const tenantSave = vi.fn().mockResolvedValue(undefined);
    const currentOwnerSave = vi.fn().mockResolvedValue(undefined);
    const nextOwnerSave = vi.fn().mockResolvedValue(undefined);
    const currentOwnerMembership = {
      _id: new Types.ObjectId(),
      tenantId: fakeTenantId,
      userId: currentOwnerUserId,
      roleKey: 'tenant:admin',
      status: 'active',
      save: currentOwnerSave
    };
    const nextOwnerMembership = {
      _id: new Types.ObjectId(),
      tenantId: fakeTenantId,
      userId: nextOwnerUserId,
      roleKey: 'tenant:auditor',
      status: 'active',
      save: nextOwnerSave,
      toObject: () => ({
        _id: new Types.ObjectId(),
        tenantId: fakeTenantId,
        userId: nextOwnerUserId,
        roleKey: 'tenant:auditor',
        status: 'active'
      })
    };

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      ownerUserId: currentOwnerUserId,
      save: tenantSave,
      toObject: () => ({
        _id: fakeTenantId,
        name: 'Acme',
        slug: 'acme',
        status: 'active',
        ownerUserId: nextOwnerUserId,
        planId: null,
        activeModuleKeys: [],
        memberLimit: null
      })
    } as never);
    vi.spyOn(MembershipModel, 'findOne')
      .mockResolvedValueOnce(currentOwnerMembership as never)
      .mockResolvedValueOnce(nextOwnerMembership as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.transferOwnership({
      userId: currentOwnerUserId.toString(),
      tenantId: fakeTenantId.toString(),
      targetUserId: nextOwnerUserId.toString()
    });

    expect(currentOwnerMembership.roleKey).toBe('tenant:admin');
    expect(nextOwnerMembership.roleKey).toBe('tenant:auditor');
    expect(tenantSave).toHaveBeenCalled();
    expect(currentOwnerSave).toHaveBeenCalled();
    expect(nextOwnerSave).toHaveBeenCalled();
    expect(result.tenant.ownerUserId).toBe(nextOwnerUserId.toString());
    expect(result.membership.roleKey).toBe('tenant:auditor');
  });
});
