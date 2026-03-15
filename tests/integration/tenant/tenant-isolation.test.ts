import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createTenantIsolationApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/protected',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    (_req, res) => {
      res.json(buildSuccess({ tenantId: res.locals.tenantContext.tenantId }, res.locals.traceId));
    }
  );
  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant isolation', () => {
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

  it('denies access to a tenant where the user has no membership', async () => {
    const app = createTenantIsolationApp();
    const fakeTenantId = new Types.ObjectId();
    const fakeUserId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId()
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue(null as never);

    const response = await request(app)
      .get('/api/v1/tenant/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_MEMBERSHIP_REQUIRED');
  });

  it('denies access when the tenant membership is suspended', async () => {
    const app = createTenantIsolationApp();
    const fakeTenantId = new Types.ObjectId();
    const fakeUserId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId()
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      status: 'suspended',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_MEMBERSHIP_INACTIVE');
  });

  it('allows access when the user belongs to the requested tenant', async () => {
    const app = createTenantIsolationApp();
    const fakeTenantId = new Types.ObjectId();
    const fakeMembershipId = new Types.ObjectId();
    const fakeUserId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: fakeMembershipId,
      userId: fakeUserId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString());

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      tenantId: fakeTenantId.toString()
    });
  });
});

