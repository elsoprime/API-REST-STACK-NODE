import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';

const fakeAuthResult = {
  user: {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    status: 'pending_verification' as const,
    isEmailVerified: false
  },
  session: {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: '2026-03-08T00:00:00.000Z'
  },
  tokens: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    csrfToken: 'csrf-token'
  }
};

function createAuthTestApp() {
  const service = {
    register: vi.fn().mockResolvedValue({
      accepted: true
    }),
    resendVerification: vi.fn().mockResolvedValue({
      accepted: true
    }),
    forgotPassword: vi.fn().mockResolvedValue({
      accepted: true
    }),
    resetPassword: vi.fn().mockResolvedValue({
      reset: true,
      revokedSessionIds: ['session-1']
    }),
    changePassword: vi.fn().mockResolvedValue({
      changed: true,
      revokedSessionIds: ['session-2']
    }),
    login: vi.fn().mockResolvedValue(fakeAuthResult),
    refresh: vi.fn().mockResolvedValue(fakeAuthResult),
    logout: vi.fn().mockResolvedValue({
      revokedSessionIds: ['session-1']
    }),
    logoutAll: vi.fn().mockResolvedValue({
      revokedSessionIds: ['session-1', 'session-2']
    }),
    verifyEmail: vi.fn(),
    setupTwoFactor: vi.fn(),
    confirmTwoFactor: vi.fn(),
    disableTwoFactor: vi.fn(),
    regenerateRecoveryCodes: vi.fn()
  };
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    service
  };
}

describe('auth routes', () => {
  const authenticatedUserId = '507f1f77bcf86cd799439010';
  const authenticatedSessionId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: authenticatedSessionId,
      userId: authenticatedUserId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a user with the success envelope', async () => {
    const { app, service } = createAuthTestApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John'
    });

    expect(response.status).toBe(202);
    expect(service.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        password: 'Password123!',
        firstName: 'John'
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        accepted: true
      }
    });
    expect(response.body.traceId).toBeDefined();
  });

  it('returns cookies for browser login without exposing tokens in the body', async () => {
    const { app } = createAuthTestApp();
    const response = await request(app).post('/api/v1/auth/login/browser').send({
      email: 'john@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      user: {
        id: 'user-1'
      },
      session: {
        id: 'session-1'
      }
    });
    expect(response.body.data.accessToken).toBeUndefined();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${process.env.AUTH_ACCESS_COOKIE_NAME}=access-token`),
        expect.stringContaining(`${process.env.REFRESH_TOKEN_COOKIE_NAME}=refresh-token`),
        expect.stringContaining(`${process.env.CSRF_COOKIE_NAME}=csrf-token`)
      ])
    );
  });

  it('returns tokens in the body for headless login', async () => {
    const { app } = createAuthTestApp();
    const response = await request(app).post('/api/v1/auth/login/headless').send({
      email: 'john@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('requires CSRF for browser refresh', async () => {
    const { app } = createAuthTestApp();
    const response = await request(app)
      .post('/api/v1/auth/refresh/browser')
      .set('Cookie', [`${process.env.REFRESH_TOKEN_COOKIE_NAME}=refresh-token`, `${process.env.CSRF_COOKIE_NAME}=csrf-token`]);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTH_CSRF_INVALID'
      }
    });
  });

  it('refreshes browser sessions when CSRF and refresh cookie are present', async () => {
    const { app, service } = createAuthTestApp();
    const response = await request(app)
      .post('/api/v1/auth/refresh/browser')
      .set('Cookie', [`${process.env.REFRESH_TOKEN_COOKIE_NAME}=refresh-token`, `${process.env.CSRF_COOKIE_NAME}=csrf-token`])
      .set(APP_CONFIG.CSRF_HEADER, 'csrf-token');

    expect(response.status).toBe(200);
    expect(service.refresh).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: 'refresh-token'
      })
    );
    expect(response.body.data.accessToken).toBeUndefined();
  });

  it('uses bearer tokens for logout without requiring CSRF', async () => {
    const { app, service } = createAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(service.logout).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: authenticatedSessionId
      })
    );
    expect(response.body.data).toEqual({
      revokedSessionIds: ['session-1']
    });
  });
});
