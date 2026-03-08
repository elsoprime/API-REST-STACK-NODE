import { Types } from 'mongoose';

import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import { TenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';

describe('TenantSettingsService runtime resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates effective runtime resolution to the RBAC service and passes platform-disabled keys', async () => {
    const tenantId = new Types.ObjectId();
    const resolveTenantRuntime = vi.fn().mockResolvedValue({
      plan: {
        key: 'plan:growth',
        name: 'Growth',
        description: 'Growth plan',
        rank: 200,
        allowedModuleKeys: ['inventory', 'crm'],
        featureFlagKeys: ['inventory:base'],
        memberLimit: 25
      },
      activeModuleKeys: ['inventory', 'crm'],
      enabledModuleKeys: ['inventory'],
      featureFlagKeys: ['inventory:base']
    });
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
        resolveTenantRuntime
      } as never,
      {
        record: vi.fn()
      } as never
    );

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
          taxId: '76.123.456-7'
        }
      })
    } as never);

    const result = await service.getEffectiveSettings({
      tenantId: tenantId.toString()
    });

    expect(resolveTenantRuntime).toHaveBeenCalledWith({
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm'],
      disabledModuleKeys: ['crm'],
      disabledFeatureFlagKeys: ['inventory:analytics']
    });
    expect(result.runtime).toEqual({
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm'],
      enabledModuleKeys: ['inventory'],
      featureFlagKeys: ['inventory:base']
    });
  });
});
