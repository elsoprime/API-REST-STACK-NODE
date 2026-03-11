describe('tenant invitation registry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses transactional email delivery for tenant invitations', async () => {
    const sendTemplate = vi.fn().mockResolvedValue({
      provider: 'mailpit',
      messageId: null,
      acceptedRecipients: ['member@example.com']
    });

    vi.doMock('@/config/env', () => ({
      env: {
        APP_NAME: 'SaaS Core Engine',
        EMAIL_FROM: 'no-reply@example.com',
        TENANT_INVITATION_ACCEPT_URL: 'https://app.example.com/tenant/invitations/accept'
      }
    }));
    vi.doMock('@/core/communications/email/services/transactional-email.service', () => ({
      transactionalEmailService: {
        sendTemplate
      }
    }));

    const { createTenantInvitationRegistry } = await import('@/infrastructure/tenant/tenant-invitation.registry');
    const registry = createTenantInvitationRegistry();

    await registry.tenantInvitationDeliveryPort.deliver({
      tenantId: 'tenant-1',
      tenantName: 'Acme',
      email: 'member@example.com',
      token: 'token',
      roleKey: 'tenant:member',
      expiresAt: '2026-03-08T00:00:00.000Z'
    });

    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'tenant-invitation',
        semantic: 'tenant.invitation',
        to: 'member@example.com'
      })
    );
  });
});
