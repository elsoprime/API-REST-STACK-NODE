import {
  buildGoLiveConfigurationReadiness,
  buildGoLiveReadinessSnapshot,
  hasProductionDeliveryAdaptersConfigured
} from '@/infrastructure/operations/go-live-readiness';

describe('go-live readiness', () => {
  it('requires production delivery adapters when enforcement is enabled', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: true,
      AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
      TENANT_INVITATION_DELIVERY_WEBHOOK_URL: undefined
    };

    expect(hasProductionDeliveryAdaptersConfigured(productionEnv as never)).toBe(false);
    expect(buildGoLiveConfigurationReadiness(productionEnv as never)).toEqual({
      ready: false,
      checks: {
        productionDeliveryAdapters: false
      },
      missingProductionDeliveryConfigKeys: [
        'AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL',
        'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
        'TENANT_INVITATION_DELIVERY_WEBHOOK_URL'
      ]
    });
  });

  it('considers non-production environments ready for delivery adapters by default', () => {
    const testEnv = {
      NODE_ENV: 'test',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
      AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
      TENANT_INVITATION_DELIVERY_WEBHOOK_URL: undefined
    };

    expect(buildGoLiveConfigurationReadiness(testEnv as never)).toEqual({
      ready: true,
      checks: {
        productionDeliveryAdapters: true
      },
      missingProductionDeliveryConfigKeys: []
    });
  });

  it('requires production delivery adapters regardless of legacy enforcement flag', () => {
    const productionEnvWithLegacyFlagOff = {
      NODE_ENV: 'production',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
      AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
      TENANT_INVITATION_DELIVERY_WEBHOOK_URL: undefined
    };

    expect(buildGoLiveConfigurationReadiness(productionEnvWithLegacyFlagOff as never)).toEqual({
      ready: false,
      checks: {
        productionDeliveryAdapters: false
      },
      missingProductionDeliveryConfigKeys: [
        'AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL',
        'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
        'TENANT_INVITATION_DELIVERY_WEBHOOK_URL'
      ]
    });
  });

  it('requires both DB and config readiness for /health ready=true', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: true,
      AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: 'https://delivery.local/email',
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: 'https://delivery.local/2fa',
      TENANT_INVITATION_DELIVERY_WEBHOOK_URL: 'https://delivery.local/invitations'
    };

    expect(buildGoLiveReadinessSnapshot(true, productionEnv as never)).toEqual({
      ready: true,
      checks: {
        database: true,
        productionDeliveryAdapters: true
      }
    });

    expect(buildGoLiveReadinessSnapshot(false, productionEnv as never)).toEqual({
      ready: false,
      checks: {
        database: false,
        productionDeliveryAdapters: true
      }
    });
  });
});
