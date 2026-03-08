import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AUTH_SCOPES } from '@/constants/security';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { createPlatformSettingsRouter } from '@/core/platform/settings/routes/platform-settings.routes';
import { PlatformSettingsService } from '@/core/platform/settings/services/platform-settings.service';

function createPlatformSettingsAuditApp(service: PlatformSettingsService) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.PLATFORM_BASE_PATH, createPlatformSettingsRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('platform settings audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a platform-scoped audit event when the singleton is updated through HTTP', async () => {
    const userId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-platform-settings'
      })
    };
    const service = new PlatformSettingsService(audit as never);
    const app = createPlatformSettingsAuditApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: [AUTH_SCOPES.PLATFORM_SELF, AUTH_SCOPES.PLATFORM_SETTINGS_UPDATE]
    });
    const settingsDocument = {
      _id: settingsId,
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
      },
      toObject() {
        return {
          _id: this._id,
          singletonKey: this.singletonKey,
          branding: { ...this.branding },
          localization: { ...this.localization },
          security: { ...this.security },
          operations: { ...this.operations },
          modules: {
            disabledModuleKeys: [...this.modules.disabledModuleKeys]
          },
          featureFlags: {
            disabledFeatureFlagKeys: [...this.featureFlags.disabledFeatureFlagKeys]
          }
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
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(PlatformSettingsModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(settingsDocument)
    } as never);

    const response = await request(app)
      .patch('/api/v1/platform/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        operations: {
          maintenanceMode: true
        }
      });

    expect(response.status).toBe(200);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'platform',
        action: 'platform.settings.update',
        resource: {
          type: 'platform_settings',
          id: settingsId.toString()
        }
      }),
      {
        session: sessionMock
      }
    );
  });
});
