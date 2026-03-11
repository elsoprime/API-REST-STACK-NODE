describe('auth delivery registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses transactional email for verify-email and webhook delivery for 2FA in production', async () => {
    const sendTemplate = vi.fn().mockResolvedValue({
      provider: 'resend',
      messageId: 'email-1',
      acceptedRecipients: ['user@example.com']
    });
    const postDeliveryWebhook = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        APP_NAME: 'SaaS Core Engine',
        EMAIL_FROM: 'no-reply@example.com',
        AUTH_VERIFY_EMAIL_URL: 'https://app.example.com/auth/verify-email',
        AUTH_RESET_PASSWORD_URL: 'https://app.example.com/auth/reset-password',
        AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: 'https://delivery.example.com/2fa',
        DELIVERY_WEBHOOK_AUTH_TOKEN: 'token-1',
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3000
      }
    }));
    vi.doMock('@/core/communications/email/services/transactional-email.service', () => ({
      transactionalEmailService: {
        sendTemplate
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
      firstName: 'Ada',
      token: 'token',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });
    await registry.passwordResetDeliveryPort.deliver({
      userId: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      token: 'reset-token',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });
    await registry.twoFactorProvisioningPort.deliver({
      userId: 'user-1',
      email: 'user@example.com',
      secret: 'secret',
      otpauthUrl: 'otpauth://totp/Example:user@example.com?secret=secret&issuer=Example'
    });

    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'verify-email',
        semantic: 'auth.email_verification',
        to: 'user@example.com'
      })
    );
    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'reset-password',
        semantic: 'auth.password_reset',
        to: 'user@example.com'
      })
    );
    expect(postDeliveryWebhook).toHaveBeenCalledWith(
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

  it('fails 2FA delivery in production when the webhook URL is missing', async () => {
    const sendTemplate = vi.fn().mockResolvedValue({
      provider: 'resend',
      messageId: 'email-2',
      acceptedRecipients: ['user2@example.com']
    });

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        APP_NAME: 'SaaS Core Engine',
        EMAIL_FROM: 'no-reply@example.com',
        AUTH_VERIFY_EMAIL_URL: 'https://app.example.com/auth/verify-email',
        AUTH_RESET_PASSWORD_URL: 'https://app.example.com/auth/reset-password',
        AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: undefined,
        DELIVERY_WEBHOOK_AUTH_TOKEN: undefined,
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3000
      }
    }));
    vi.doMock('@/core/communications/email/services/transactional-email.service', () => ({
      transactionalEmailService: {
        sendTemplate
      }
    }));
    vi.doMock('@/infrastructure/security/webhook-delivery', () => ({
      postDeliveryWebhook: vi.fn()
    }));

    const { createAuthDeliveryRegistry } = await import('@/infrastructure/security/auth-delivery.registry');
    const registry = createAuthDeliveryRegistry();

    await registry.emailVerificationDeliveryPort.deliver({
      userId: 'user-2',
      email: 'user2@example.com',
      token: 'token',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });
    await registry.passwordResetDeliveryPort.deliver({
      userId: 'user-2',
      email: 'user2@example.com',
      token: 'reset-token',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });

    await expect(
      registry.twoFactorProvisioningPort.deliver({
        userId: 'user-2',
        email: 'user2@example.com',
        secret: 'secret',
        otpauthUrl: 'otpauth://totp/Example:user2@example.com?secret=secret&issuer=Example'
      })
    ).rejects.toThrow('Two-factor provisioning adapter is not configured for production');

    expect(sendTemplate).toHaveBeenCalledTimes(2);
  });
});
