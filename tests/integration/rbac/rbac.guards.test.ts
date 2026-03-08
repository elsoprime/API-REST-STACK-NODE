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
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { requireRole } from '@/infrastructure/middleware/requireRole.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createRbacFixtureApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/role-guarded',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requireRole('tenant:owner'),
    (_req, res) => {
      res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
    }
  );
  tenantRouter.get(
    '/permission-guarded',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:invitations:create'),
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

describe('rbac guards', () => {
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

  it('allows access when the membership role satisfies the required role and permission', async () => {
    const app = createRbacFixtureApp();
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

    const roleResponse = await request(app)
      .get('/api/v1/tenant/role-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    const permissionResponse = await request(app)
      .get('/api/v1/tenant/permission-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(roleResponse.status).toBe(200);
    expect(permissionResponse.status).toBe(200);
  });

  it('denies access when the membership role does not satisfy the required hierarchy', async () => {
    const app = createRbacFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/role-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_ROLE_DENIED');
  });

  it('denies access when the membership lacks the required permission', async () => {
    const app = createRbacFixtureApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/permission-guarded')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
  });
});
