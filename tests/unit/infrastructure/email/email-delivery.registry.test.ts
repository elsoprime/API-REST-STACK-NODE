describe('email delivery registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('selects Mailpit outside production by default', async () => {
    vi.doMock('@/config/env', () => ({
      env: {
        EMAIL_PROVIDER: 'mailpit',
        EMAIL_MAILPIT_SMTP_HOST: '127.0.0.1',
        EMAIL_MAILPIT_SMTP_PORT: 1025,
        EMAIL_DELIVERY_TIMEOUT_MS: 5000
      }
    }));

    const { createEmailDeliveryRegistry } = await import('@/infrastructure/email/email-delivery.registry');
    const registry = createEmailDeliveryRegistry();

    expect(registry.transactionalEmailPort.constructor.name).toBe('MailpitEmailTransport');
  });

  it('selects Resend in production when the API key is configured', async () => {
    vi.doMock('@/config/env', () => ({
      env: {
        EMAIL_PROVIDER: 'resend',
        EMAIL_RESEND_API_KEY: 're_test_123',
        EMAIL_RESEND_API_BASE_URL: 'https://api.resend.com',
        EMAIL_DELIVERY_TIMEOUT_MS: 5000
      }
    }));

    const { createEmailDeliveryRegistry } = await import('@/infrastructure/email/email-delivery.registry');
    const registry = createEmailDeliveryRegistry();

    expect(registry.transactionalEmailPort.constructor.name).toBe('ResendEmailTransport');
  });

  it('returns a failing transport when Resend is selected without credentials', async () => {
    vi.doMock('@/config/env', () => ({
      env: {
        EMAIL_PROVIDER: 'resend',
        EMAIL_RESEND_API_KEY: undefined,
        EMAIL_RESEND_API_BASE_URL: 'https://api.resend.com',
        EMAIL_DELIVERY_TIMEOUT_MS: 5000
      }
    }));

    const { createEmailDeliveryRegistry } = await import('@/infrastructure/email/email-delivery.registry');
    const registry = createEmailDeliveryRegistry();

    await expect(
      registry.transactionalEmailPort.send({
        from: 'no-reply@example.com',
        to: ['user@example.com'],
        subject: 'subject',
        html: '<p>html</p>',
        text: 'text',
        idempotencyKey: 'key',
        metadata: {
          semantic: 'auth.email_verification',
          templateKey: 'verify-email',
          templateVersion: '1.0.0'
        }
      })
    ).rejects.toThrow('Transactional email transport is not configured');
  });
});
