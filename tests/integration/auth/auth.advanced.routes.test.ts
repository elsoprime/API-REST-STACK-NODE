import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';

function createAdvancedAuthTestApp() {
  const service = {
    register: vi.fn(),
    resendVerification: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    verifyEmail: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        isEmailVerified: true
      }
    }),
    setupTwoFactor: vi.fn().mockResolvedValue({
      pending: true
    }),
    confirmTwoFactor: vi.fn().mockResolvedValue({
      enabled: true
    }),
    disableTwoFactor: vi.fn().mockResolvedValue({
      disabled: true
    }),
    regenerateRecoveryCodes: vi.fn().mockResolvedValue({
      regenerated: true
    })
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

describe('advanced auth routes', () => {
  const authenticatedUserId = '507f1f77bcf86cd799439010';
  const authenticatedSessionId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
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

  it('verifies email through the public endpoint', async () => {
    const { app, service } = createAdvancedAuthTestApp();
    const response = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'john@example.com',
      token: 'verify-token'
    });

    expect(response.status).toBe(200);
    expect(service.verifyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        token: 'verify-token'
      })
    );
    expect(response.body.data.user).toMatchObject({
      status: 'active',
      isEmailVerified: true
    });
  });

  it('allows 2FA setup with bearer authentication and no CSRF header', async () => {
    const { app, service } = createAdvancedAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(service.setupTwoFactor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId
      })
    );
    expect(response.body.data).toMatchObject({
      pending: true
    });
    expect(response.body.data.secret).toBeUndefined();
  });

  it('requires CSRF for cookie-authenticated 2FA confirmation', async () => {
    const { app } = createAdvancedAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Cookie', [`${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`, `${process.env.CSRF_COOKIE_NAME}=csrf-token`])
      .send({
        code: '123456'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
  });

  it('confirms 2FA and returns recovery codes', async () => {
    const { app, service } = createAdvancedAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: '123456'
      });

    expect(response.status).toBe(200);
    expect(service.confirmTwoFactor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        code: '123456'
      })
    );
    expect(response.body.data).toEqual({
      enabled: true
    });
  });

  it('disables 2FA with a bearer token and challenge code', async () => {
    const { app, service } = createAdvancedAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/2fa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: '123456'
      });

    expect(response.status).toBe(200);
    expect(service.disableTwoFactor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        code: '123456',
        recoveryCode: undefined
      })
    );
    expect(response.body.data).toEqual({
      disabled: true
    });
  });

  it('regenerates recovery codes for an authenticated user', async () => {
    const { app, service } = createAdvancedAuthTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/recovery-codes/regenerate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: '123456'
      });

    expect(response.status).toBe(200);
    expect(service.regenerateRecoveryCodes).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        code: '123456',
        recoveryCode: undefined
      })
    );
    expect(response.body.data).toEqual({
      regenerated: true
    });
  });
});
