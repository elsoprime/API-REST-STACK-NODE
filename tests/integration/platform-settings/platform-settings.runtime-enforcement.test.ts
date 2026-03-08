import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createRuntimeEnforcementApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/inventory-runtime',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:modules:inventory:use'),
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

describe('platform settings runtime enforcement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies a tenant module when it is globally disabled in PlatformSettings', async () => {
    const app = createRuntimeEnforcementApp();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
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
      roleKey: 'tenant:owner'
    } as never);
    vi.spyOn(PlatformSettingsModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        singletonKey: 'platform_settings',
        modules: {
          disabledModuleKeys: ['inventory']
        },
        featureFlags: {
          disabledFeatureFlagKeys: []
        }
      })
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/inventory-runtime')
      .set(
        'Authorization',
        `Bearer ${tokenService.signAccessToken({
          sub: userId.toString(),
          sid: userId.toString(),
          scope: ['platform:self']
        })}`
      )
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
  });
});
