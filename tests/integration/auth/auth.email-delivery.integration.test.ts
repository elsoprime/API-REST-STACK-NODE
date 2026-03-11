import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

describe('auth email delivery integration', () => {
  const originalEnvironment = {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    AUTH_VERIFY_EMAIL_URL: process.env.AUTH_VERIFY_EMAIL_URL,
    AUTH_RESET_PASSWORD_URL: process.env.AUTH_RESET_PASSWORD_URL,
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

  it('sends the verify-email template through the configured transactional email transport', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_FROM = 'no-reply@example.com';
    process.env.EMAIL_FROM_NAME = 'SaaS Core Engine';
    process.env.AUTH_VERIFY_EMAIL_URL = 'https://app.example.com/auth/verify-email';
    process.env.AUTH_RESET_PASSWORD_URL = 'https://app.example.com/auth/reset-password';
    process.env.EMAIL_RESEND_API_KEY = 're_test_123';
    process.env.EMAIL_RESEND_API_BASE_URL = 'https://api.resend.com';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-1' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const [{ createServer }, { APP_CONFIG }, { createAuthRouter }, { AuthService }, { UserModel }, { UserSecurityModel }] =
      await Promise.all([
        import('@/app/server'),
        import('@/config/app'),
        import('@/core/platform/auth/routes/auth.routes'),
        import('@/core/platform/auth/services/auth.service'),
        import('@/core/platform/users/models/user.model'),
        import('@/core/platform/users/models/user-security.model')
      ]);

    const fakeUserId = new Types.ObjectId();
    const registerSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(registerSession as never);
    vi.spyOn(UserModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);
    vi.spyOn(UserModel, 'create').mockResolvedValue([
      {
        _id: fakeUserId,
        toObject: () => ({
          _id: fakeUserId,
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          status: 'pending_verification'
        })
      }
    ] as never);
    vi.spyOn(UserSecurityModel, 'create').mockResolvedValue([] as never);
    vi.spyOn(UserSecurityModel, 'updateOne').mockResolvedValue({
      acknowledged: true
    } as never);

    const service = new AuthService(undefined, undefined, undefined, undefined, undefined, createAuditStub() as never);
    const rootRouter = Router();
    const apiV1Router = Router();

    apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service));
    rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

    const app = createServer({
      rootRouterOverride: rootRouter
    });
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    });

    expect(response.status).toBe(202);
    expect(response.body.data).toEqual({
      accepted: true
    });
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
    expect(resendPayload.subject).toContain('Verifica tu correo');
    expect(resendPayload.html).toContain('lang="es"');
    expect(resendPayload.html).toContain('Verificar correo');
    expect(resendPayload.text).toContain('Recibimos una solicitud para verificar el correo');
  });
});
