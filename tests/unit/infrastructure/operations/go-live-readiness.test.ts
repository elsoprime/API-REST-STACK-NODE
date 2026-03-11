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
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: undefined,
      AUTH_VERIFY_EMAIL_URL: undefined,
      AUTH_RESET_PASSWORD_URL: undefined,
      TENANT_INVITATION_ACCEPT_URL: undefined,
      EMAIL_RESEND_API_KEY: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
    };

    expect(hasProductionDeliveryAdaptersConfigured(productionEnv as never)).toBe(false);
    expect(buildGoLiveConfigurationReadiness(productionEnv as never)).toEqual({
      ready: false,
      checks: {
        productionDeliveryAdapters: false
      },
      missingProductionDeliveryConfigKeys: [
        'EMAIL_FROM',
        'AUTH_VERIFY_EMAIL_URL',
        'AUTH_RESET_PASSWORD_URL',
        'TENANT_INVITATION_ACCEPT_URL',
        'EMAIL_RESEND_API_KEY',
        'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
      ]
    });
  });

  it('considers non-production environments ready for delivery adapters by default', () => {
    const testEnv = {
      NODE_ENV: 'test',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
      EMAIL_PROVIDER: 'mailpit',
      EMAIL_FROM: undefined,
      AUTH_VERIFY_EMAIL_URL: undefined,
      AUTH_RESET_PASSWORD_URL: undefined,
      TENANT_INVITATION_ACCEPT_URL: undefined,
      EMAIL_RESEND_API_KEY: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
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
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: undefined,
      AUTH_VERIFY_EMAIL_URL: undefined,
      AUTH_RESET_PASSWORD_URL: undefined,
      TENANT_INVITATION_ACCEPT_URL: undefined,
      EMAIL_RESEND_API_KEY: undefined,
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
    };

    expect(buildGoLiveConfigurationReadiness(productionEnvWithLegacyFlagOff as never)).toEqual({
      ready: false,
      checks: {
        productionDeliveryAdapters: false
      },
      missingProductionDeliveryConfigKeys: [
        'EMAIL_FROM',
        'AUTH_VERIFY_EMAIL_URL',
        'AUTH_RESET_PASSWORD_URL',
        'TENANT_INVITATION_ACCEPT_URL',
        'EMAIL_RESEND_API_KEY',
        'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
      ]
    });
  });

  it('requires both DB and config readiness for /health ready=true', () => {
    const productionEnv = {
      NODE_ENV: 'production',
      GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: true,
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'no-reply@example.com',
      AUTH_VERIFY_EMAIL_URL: 'https://app.example.com/auth/verify-email',
      AUTH_RESET_PASSWORD_URL: 'https://app.example.com/auth/reset-password',
      TENANT_INVITATION_ACCEPT_URL: 'https://app.example.com/tenant/invitations/accept',
      EMAIL_RESEND_API_KEY: 're_test_123',
      AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: 'https://delivery.local/2fa',
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
