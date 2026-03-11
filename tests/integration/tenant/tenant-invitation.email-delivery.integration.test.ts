import mongoose, { Types } from 'mongoose';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

function createAuthorizationStub() {
  return {
    resolveRole: vi.fn().mockImplementation(async ({ roleKey }: { roleKey: string }) => ({
      key: roleKey
    })),
    resolvePlan: vi.fn().mockResolvedValue(null)
  };
}

describe('tenant invitation email delivery integration', () => {
  const originalEnvironment = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    TENANT_INVITATION_ACCEPT_URL: process.env.TENANT_INVITATION_ACCEPT_URL,
    EMAIL_RESEND_API_KEY: process.env.EMAIL_RESEND_API_KEY,
    EMAIL_RESEND_API_BASE_URL: process.env.EMAIL_RESEND_API_BASE_URL
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();

    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('sends tenant invitations through the configured transactional email transport', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_FROM = 'no-reply@example.com';
    process.env.EMAIL_FROM_NAME = 'SaaS Core Engine';
    process.env.TENANT_INVITATION_ACCEPT_URL = 'https://app.example.com/tenant/invitations/accept';
    process.env.EMAIL_RESEND_API_KEY = 're_test_123';
    process.env.EMAIL_RESEND_API_BASE_URL = 'https://api.resend.com';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-2' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const [{ TenantService }, { TenantModel }, { MembershipModel }, { InvitationModel }] = await Promise.all([
      import('@/core/tenant/services/tenant.service'),
      import('@/core/tenant/models/tenant.model'),
      import('@/core/tenant/models/membership.model'),
      import('@/core/tenant/models/invitation.model')
    ]);

    const fakeTenantId = new Types.ObjectId();
    const fakeInvitationId = new Types.ObjectId();
    const fakeOwnerUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      name: 'Acme',
      status: 'active',
      ownerUserId: fakeOwnerUserId,
      planId: null,
      activeModuleKeys: []
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);
    vi.spyOn(InvitationModel, 'findOne').mockResolvedValue(null as never);
    vi.spyOn(InvitationModel, 'create').mockResolvedValue([
      {
        _id: fakeInvitationId,
        roleKey: 'tenant:member',
        status: 'pending',
        toObject: () => ({
          _id: fakeInvitationId,
          tenantId: fakeTenantId,
          email: 'member@example.com',
          roleKey: 'tenant:member',
          status: 'pending',
          expiresAt: new Date('2026-03-14T00:00:00.000Z')
        })
      }
    ] as never);

    const service = new TenantService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyAccessToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      createAuthorizationStub() as never,
      createAuditStub() as never
    );

    const result = await service.createInvitation({
      userId: fakeOwnerUserId.toString(),
      tenantId: fakeTenantId.toString(),
      email: 'member@example.com'
    });

    expect(result.invitation.email).toBe('member@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const resendPayload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      subject?: string;
      html?: string;
      text?: string;
    };

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_123'
        })
      })
    );
    expect(resendPayload.subject).toContain('Invitacion para unirte a Acme');
    expect(resendPayload.html).toContain('Aceptar invitacion');
    expect(resendPayload.html).toContain('Rol asignado');
    expect(resendPayload.text).toContain('Rol asignado: Member');
  });
});
