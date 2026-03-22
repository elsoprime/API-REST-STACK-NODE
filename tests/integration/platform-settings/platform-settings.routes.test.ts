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

function buildSecurityView() {
  return {
    allowUserRegistration: true,
    requireEmailVerification: true,
    requireTwoFactorForPrivilegedUsers: false,
    passwordPolicy: {
      minLength: 12,
      preventReuseCount: 5,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: false
    },
    sessionPolicy: {
      browserSessionTtlMinutes: 1440,
      idleTimeoutMinutes: null
    },
    riskControls: {
      allowRecoveryCodes: true,
      enforceVerifiedEmailForPrivilegedAccess: true
    }
  };
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
        security: buildSecurityView(),
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
    expect(response.body.data.settings.security.passwordPolicy.minLength).toBe(12);
  });

  it('updates the singleton through PATCH with expanded security fields', async () => {
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
          ...buildSecurityView(),
          requireTwoFactorForPrivilegedUsers: true,
          passwordPolicy: {
            ...buildSecurityView().passwordPolicy,
            minLength: 16
          }
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
        security: {
          requireTwoFactorForPrivilegedUsers: true,
          passwordPolicy: {
            minLength: 16
          }
        },
        operations: {
          maintenanceMode: true
        }
      });

    expect(response.status).toBe(200);
    expect(service.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          security: {
            requireTwoFactorForPrivilegedUsers: true,
            passwordPolicy: {
              minLength: 16
            }
          },
          operations: {
            maintenanceMode: true
          }
        }
      })
    );
    expect(response.body.data.settings.security.requireTwoFactorForPrivilegedUsers).toBe(true);
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

  it('requires CSRF for cookie-authenticated PATCH requests', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
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
      .patch('/api/v1/platform/settings')
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .send({
        operations: {
          maintenanceMode: true
        }
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('accepts cookie-authenticated PATCH requests when CSRF token matches cookie', async () => {
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
        security: buildSecurityView(),
        operations: {
          maintenanceMode: true
        },
        modules: {
          disabledModuleKeys: []
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
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .set(APP_CONFIG.CSRF_HEADER, 'csrf-token')
      .send({
        operations: {
          maintenanceMode: true
        }
      });

    expect(response.status).toBe(200);
    expect(service.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {
          operations: {
            maintenanceMode: true
          }
        }
      })
    );
  });

  it('rejects invalid expanded security ranges through the public contract', async () => {
    const userId = new Types.ObjectId();
    const service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn().mockRejectedValue(
        new AppError({
          code: 'GEN_VALIDATION_ERROR',
          message: 'security.passwordPolicy.minLength must be between 8 and 128',
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
        security: {
          passwordPolicy: {
            minLength: 4
          }
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
  });
});
