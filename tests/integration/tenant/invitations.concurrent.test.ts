import mongoose, { Types } from 'mongoose';

import { TenantService } from '@/core/tenant/services/tenant.service';
import { InvitationModel } from '@/core/tenant/models/invitation.model';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { UserModel } from '@/core/platform/users/models/user.model';

describe('tenant invitation concurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps duplicate membership conflicts during concurrent acceptance to a stable 409 error', async () => {
    const service = new TenantService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyAccessToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never
    );
    const fakeUserId = new Types.ObjectId();
    const fakeTenantId = new Types.ObjectId();
    const fakeInvitationId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const invitationDoc = {
      _id: fakeInvitationId,
      tenantId: fakeTenantId,
      email: 'member@example.com',
      roleKey: 'tenant:member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      invitedByUserId: new Types.ObjectId(),
      acceptedAt: null,
      acceptedByUserId: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: fakeUserId,
        email: 'member@example.com'
      })
    } as never);
    vi.spyOn(InvitationModel, 'findOne')
      .mockResolvedValueOnce(invitationDoc as never)
      .mockReturnValueOnce({
        session: vi.fn().mockResolvedValue(invitationDoc)
      } as never);
    vi.spyOn(TenantModel, 'findById')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: fakeTenantId,
          name: 'Acme',
          slug: 'acme',
          status: 'active',
          ownerUserId: new Types.ObjectId(),
          planId: null,
          activeModuleKeys: [],
          memberLimit: null
        })
      } as never)
      .mockReturnValueOnce({
        session: vi.fn().mockResolvedValue({
          _id: fakeTenantId,
          memberLimit: null
        })
      } as never);
    vi.spyOn(MembershipModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(null)
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(MembershipModel, 'create').mockRejectedValue({
      code: 11000
    });

    await expect(
      service.acceptInvitation({
        userId: fakeUserId.toString(),
        token: 'secure-token'
      })
    ).rejects.toMatchObject({
      code: 'TENANT_INVITATION_ALREADY_ACCEPTED',
      statusCode: 409
    });
  });
});
