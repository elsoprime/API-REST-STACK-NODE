import mongoose, { Types } from 'mongoose';

import { AUTH_SESSION_STATUS } from '@/constants/security';
import { InvitationModel } from '@/core/tenant/models/invitation.model';
import { TokenService } from '@/core/platform/auth/services/token.service';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { AuthService } from '@/core/platform/auth/services/auth.service';
import { TenantService } from '@/core/tenant/services/tenant.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

describe('audit write flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records an auth audit event on logoutAll', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AuthService(undefined, undefined, undefined, undefined, undefined, {
      record,
      list: vi.fn()
    } as never);
    const userId = new Types.ObjectId();
    const sessionA = {
      _id: new Types.ObjectId(),
      status: AUTH_SESSION_STATUS.ACTIVE,
      revokedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };
    const sessionB = {
      _id: new Types.ObjectId(),
      status: AUTH_SESSION_STATUS.ACTIVE,
      revokedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(AuthSessionModel, 'find').mockResolvedValue([sessionA, sessionB] as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.logoutAll({
      userId: userId.toString(),
      context: {
        traceId: 'trace-1',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: userId.toString(),
          scope: ['platform:self']
        }
      }
    });

    expect(result.revokedSessionIds).toEqual([sessionA._id.toString(), sessionB._id.toString()]);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.logout_all',
        traceId: 'trace-1',
        resource: {
          type: 'user',
          id: userId.toString()
        }
      }),
      {
        session: sessionMock
      }
    );
  });

  it('records a tenant audit event on invitation creation', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const authorization = {
      resolveRole: vi.fn().mockResolvedValue({
        key: 'tenant:member'
      })
    };
    const invitationDelivery = {
      deliver: vi.fn().mockResolvedValue(undefined)
    };
    const tenantService = new TenantService(new TokenService(), invitationDelivery as never, authorization as never, {
      record,
      list: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const invitationId = new Types.ObjectId();
    const invitation = {
      _id: invitationId,
      roleKey: 'tenant:member',
      status: 'pending',
      toObject: () => ({
        _id: invitationId,
        tenantId,
        email: 'member@example.com',
        roleKey: 'tenant:member',
        status: 'pending',
        expiresAt: new Date('2026-03-14T00:00:00.000Z')
      })
    };
    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);
    const findPendingInvitation = vi.spyOn(InvitationModel, 'findOne').mockResolvedValue(null as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    const createInvitation = vi
      .spyOn(InvitationModel, 'create')
      .mockResolvedValue([invitation] as never);

    const result = await tenantService.createInvitation({
      userId: userId.toString(),
      tenantId: tenantId.toString(),
      email: 'member@example.com',
      context: {
        traceId: 'trace-2',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: userId.toString(),
          scope: ['platform:self']
        },
        tenant: {
          tenantId: tenantId.toString(),
          roleKey: 'tenant:owner',
          isOwner: true,
          effectiveRoleKeys: ['tenant:owner']
        }
      }
    });

    expect(findPendingInvitation).toHaveBeenCalled();
    expect(createInvitation).toHaveBeenCalled();
    expect(authorization.resolveRole).toHaveBeenCalledWith({
      roleKey: 'tenant:member',
      tenantId: tenantId.toString()
    });
    expect(invitationDelivery.deliver).toHaveBeenCalled();
    expect(result.invitation.id).toBe(invitationId.toString());
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.invitation.create',
        traceId: 'trace-2',
        tenant: expect.objectContaining({
          tenantId: tenantId.toString()
        })
      }),
      {
        session: sessionMock
      }
    );
  });
});
