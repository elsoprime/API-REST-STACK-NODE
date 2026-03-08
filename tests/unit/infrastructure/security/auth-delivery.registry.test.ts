describe('auth delivery registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses webhook adapters in production when URLs are configured', async () => {
    const postDeliveryWebhook = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: true,
        AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: 'https://delivery.example.com/email',
        AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: 'https://delivery.example.com/2fa',
        DELIVERY_WEBHOOK_AUTH_TOKEN: 'token-1',
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3000
      }
    }));

    vi.doMock('@/infrastructure/security/webhook-delivery', () => ({
      postDeliveryWebhook
    }));

    const { createAuthDeliveryRegistry } = await import('@/infrastructure/security/auth-delivery.registry');
    const registry = createAuthDeliveryRegistry();

    await registry.emailVerificationDeliveryPort.deliver({
      userId: 'user-1',
      email: 'user@example.com',
      token: 'token',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });
    await registry.twoFactorProvisioningPort.deliver({
      userId: 'user-1',
      email: 'user@example.com',
      secret: 'secret',
      otpauthUrl: 'otpauth://totp/Example:user@example.com?secret=secret&issuer=Example'
    });

    expect(postDeliveryWebhook).toHaveBeenCalledTimes(2);
    expect(postDeliveryWebhook).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        webhookUrl: 'https://delivery.example.com/email',
        timeoutMs: 3000,
        bearerToken: 'token-1',
        payload: expect.objectContaining({
          event: 'auth.email_verification'
        })
      })
    );
    expect(postDeliveryWebhook).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        webhookUrl: 'https://delivery.example.com/2fa',
        timeoutMs: 3000,
        bearerToken: 'token-1',
        payload: expect.objectContaining({
          event: 'auth.two_factor_provisioning'
        })
      })
    );
  });

  it('fails delivery in production when webhook URLs are missing', async () => {
    const postDeliveryWebhook = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
        AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: undefined,
        AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
        DELIVERY_WEBHOOK_AUTH_TOKEN: undefined,
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3000
      }
    }));

    vi.doMock('@/infrastructure/security/webhook-delivery', () => ({
      postDeliveryWebhook
    }));

    const { createAuthDeliveryRegistry } = await import('@/infrastructure/security/auth-delivery.registry');
    const registry = createAuthDeliveryRegistry();

    await expect(
      registry.emailVerificationDeliveryPort.deliver({
        userId: 'user-2',
        email: 'user2@example.com',
        token: 'token',
        expiresAt: '2026-03-08T00:00:00.000Z'
      })
    ).rejects.toThrow('Email verification delivery adapter is not configured for production');

    await expect(
      registry.twoFactorProvisioningPort.deliver({
        userId: 'user-2',
        email: 'user2@example.com',
        secret: 'secret',
        otpauthUrl: 'otpauth://totp/Example:user2@example.com?secret=secret&issuer=Example'
      })
    ).rejects.toThrow('Two-factor provisioning adapter is not configured for production');

    expect(postDeliveryWebhook).not.toHaveBeenCalled();
  });
});
