import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AUTH_SCOPES } from '@/constants/security';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { PlatformScopeGrantService } from '@/core/platform/auth/services/platform-scope-grant.service';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createPlatformSettingsRouter } from '@/core/platform/settings/routes/platform-settings.routes';
import { AppError } from '@/infrastructure/errors/app-error';

function createPlatformSettingsTestApp(service: {
  getSettings: ReturnType<typeof vi.fn>;
  updateSettings: ReturnType<typeof vi.fn>;
}) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.PLATFORM_BASE_PATH, createPlatformSettingsRouter(service as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('platform settings routes', () => {
  const platformScopeGrants = new PlatformScopeGrantService(['admin@example.com']);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the singleton with the success envelope and platform permission guard', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        singletonKey: 'platform_settings',
        branding: {
          applicationName: 'API-REST-STACK-NODE',
          supportEmail: null,
          supportUrl: 'http://localhost:3000'
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
          disabledModuleKeys: []
        },
        featureFlags: {
          disabledFeatureFlagKeys: []
        }
      }),
      updateSettings: vi.fn()
    };
    const app = createPlatformSettingsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: platformScopeGrants.resolveScopesForEmail('admin@example.com')
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .get('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(service.getSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          actor: expect.objectContaining({
            userId: userId.toString(),
            scope: platformScopeGrants.resolveScopesForEmail('admin@example.com')
          })
        })
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        settings: {
          singletonKey: 'platform_settings'
        }
      }
    });
  });

  it('updates the singleton through PATCH with platform permission guard', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        singletonKey: 'platform_settings',
        branding: {
          applicationName: 'API-REST-STACK-NODE',
          supportEmail: 'support@example.com',
          supportUrl: 'http://localhost:3000'
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
          maintenanceMode: true
        },
        modules: {
          disabledModuleKeys: ['inventory']
        },
        featureFlags: {
          disabledFeatureFlagKeys: []
        }
      })
    };
    const app = createPlatformSettingsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: platformScopeGrants.resolveScopesForEmail('admin@example.com')
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branding: {
          supportEmail: 'support@example.com'
        },
        operations: {
          maintenanceMode: true
        },
        modules: {
          disabledModuleKeys: ['inventory']
        }
      });

    expect(response.status).toBe(200);
    expect(service.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          branding: {
            supportEmail: 'support@example.com'
          },
          operations: {
            maintenanceMode: true
          },
          modules: {
            disabledModuleKeys: ['inventory']
          }
        }
      })
    );
    expect(response.body.data.settings.operations.maintenanceMode).toBe(true);
  });

  it('denies platform settings access when the authenticated scope lacks the required permission', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn()
    };
    const app = createPlatformSettingsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: [AUTH_SCOPES.PLATFORM_SELF]
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .get('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.getSettings).not.toHaveBeenCalled();
  });

  it('rejects unknown module keys through the public platform settings contract', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn().mockRejectedValue(
        new AppError({
          code: 'GEN_VALIDATION_ERROR',
          message: 'Unknown module keys: unknown-module',
          statusCode: 400
        })
      )
    };
    const app = createPlatformSettingsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: platformScopeGrants.resolveScopesForEmail('admin@example.com')
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        modules: {
          disabledModuleKeys: ['unknown-module']
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
  });
});
