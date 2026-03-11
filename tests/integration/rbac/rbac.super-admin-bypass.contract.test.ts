import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { requireRole } from '@/infrastructure/middleware/requireRole.middleware';

function createSuperAdminBypassContractApp() {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();

  tenantRouter.use((_req, res, next) => {
    res.locals.tenantContext = {
      tenantId: '507f1f77bcf86cd799439011',
      membershipId: '507f1f77bcf86cd799439012',
      roleKey: 'platform:super_admin',
      authorization: {
        tenantId: '507f1f77bcf86cd799439011',
        role: {
          key: 'platform:super_admin',
          name: 'Platform Super Admin',
          description: 'Administrative platform role',
          scope: 'platform',
          tenantId: null,
          isSystem: true,
          hierarchyLevel: 1000,
          permissions: ['*']
        },
        isOwner: false,
        effectiveHierarchyLevel: 1000,
        effectiveRoleKeys: ['platform:super_admin'],
        permissionKeys: ['*'],
        plan: null,
        activeModuleKeys: [],
        enabledModuleKeys: [],
        featureFlagKeys: []
      }
    };
    next();
  });

  tenantRouter.get('/role-default', requireRole('tenant:owner'), (_req, res) => {
    res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
  });
  tenantRouter.get(
    '/role-bypass',
    requireRole('tenant:owner', undefined, { allowPlatformSuperAdmin: true }),
    (_req, res) => {
      res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
    }
  );
  tenantRouter.get('/permission-default', requirePermission('tenant:settings:update'), (_req, res) => {
    res.json(buildSuccess({ access: 'granted' }, res.locals.traceId));
  });
  tenantRouter.get(
    '/permission-bypass',
    requirePermission('tenant:settings:update', undefined, { allowPlatformSuperAdmin: true }),
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

describe('rbac super-admin bypass contract', () => {
  it('denies super-admin tenant role access by default when bypass is not explicitly enabled', async () => {
    const app = createSuperAdminBypassContractApp();
    const roleResponse = await request(app).get('/api/v1/tenant/role-default');
    const permissionResponse = await request(app).get('/api/v1/tenant/permission-default');

    expect(roleResponse.status).toBe(403);
    expect(roleResponse.body.error.code).toBe('RBAC_ROLE_DENIED');
    expect(permissionResponse.status).toBe(403);
    expect(permissionResponse.body.error.code).toBe('RBAC_PERMISSION_DENIED');
  });

  it('allows super-admin access only when the guard declares allowPlatformSuperAdmin', async () => {
    const app = createSuperAdminBypassContractApp();
    const roleResponse = await request(app).get('/api/v1/tenant/role-bypass');
    const permissionResponse = await request(app).get('/api/v1/tenant/permission-bypass');

    expect(roleResponse.status).toBe(200);
    expect(permissionResponse.status).toBe(200);
  });
});
