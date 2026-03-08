import mongoose, { Types } from 'mongoose';

import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { PlatformSettingsService } from '@/core/platform/settings/services/platform-settings.service';

describe('PlatformSettingsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bootstraps the singleton on first read and records a platform-scoped audit event', async () => {
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-1'
      })
    };
    const service = new PlatformSettingsService(audit as never);
    const userId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(PlatformSettingsModel, 'findOne').mockResolvedValueOnce(null as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(PlatformSettingsModel, 'create').mockResolvedValue([
      {
        _id: settingsId,
        toObject: () => ({
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
          }
        })
      }
    ] as never);

    const result = await service.getSettings({
      context: {
        traceId: 'trace-platform-bootstrap',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: userId.toString(),
          scope: ['platform:settings:read']
        }
      }
    });

    expect(result.singletonKey).toBe('platform_settings');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'platform',
        action: 'platform.settings.bootstrap',
        traceId: 'trace-platform-bootstrap',
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

  it('updates the singleton with a partial patch and records before/after audit data', async () => {
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-2'
      })
    };
    const service = new PlatformSettingsService(audit as never);
    const userId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
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

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(PlatformSettingsModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(settingsDocument)
    } as never);

    const result = await service.updateSettings({
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
      },
      context: {
        traceId: 'trace-platform-update',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: userId.toString(),
          scope: ['platform:settings:update']
        }
      }
    });

    expect(settingsDocument.save).toHaveBeenCalled();
    expect(result.branding.supportEmail).toBe('support@example.com');
    expect(result.operations.maintenanceMode).toBe(true);
    expect(result.modules.disabledModuleKeys).toEqual(['inventory']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'platform',
        action: 'platform.settings.update',
        traceId: 'trace-platform-update',
        changes: expect.objectContaining({
          before: expect.any(Object),
          after: expect.any(Object),
          fields: ['branding', 'operations', 'modules']
        })
      }),
      {
        session: sessionMock
      }
    );
  });

  it('rejects unknown module keys before persisting the singleton update', async () => {
    const service = new PlatformSettingsService({
      record: vi.fn()
    } as never);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const settingsId = new Types.ObjectId();
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

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(PlatformSettingsModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(settingsDocument)
    } as never);

    await expect(
      service.updateSettings({
        patch: {
          modules: {
            disabledModuleKeys: ['unknown-module']
          }
        }
      })
    ).rejects.toMatchObject({
      code: 'GEN_VALIDATION_ERROR',
      statusCode: 400
    });

    expect(settingsDocument.save).not.toHaveBeenCalled();
  });
});
