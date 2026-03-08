import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createTenantSettingsController } from '@/core/tenant/settings/controllers/tenant-settings.controller';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import { updateTenantSettingsSchema } from '@/core/tenant/settings/schemas/tenant-settings.schemas';
import { TenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';

function createTenantSettingsAuditApp(service: TenantSettingsService, tenantId: string) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const tenantRouter = Router();
  const controller = createTenantSettingsController(service);

  tenantRouter.patch(
    '/settings',
    authenticateMiddleware,
    (_req, res, next) => {
      res.locals.tenantContext = {
        tenantId,
        membershipId: new Types.ObjectId().toString(),
        roleKey: 'tenant:owner',
        authorization: {
          tenantId,
          role: {
            key: 'tenant:owner',
            name: 'Tenant Owner',
            description: 'System tenant owner role.',
            scope: 'tenant',
            tenantId: null,
            isSystem: true,
            hierarchyLevel: 200,
            permissions: ['tenant:settings:update', 'tenant:settings:read']
          },
          isOwner: true,
          effectiveHierarchyLevel: 200,
          effectiveRoleKeys: ['tenant:owner'],
          permissionKeys: ['tenant:settings:update', 'tenant:settings:read'],
          plan: null,
          activeModuleKeys: [],
          enabledModuleKeys: [],
          featureFlagKeys: []
        }
      };
      next();
    },
    requirePermission('tenant:settings:update'),
    validateBody(updateTenantSettingsSchema),
    controller.updateSettings
  );

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant settings audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a tenant-scoped audit event when the singleton is updated through HTTP', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-tenant-settings-update'
      })
    };
    const service = new TenantSettingsService(undefined, undefined, audit as never);
    const app = createTenantSettingsAuditApp(service, tenantId.toString());
    const settingsDocument = {
      _id: settingsId,
      tenantId,
      singletonKey: 'tenant_settings',
      branding: {
        displayName: null,
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
      },
      toObject() {
        return {
          _id: this._id,
          tenantId: this.tenantId,
          singletonKey: this.singletonKey,
          branding: { ...this.branding },
          localization: { ...this.localization },
          contact: { ...this.contact },
          billing: { ...this.billing }
        };
      },
      save: vi.fn().mockResolvedValue(undefined)
    };

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
        planId: 'plan:starter',
        activeModuleKeys: ['inventory']
      })
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantSettingsModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(settingsDocument)
    } as never);

    const response = await request(app)
      .patch('/api/v1/tenant/settings')
      .set(
        'Authorization',
        `Bearer ${tokenService.signAccessToken({
          sub: userId.toString(),
          sid: userId.toString(),
          scope: ['platform:self']
        })}`
      )
      .send({
        branding: {
          displayName: 'Acme South'
        }
      });

    expect(response.status).toBe(200);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tenant',
        action: 'tenant.settings.update',
        resource: {
          type: 'tenant_settings',
          id: settingsId.toString()
        }
      }),
      {
        session: sessionMock
      }
    );
  });
});
