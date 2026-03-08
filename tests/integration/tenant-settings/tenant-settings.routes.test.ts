import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createTenantSettingsRouter } from '@/core/tenant/settings/routes/tenant-settings.routes';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function createTenantSettingsTestApp(service: {
  getSettings: ReturnType<typeof vi.fn>;
  updateSettings: ReturnType<typeof vi.fn>;
  getEffectiveSettings: ReturnType<typeof vi.fn>;
}) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(
    `${APP_CONFIG.TENANT_BASE_PATH}/settings`,
    createTenantSettingsRouter(service as never)
  );
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

describe('tenant settings routes', () => {
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

  it('reads the tenant settings singleton with the success envelope and tenant permission guard', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
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
        }
      }),
      updateSettings: vi.fn(),
      getEffectiveSettings: vi.fn()
    };
    const app = createTenantSettingsTestApp(service);

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
      .get('/api/v1/tenant/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString()
      })
    );
    expect(response.body.data.settings.singletonKey).toBe('tenant_settings');
  });

  it('updates the tenant settings singleton through PATCH with the owner permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
        singletonKey: 'tenant_settings',
        branding: {
          displayName: 'Acme South',
          supportEmail: 'support@acme.test',
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
      }),
      getEffectiveSettings: vi.fn()
    };
    const app = createTenantSettingsTestApp(service);

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
      .patch('/api/v1/tenant/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        branding: {
          displayName: 'Acme South',
          supportEmail: 'support@acme.test'
        }
      });

    expect(response.status).toBe(200);
    expect(service.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        patch: {
          branding: {
            displayName: 'Acme South',
            supportEmail: 'support@acme.test'
          }
        }
      })
    );
  });

  it('reads the effective tenant settings view', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      getEffectiveSettings: vi.fn().mockResolvedValue({
        tenantId: tenantId.toString(),
        branding: {
          displayName: 'Acme HQ',
          supportEmail: 'support@platform.test',
          supportUrl: 'https://platform.test/support'
        },
        localization: {
          defaultTimezone: 'UTC',
          defaultCurrency: 'USD',
          defaultLanguage: 'en'
        },
        contact: {
          primaryEmail: 'hello@acme.test',
          phone: null,
          websiteUrl: null
        },
        billing: {
          billingEmail: 'billing@acme.test',
          legalName: null,
          taxId: null
        },
        runtime: {
          planId: 'plan:starter',
          activeModuleKeys: ['inventory'],
          enabledModuleKeys: ['inventory'],
          featureFlagKeys: ['inventory:base']
        }
      })
    };
    const app = createTenantSettingsTestApp(service);

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
      .get('/api/v1/tenant/settings/effective')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getEffectiveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString()
      })
    );
    expect(response.body.data.settings.runtime.enabledModuleKeys).toEqual(['inventory']);
  });
});
