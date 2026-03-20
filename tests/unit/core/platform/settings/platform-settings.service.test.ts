import mongoose, { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import { PlatformSettingsService } from '@/core/platform/settings/services/platform-settings.service';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function buildSecurityDocument() {
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
          security: buildSecurityDocument(),
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

    expect(result.security.passwordPolicy.minLength).toBe(12);
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

  it('updates the singleton with a nested security patch and records before/after audit data', async () => {
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
      security: buildSecurityDocument(),
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
          security: {
            ...this.security,
            passwordPolicy: { ...this.security.passwordPolicy },
            sessionPolicy: { ...this.security.sessionPolicy },
            riskControls: { ...this.security.riskControls }
          },
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
        security: {
          requireTwoFactorForPrivilegedUsers: true,
          passwordPolicy: {
            minLength: 16
          },
          sessionPolicy: {
            idleTimeoutMinutes: 30
          }
        },
        operations: {
          maintenanceMode: true
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
    expect(result.security.requireTwoFactorForPrivilegedUsers).toBe(true);
    expect(result.security.passwordPolicy.minLength).toBe(16);
    expect(result.security.sessionPolicy.idleTimeoutMinutes).toBe(30);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'platform',
        action: 'platform.settings.update',
        traceId: 'trace-platform-update',
        changes: expect.objectContaining({
          before: expect.any(Object),
          after: expect.any(Object),
          fields: ['security', 'operations']
        })
      }),
      {
        session: sessionMock
      }
    );
  });

  it('rejects invalid expanded security ranges before persisting the singleton update', async () => {
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
      security: buildSecurityDocument(),
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
          security: {
            ...this.security,
            passwordPolicy: { ...this.security.passwordPolicy },
            sessionPolicy: { ...this.security.sessionPolicy },
            riskControls: { ...this.security.riskControls }
          },
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
          security: {
            passwordPolicy: {
              minLength: 4
            }
          }
        }
      })
    ).rejects.toMatchObject({
      code: 'GEN_VALIDATION_ERROR',
      statusCode: 400
    });

    expect(settingsDocument.save).not.toHaveBeenCalled();
  });

  it('fails closed when a tenant-scoped execution context reaches platform settings', async () => {
    const service = new PlatformSettingsService({
      record: vi.fn()
    } as never);
    const findOneSpy = vi.spyOn(PlatformSettingsModel, 'findOne');
    const startSessionSpy = vi.spyOn(mongoose, 'startSession');

    const tenantContext = {
      traceId: 'trace-tenant-context',
      actor: {
        kind: 'user' as const,
        userId: new Types.ObjectId().toString(),
        sessionId: new Types.ObjectId().toString(),
        scope: ['platform:settings:update']
      },
      tenant: {
        tenantId: new Types.ObjectId().toString()
      }
    };

    await expect(
      service.getSettings({
        context: tenantContext
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.getSettingsSnapshot({
        context: tenantContext
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.updateSettings({
        patch: {
          operations: {
            maintenanceMode: true
          }
        },
        context: tenantContext
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    expect(findOneSpy).not.toHaveBeenCalled();
    expect(startSessionSpy).not.toHaveBeenCalled();
  });
});
