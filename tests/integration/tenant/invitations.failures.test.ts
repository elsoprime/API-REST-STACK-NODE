import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';
import { TenantService } from '@/core/tenant/services/tenant.service';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { InvitationModel } from '@/core/tenant/models/invitation.model';
import { UserModel } from '@/core/platform/users/models/user.model';

function createTenantFailuresApp(service = new TenantService()) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, createTenantRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant invitation failures', () => {
  beforeEach(() => {
    vi.spyOn(AuthSessionModel, 'findById').mockImplementation(async (sessionId: string) => ({
      _id: sessionId,
      userId: sessionId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a stable conflict when the invitation has expired', async () => {
    const app = createTenantFailuresApp();
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });
    const save = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: fakeUserId,
        email: 'member@example.com'
      })
    } as never);
    vi.spyOn(InvitationModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      email: 'member@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() - 1_000),
      save
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: 'expired-token'
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TENANT_INVITATION_EXPIRED');
    expect(save).toHaveBeenCalled();
  });

  it('returns a stable conflict when the invitation has been revoked', async () => {
    const app = createTenantFailuresApp();
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(UserModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: fakeUserId,
        email: 'member@example.com'
      })
    } as never);
    vi.spyOn(InvitationModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      email: 'member@example.com',
      status: 'revoked',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: 'revoked-token'
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TENANT_INVITATION_REVOKED');
  });
});
