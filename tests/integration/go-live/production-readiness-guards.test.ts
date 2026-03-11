import express from 'express';

describe('production go-live readiness guards', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fails startup in production when delivery adapter configuration is missing regardless of legacy flag', async () => {
    const connectToDatabase = vi.fn();

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        APP_NAME: 'SaaS Core Engine',
        APP_VERSION: '3.0.0',
        APP_URL: 'https://api.example.com',
        FRONTEND_URL: 'https://app.example.com',
        MONGODB_URI: 'mongodb://mongodb-primary:27017/saas_prod?replicaSet=rs0',
        MONGODB_URI_TEST: 'mongodb://mongodb-primary:27017/saas_test?replicaSet=rs0',
        MONGODB_MAX_POOL_SIZE: 20,
        MONGODB_CONNECT_TIMEOUT_MS: 10000,
        JWT_SECRET: 'change_this_jwt_secret_to_a_real_value_with_32_chars_min',
        JWT_EXPIRES_IN: '15m',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
        AUTH_ACCESS_COOKIE_NAME: '__at',
        REFRESH_TOKEN_COOKIE_NAME: '__rf',
        COOKIE_SECRET: 'change_this_cookie_secret_to_a_real_value_with_32_chars_min',
        COOKIE_DOMAIN: '.example.com',
        COOKIE_SECURE: true,
        COOKIE_SAME_SITE: 'none',
        CSRF_SECRET: 'change_this_csrf_secret_now',
        CSRF_COOKIE_NAME: '__csrf',
        BCRYPT_SALT_ROUNDS: 12,
        RATE_LIMIT_WINDOW_MS: 900000,
        RATE_LIMIT_MAX_GLOBAL: 100,
        RATE_LIMIT_MAX_AUTH: 10,
        RATE_LIMIT_MAX_SENSITIVE: 5,
        CORS_ORIGINS: 'https://app.example.com',
        LOG_LEVEL: 'info',
        LOG_PRETTY: false,
        GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM: 'no-reply@example.com',
        EMAIL_FROM_NAME: 'SaaS Core Engine',
        AUTH_VERIFY_EMAIL_URL: 'https://app.example.com/auth/verify-email',
        AUTH_RESET_PASSWORD_URL: 'https://app.example.com/auth/reset-password',
        TENANT_INVITATION_ACCEPT_URL: 'https://app.example.com/tenant/invitations/accept',
        EMAIL_MAILPIT_SMTP_HOST: '127.0.0.1',
        EMAIL_MAILPIT_SMTP_PORT: 1025,
        EMAIL_RESEND_API_KEY: undefined,
        EMAIL_RESEND_API_BASE_URL: 'https://api.resend.com',
        EMAIL_DELIVERY_TIMEOUT_MS: 5000,
        AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
        DELIVERY_WEBHOOK_AUTH_TOKEN: undefined,
        DELIVERY_WEBHOOK_TIMEOUT_MS: 5000,
        DB_CONNECT_MAX_RETRIES: 0,
        DB_CONNECT_RETRY_DELAY_MS: 250
      }
    }));

    vi.doMock('@/infrastructure/database/connection', () => ({
      connectToDatabase,
      disconnectFromDatabase: vi.fn().mockResolvedValue(undefined),
      getDatabaseConnectionState: vi.fn().mockReturnValue({
        status: 'disconnected',
        healthStatus: 'down'
      })
    }));

    vi.doMock('@/app/server', () => ({
      createServer: vi.fn(() => express())
    }));

    const { startApplication } = await import('@/app/runtime');

    await expect(
      startApplication({
        logger: {
          info: () => undefined,
          error: () => undefined
        }
      })
    ).rejects.toThrow(
      'Go-live readiness preflight failed: missing production delivery configuration keys'
    );

    expect(connectToDatabase).not.toHaveBeenCalled();
  });
});
