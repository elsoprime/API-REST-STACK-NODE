import mongoose, { Types } from 'mongoose';

import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import { TenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';

describe('TenantSettingsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bootstraps the tenant settings singleton on first read and records a tenant-scoped audit event', async () => {
    const tenantId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-tenant-settings-bootstrap'
      })
    };
    const service = new TenantSettingsService(undefined, undefined, audit as never);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: tenantId,
        name: 'Acme',
        planId: 'plan:starter',
        activeModuleKeys: ['inventory']
      })
    } as never);
    vi.spyOn(TenantSettingsModel, 'findOne').mockResolvedValueOnce(null as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantSettingsModel, 'create').mockResolvedValue([
      {
        _id: settingsId,
        toObject: () => ({
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
          }
        })
      }
    ] as never);

    const result = await service.getSettings({
      tenantId: tenantId.toString(),
      context: {
        traceId: 'trace-tenant-settings-bootstrap',
        actor: {
          kind: 'user',
          userId: new Types.ObjectId().toString(),
          sessionId: new Types.ObjectId().toString(),
          scope: ['platform:self']
        },
        tenant: {
          tenantId: tenantId.toString(),
          membershipId: new Types.ObjectId().toString(),
          roleKey: 'tenant:owner',
          isOwner: true,
          effectiveRoleKeys: ['tenant:owner']
        }
      }
    });

    expect(result.singletonKey).toBe('tenant_settings');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tenant',
        action: 'tenant.settings.bootstrap',
        traceId: 'trace-tenant-settings-bootstrap',
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

  it('updates the tenant settings singleton with a partial patch and records before/after audit data', async () => {
    const tenantId = new Types.ObjectId();
    const settingsId = new Types.ObjectId();
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: 'audit-tenant-settings-update'
      })
    };
    const service = new TenantSettingsService(undefined, undefined, audit as never);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
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

    vi.spyOn(TenantModel, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: tenantId,
        name: 'Acme',
        planId: 'plan:starter',
        activeModuleKeys: ['inventory']
      })
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantSettingsModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue(settingsDocument)
    } as never);

    const result = await service.updateSettings({
      tenantId: tenantId.toString(),
      patch: {
        branding: {
          displayName: 'Acme South'
        },
        billing: {
          billingEmail: 'billing@acme.test'
        }
      },
      context: {
        traceId: 'trace-tenant-settings-update',
        actor: {
          kind: 'user',
          userId: new Types.ObjectId().toString(),
          sessionId: new Types.ObjectId().toString(),
          scope: ['platform:self']
        },
        tenant: {
          tenantId: tenantId.toString(),
          membershipId: new Types.ObjectId().toString(),
          roleKey: 'tenant:owner',
          isOwner: true,
          effectiveRoleKeys: ['tenant:owner']
        }
      }
    });

    expect(settingsDocument.save).toHaveBeenCalled();
    expect(result.branding.displayName).toBe('Acme South');
    expect(result.billing.billingEmail).toBe('billing@acme.test');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tenant',
        action: 'tenant.settings.update',
        changes: expect.objectContaining({
          before: expect.any(Object),
          after: expect.any(Object),
          fields: ['branding', 'billing']
        })
      }),
      {
        session: sessionMock
      }
    );
  });

  it('resolves effective tenant settings from tenant overrides, platform defaults and runtime state', async () => {
    const tenantId = new Types.ObjectId();
    const tenantQuery = {
      lean: vi.fn().mockResolvedValue({
        _id: tenantId,
        name: 'Acme HQ',
        planId: 'plan:growth',
        activeModuleKeys: ['inventory', 'crm']
      })
    };
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

    vi.spyOn(TenantModel, 'findById').mockReturnValue(tenantQuery as never);
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
          phone: '+56 9 1111 1111',
          websiteUrl: 'https://acme.test'
        },
        billing: {
          billingEmail: 'billing@acme.test',
          legalName: 'Acme SpA',
          taxId: '76.123.456-7'
        }
      })
    } as never);

    const result = await service.getEffectiveSettings({
      tenantId: tenantId.toString()
    });

    expect(result.branding.displayName).toBe('Acme Regional');
    expect(result.branding.supportEmail).toBe('support@platform.test');
    expect(result.localization.defaultTimezone).toBe('America/Santiago');
    expect(result.localization.defaultCurrency).toBe('USD');
    expect(result.runtime.enabledModuleKeys).toEqual(['inventory']);
    expect(result.runtime.featureFlagKeys).toEqual(['inventory:base']);
    expect(result.runtime.planId).toBe('plan:growth');
  });
});
