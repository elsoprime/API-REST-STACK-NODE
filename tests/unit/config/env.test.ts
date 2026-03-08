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
    'AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL',
    'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
    'TENANT_INVITATION_DELIVERY_WEBHOOK_URL',
    'DELIVERY_WEBHOOK_AUTH_TOKEN',
    'DELIVERY_WEBHOOK_TIMEOUT_MS'
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

  it('rejects delivery webhook URLs that are not http or https', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL = 'ftp://delivery.example.com/email';

    try {
      await expect(import(envModulePath)).rejects.toThrow('Invalid environment variables');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });

  it('requires https delivery webhook URLs in production', async () => {
    const originalEnvironment = snapshotEnvironment();

    process.env.NODE_ENV = 'production';
    process.env.AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL = 'http://delivery.example.com/email';
    process.env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL = 'https://delivery.example.com/2fa';
    process.env.TENANT_INVITATION_DELIVERY_WEBHOOK_URL = 'https://delivery.example.com/invitations';

    try {
      await expect(import(envModulePath)).rejects.toThrow('must use https:// in production');
    } finally {
      restoreEnvironment(originalEnvironment);
    }
  });
});
