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

function createTenantContextContractApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/context-contract',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    (_req, res) => {
      res.json(
        buildSuccess(
          {
            tenantId: res.locals.tenantContext.tenantId
          },
          res.locals.traceId
        )
      );
    }
  );

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant context contract', () => {
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

  it('rejects tenant-scoped requests when the tenant is inactive', async () => {
    const app = createTenantContextContractApp();
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'suspended',
      ownerUserId: new Types.ObjectId()
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/context-contract')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_INACTIVE');
  });

  it('rejects tenant-scoped requests when a tenant-bound token points to another tenant', async () => {
    const app = createTenantContextContractApp();
    const tenantId = new Types.ObjectId();
    const tokenTenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self'],
      tenantId: tokenTenantId.toString()
    });
    const tenantFindByIdSpy = vi.spyOn(TenantModel, 'findById');
    const membershipFindOneSpy = vi.spyOn(MembershipModel, 'findOne');

    const response = await request(app)
      .get('/api/v1/tenant/context-contract')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SCOPE_MISMATCH');
    expect(tenantFindByIdSpy).not.toHaveBeenCalled();
    expect(membershipFindOneSpy).not.toHaveBeenCalled();
  });

  it('rejects tenant-scoped requests when membership scope does not match the resolved membership', async () => {
    const app = createTenantContextContractApp();
    const tenantId = new Types.ObjectId();
    const tokenMembershipId = new Types.ObjectId();
    const resolvedMembershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self'],
      tenantId: tenantId.toString(),
      membershipId: tokenMembershipId.toString()
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId()
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: resolvedMembershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/context-contract')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SCOPE_MISMATCH');
  });

  it('rejects memberships with a non-resolvable role key value', async () => {
    const app = createTenantContextContractApp();
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId()
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: '   '
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/context-contract')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_ACCESS_DENIED');
  });
});

