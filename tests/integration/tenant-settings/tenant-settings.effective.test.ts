import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createTenantSettingsController } from '@/core/tenant/settings/controllers/tenant-settings.controller';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import { TenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { TenantModel } from '@/core/tenant/models/tenant.model';

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

describe('tenant settings effective view', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves platform defaults, tenant overrides and effective runtime through HTTP', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = new TenantSettingsService(
      {
        getSettingsSnapshot: vi.fn().mockResolvedValue({
          id: new Types.ObjectId().toString(),
          singletonKey: 'platform_settings',
          branding: {
            applicationName: 'API-REST-STACK-NODE',
            supportEmail: 'support@platform.test',
            supportUrl: 'https://platform.test/support'
          },
          localization: {
            defaultTimezone: 'UTC',
            defaultCurrency: 'USD',
            defaultLanguage: 'en'
          },
          security: {
            allowUserRegistration: true,
            requireEmailVerification: true
          },
          operations: {
            maintenanceMode: false
          },
          modules: {
            disabledModuleKeys: ['crm']
          },
          featureFlags: {
            disabledFeatureFlagKeys: ['inventory:analytics']
          }
        }),
        getSettings: vi.fn(),
        updateSettings: vi.fn()
      } as never,
      {
        resolveTenantRuntime: vi.fn().mockResolvedValue({
          plan: {
          key: 'plan:growth',
          name: 'Growth',
          description: 'Growth plan',
          rank: 200,
          allowedModuleKeys: ['inventory', 'crm'],
          featureFlagKeys: ['inventory:base', 'inventory:analytics', 'crm:base'],
          memberLimit: 25
          },
          activeModuleKeys: ['inventory', 'crm'],
          enabledModuleKeys: ['inventory'],
          featureFlagKeys: ['inventory:base']
        })
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
        activeModuleKeys: ['inventory', 'crm']
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
          displayName: 'Acme Regional',
          supportEmail: null,
          supportUrl: null
        },
        localization: {
          defaultTimezone: 'America/Santiago',
          defaultCurrency: null,
          defaultLanguage: null
        },
        contact: {
          primaryEmail: 'hello@acme.test',
          phone: null,
          websiteUrl: null
        },
        billing: {
          billingEmail: 'billing@acme.test',
          legalName: 'Acme SpA',
          taxId: '76.123.456-7'
        }
      })
    } as never);

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

    expect(response.status).toBe(200);
    expect(response.body.data.settings.branding.displayName).toBe('Acme Regional');
    expect(response.body.data.settings.branding.supportEmail).toBe('support@platform.test');
    expect(response.body.data.settings.runtime.planId).toBe('plan:growth');
    expect(response.body.data.settings.runtime.enabledModuleKeys).toEqual(['inventory']);
    expect(response.body.data.settings.runtime.featureFlagKeys).toEqual(['inventory:base']);
  });
});
