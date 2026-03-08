describe('tenant invitation registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses webhook delivery in production when URL is configured', async () => {
    const postDeliveryWebhook = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: true,
        TENANT_INVITATION_DELIVERY_WEBHOOK_URL: 'https://delivery.example.com/invitations',
        DELIVERY_WEBHOOK_AUTH_TOKEN: 'token-2',
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3500
      }
    }));

    vi.doMock('@/infrastructure/security/webhook-delivery', () => ({
      postDeliveryWebhook
    }));

    const { createTenantInvitationRegistry } = await import('@/infrastructure/tenant/tenant-invitation.registry');
    const registry = createTenantInvitationRegistry();

    await registry.tenantInvitationDeliveryPort.deliver({
      tenantId: 'tenant-1',
      email: 'member@example.com',
      token: 'token',
      roleKey: 'tenant:member',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });

    expect(postDeliveryWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookUrl: 'https://delivery.example.com/invitations',
        timeoutMs: 3500,
        bearerToken: 'token-2',
        payload: expect.objectContaining({
          event: 'tenant.invitation'
        })
      })
    );
  });

  it('fails delivery in production when webhook URL is missing', async () => {
    const postDeliveryWebhook = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/config/env', () => ({
      env: {
        NODE_ENV: 'production',
        GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: false,
        TENANT_INVITATION_DELIVERY_WEBHOOK_URL: undefined,
        DELIVERY_WEBHOOK_AUTH_TOKEN: undefined,
        DELIVERY_WEBHOOK_TIMEOUT_MS: 3500
      }
    }));

    vi.doMock('@/infrastructure/security/webhook-delivery', () => ({
      postDeliveryWebhook
    }));

    const { createTenantInvitationRegistry } = await import('@/infrastructure/tenant/tenant-invitation.registry');
    const registry = createTenantInvitationRegistry();

    await expect(
      registry.tenantInvitationDeliveryPort.deliver({
        tenantId: 'tenant-2',
        email: 'member2@example.com',
        token: 'token',
        roleKey: 'tenant:member',
        expiresAt: '2026-03-08T00:00:00.000Z'
      })
    ).rejects.toThrow('Tenant invitation delivery adapter is not configured for production');

    expect(postDeliveryWebhook).not.toHaveBeenCalled();
  });
});
