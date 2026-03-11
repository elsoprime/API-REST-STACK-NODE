import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { clearRateLimiterStore } from '@/infrastructure/middleware/rateLimiter.middleware';

function createPasswordManagementTestApp() {
  const service = {
    register: vi.fn(),
    resendVerification: vi.fn(),
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
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
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

describe('auth password-management routes', () => {
  const authenticatedUserId = '507f1f77bcf86cd799439010';
  const authenticatedSessionId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    clearRateLimiterStore();
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: authenticatedSessionId,
      userId: authenticatedUserId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearRateLimiterStore();
  });

  it('accepts forgot-password without leaking account state', async () => {
    const { app, service } = createPasswordManagementTestApp();
    const response = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'john@example.com'
    });

    expect(response.status).toBe(202);
    expect(service.forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com'
      })
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        accepted: true
      }
    });
  });

  it('resets password through the public token flow', async () => {
    const { app, service } = createPasswordManagementTestApp();
    const response = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'john@example.com',
      token: 'reset-token',
      newPassword: 'Password123!'
    });

    expect(response.status).toBe(200);
    expect(service.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        token: 'reset-token',
        newPassword: 'Password123!'
      })
    );
    expect(response.body.data).toEqual({
      reset: true,
      revokedSessionIds: ['session-1']
    });
  });

  it('changes password for an authenticated bearer session without CSRF', async () => {
    const { app, service } = createPasswordManagementTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!'
      });

    expect(response.status).toBe(200);
    expect(service.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        sessionId: authenticatedSessionId,
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!'
      })
    );
    expect(response.body.data).toEqual({
      changed: true,
      revokedSessionIds: ['session-2']
    });
  });

  it('requires CSRF when change-password is authenticated by cookie', async () => {
    const { app } = createPasswordManagementTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .send({
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
  });
});
