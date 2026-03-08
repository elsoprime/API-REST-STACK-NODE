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
import { requireModule } from '@/infrastructure/middleware/requireModule.middleware';
import { requirePlan } from '@/infrastructure/middleware/requirePlan.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createPlanModuleFixtureApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/plan-guarded',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePlan('plan:growth'),
    (_req, res) => {
      res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
    }
  );
  tenantRouter.get(
    '/module-guarded',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requireModule('crm'),
    (_req, res) => {
      res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
    }
  );

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

function buildAccessToken(userId: string): string {
  return tokenService.signAccessToken({
    sub: userId,
    sid: userId,
    scope: ['platform:self']
  });
}

describe('rbac plan and module guards', () => {
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

  it('denies access when the tenant plan is below the required level', async () => {
    const app = createPlanModuleFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId,
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/plan-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PLAN_DENIED');
  });

  it('allows access when the tenant plan satisfies the required level', async () => {
    const app = createPlanModuleFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId,
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/plan-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
  });

  it('denies access when the module is not enabled by the effective tenant plan', async () => {
    const app = createPlanModuleFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId,
      planId: 'plan:growth',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/module-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
  });

  it('allows access when the module is enabled by the effective tenant plan', async () => {
    const app = createPlanModuleFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId,
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/module-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
  });
});
