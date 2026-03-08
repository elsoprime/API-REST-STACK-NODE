import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { createTenantSettingsController } from '@/core/tenant/settings/controllers/tenant-settings.controller';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import { TenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';

function createTenantSettingsEffectiveApp(service: TenantSettingsService, tenantId: string) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();
  const controller = createTenantSettingsController(service);

  tenantRouter.get(
    '/settings/effective',
    authenticateMiddleware,
    (_req, res, next) => {
      res.locals.tenantContext = {
        tenantId,
        membershipId: new Types.ObjectId().toString(),
        roleKey: 'tenant:member',
        authorization: {
          tenantId,
          role: {
            key: 'tenant:member',
            name: 'Tenant Member',
            description: 'Base tenant member role.',
            scope: 'tenant',
            tenantId: null,
            isSystem: true,
            hierarchyLevel: 100,
            permissions: ['tenant:settings:read']
          },
          isOwner: false,
          effectiveHierarchyLevel: 100,
          effectiveRoleKeys: ['tenant:member'],
          permissionKeys: ['tenant:settings:read'],
          plan: null,
          activeModuleKeys: [],
          enabledModuleKeys: [],
          featureFlagKeys: []
        }
      };
      next();
    },
    requirePermission('tenant:settings:read'),
    controller.getEffectiveSettings
  );

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant settings effective platform bootstrap guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails closed when platform settings are missing and does not bootstrap platform state from a tenant-scoped read', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = new TenantSettingsService(
      undefined,
      {
        resolveTenantRuntime: vi.fn()
      } as never,
      {
        record: vi.fn()
      } as never
    );
    const app = createTenantSettingsEffectiveApp(service, tenantId.toString());

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: tenantId,
        name: 'Acme HQ',
        planId: 'plan:growth',
        activeModuleKeys: ['inventory']
      })
    } as never);
    vi.spyOn(TenantSettingsModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      tenantId,
      singletonKey: 'tenant_settings',
      toObject: () => ({
        tenantId,
        singletonKey: 'tenant_settings',
        branding: {
          displayName: 'Acme HQ',
          supportEmail: null,
          supportUrl: null
        },
        localization: {
          defaultTimezone: null,
          defaultCurrency: null,
          defaultLanguage: null
        },
        contact: {
          primaryEmail: null,
          phone: null,
          websiteUrl: null
        },
        billing: {
          billingEmail: null,
          legalName: null,
          taxId: null
        }
      })
    } as never);
    vi.spyOn(PlatformSettingsModel, 'findOne').mockResolvedValue(null as never);
    const createSpy = vi.spyOn(PlatformSettingsModel, 'create');

    const response = await request(app)
      .get('/api/v1/tenant/settings/effective')
      .set(
        'Authorization',
        `Bearer ${tokenService.signAccessToken({
          sub: userId.toString(),
          sid: userId.toString(),
          scope: ['platform:self']
        })}`
      );

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
