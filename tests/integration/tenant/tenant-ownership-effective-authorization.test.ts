import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { RoleModel } from '@/core/platform/rbac/models/role.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { requireRole } from '@/infrastructure/middleware/requireRole.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createOwnerOverlayApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/owner-role',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requireRole('tenant:owner'),
    (_req, res) => {
      res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
    }
  );
  tenantRouter.get(
    '/owner-permission',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:ownership:transfer'),
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

describe('tenant ownership effective authorization', () => {
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

  it('grants owner-only access to the actual owner even when the base role is custom', async () => {
    const app = createOwnerOverlayApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(RoleModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        key: 'tenant:auditor',
        name: 'Tenant Auditor',
        description: 'Read-only tenant role',
        scope: 'tenant',
        tenantId,
        isSystem: false,
        hierarchyLevel: 120,
        permissions: ['tenant:memberships:read']
      })
    } as never);
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
      roleKey: 'tenant:auditor'
    } as never);

    const roleResponse = await request(app)
      .get('/api/v1/tenant/owner-role')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());
    const permissionResponse = await request(app)
      .get('/api/v1/tenant/owner-permission')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(roleResponse.status).toBe(200);
    expect(permissionResponse.status).toBe(200);
  });
});
