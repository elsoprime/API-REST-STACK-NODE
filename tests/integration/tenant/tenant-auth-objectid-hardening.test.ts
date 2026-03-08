import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';

function createTenantContextFixtureApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.get(
    '/context-check',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
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

describe('tenant auth objectId hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects tenant-scoped requests with a non-ObjectId subject instead of returning 500', async () => {
    const app = createTenantContextFixtureApp();
    const tenantId = '507f1f77bcf86cd799439011';
    const accessToken = tokenService.signAccessToken({
      sub: 'user-1',
      sid: '507f1f77bcf86cd799439012',
      scope: ['platform:self']
    });
    const tenantFindByIdSpy = vi.spyOn(TenantModel, 'findById');
    const membershipFindOneSpy = vi.spyOn(MembershipModel, 'findOne');

    const response = await request(app)
      .get('/api/v1/tenant/context-check')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
    expect(tenantFindByIdSpy).not.toHaveBeenCalled();
    expect(membershipFindOneSpy).not.toHaveBeenCalled();
  });
});
