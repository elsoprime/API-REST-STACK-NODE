import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { HTTP_STATUS } from '@/constants/http';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { AppError } from '@/infrastructure/errors/app-error';

function createRuntimeAuthTestApp() {
  const service = {
    register: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'pending_verification',
        isEmailVerified: false
      },
      verification: {
        required: true,
        expiresAt: '2026-03-08T00:00:00.000Z',
        token: 'should-not-leak'
      }
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

  apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    service
  };
}

describe('auth runtime contract', () => {
  it('does not leak verification previews even if a service returns them accidentally', async () => {
    const { app } = createRuntimeAuthTestApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.verification).toEqual({
      required: true,
      expiresAt: '2026-03-08T00:00:00.000Z'
    });
  });

  it('surfaces 403 for email-not-verified login errors', async () => {
    const { app, service } = createRuntimeAuthTestApp();

    service.login.mockRejectedValue(
      new AppError({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Email verification required before login',
        statusCode: HTTP_STATUS.FORBIDDEN
      })
    );

    const response = await request(app).post('/api/v1/auth/login/headless').send({
      email: 'john@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
  });

  it('surfaces 423 for account-lockout login errors', async () => {
    const { app, service } = createRuntimeAuthTestApp();

    service.login.mockRejectedValue(
      new AppError({
        code: 'AUTH_ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to failed login attempts',
        statusCode: HTTP_STATUS.LOCKED
      })
    );

    const response = await request(app).post('/api/v1/auth/login/browser').send({
      email: 'john@example.com',
      password: 'Password123!'
    });

    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
  });
});
