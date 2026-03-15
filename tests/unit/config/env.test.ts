describe('env configuration validation', () => {
  const envModulePath = '@/config/env';
  const requiredEnvironmentKeys = [
    'NODE_ENV',
    'APP_NAME',
    'APP_VERSION',
    'APP_URL',
    'FRONTEND_URL',
    'MONGODB_URI',
    'MONGODB_URI_TEST',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'REFRESH_TOKEN_EXPIRES_IN',
    'AUTH_ACCESS_COOKIE_NAME',
    'REFRESH_TOKEN_COOKIE_NAME',
    'COOKIE_SECRET',
    'COOKIE_DOMAIN',
    'COOKIE_SECURE',
    'COOKIE_SAME_SITE',
    'CSRF_SECRET',
    'CSRF_COOKIE_NAME',
    'CORS_ORIGINS',
    'GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS',
    'EMAIL_PROVIDER',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'AUTH_VERIFY_EMAIL_URL',
    'AUTH_RESET_PASSWORD_URL',
    'TENANT_INVITATION_ACCEPT_URL',
    'EMAIL_MAILPIT_SMTP_HOST',
    'EMAIL_MAILPIT_SMTP_PORT',
    'EMAIL_RESEND_API_KEY',
    'EMAIL_RESEND_API_BASE_URL',
    'EMAIL_DELIVERY_TIMEOUT_MS',
    'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
    'DELIVERY_WEBHOOK_AUTH_TOKEN',
    'DELIVERY_WEBHOOK_TIMEOUT_MS',
    'BILLING_PROVIDER',
    'BILLING_WEBHOOK_SECRET',
    'BILLING_WEBHOOK_TOLERANCE_SECONDS'
  ] as const;

  const snapshotEnvironment = (): Record<string, string | undefined> =>
    Object.fromEntries(requiredEnvironmentKeys.map((key) => [key, process.env[key]]));

  const restoreEnvironment = (snapshot: Record<string, string | undefined>) => {
    for (const key of requiredEnvironmentKeys) {
      const originalValue = snapshot[key];

      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it('throws when a required environment variable is missing', async () => {
    const originalEnvironment = snapshotEnvironment();

    delete process.env.APP_NAME;

    try {
      await expect(import(envModulePath)).rejects.toThrow('Invalid environment variables');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });

  it('rejects 2FA delivery webhook URLs that are not http or https', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL = 'ftp://delivery.example.com/2fa';

    try {
      await expect(import(envModulePath)).rejects.toThrow('Invalid environment variables');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });

  it('requires https delivery URLs in production', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.BILLING_PROVIDER = 'stripe';
    process.env.BILLING_WEBHOOK_SECRET = 'change_this_prod_webhook_secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_VERIFY_EMAIL_URL = 'http://app.example.com/auth/verify-email';
    process.env.AUTH_RESET_PASSWORD_URL = 'https://app.example.com/auth/reset-password';
    process.env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL = 'https://delivery.example.com/2fa';
    process.env.TENANT_INVITATION_ACCEPT_URL = 'https://app.example.com/tenant/invitations/accept';
    process.env.EMAIL_RESEND_API_BASE_URL = 'https://api.resend.com';

    try {
      await expect(import(envModulePath)).rejects.toThrow('must use https:// in production');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });

  it('rejects Mailpit as the production email provider', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'mailpit';
    process.env.BILLING_PROVIDER = 'stripe';
    process.env.BILLING_WEBHOOK_SECRET = 'change_this_prod_webhook_secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_VERIFY_EMAIL_URL = 'https://app.example.com/auth/verify-email';
    process.env.AUTH_RESET_PASSWORD_URL = 'https://app.example.com/auth/reset-password';
    process.env.TENANT_INVITATION_ACCEPT_URL = 'https://app.example.com/tenant/invitations/accept';
    process.env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL = 'https://delivery.example.com/2fa';

    try {
      await expect(import(envModulePath)).rejects.toThrow('EMAIL_PROVIDER must be resend in production');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });

  it('rejects non-stripe billing provider in production', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.BILLING_PROVIDER = 'simulated';
    process.env.BILLING_WEBHOOK_SECRET = 'change_this_prod_webhook_secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.AUTH_VERIFY_EMAIL_URL = 'https://app.example.com/auth/verify-email';
    process.env.AUTH_RESET_PASSWORD_URL = 'https://app.example.com/auth/reset-password';
    process.env.TENANT_INVITATION_ACCEPT_URL = 'https://app.example.com/tenant/invitations/accept';

    try {
      await expect(import(envModulePath)).rejects.toThrow('BILLING_PROVIDER must be stripe in production');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });
});

