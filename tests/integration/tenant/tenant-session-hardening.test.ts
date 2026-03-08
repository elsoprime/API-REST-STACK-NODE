import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AUTH_SESSION_STATUS } from '@/constants/security';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';
import { TenantService } from '@/core/tenant/services/tenant.service';

function createTenantSessionApp(service = new TenantService()) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, createTenantRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant session hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects tenant switch when the auth session has been revoked', async () => {
    const app = createTenantSessionApp();
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeMembershipId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: '507f1f77bcf86cd799439013',
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active'
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: fakeMembershipId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.REVOKED,
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/switch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tenantId: fakeTenantId.toString()
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
  });

  it('rejects tenant switch when the auth session has expired', async () => {
    const app = createTenantSessionApp();
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeMembershipId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: '507f1f77bcf86cd799439013',
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active'
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: fakeMembershipId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.ACTIVE,
      expiresAt: new Date(Date.now() - 60_000)
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/switch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tenantId: fakeTenantId.toString()
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
  });
});
