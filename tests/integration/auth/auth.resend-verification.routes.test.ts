import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { clearRateLimiterStore } from '@/infrastructure/middleware/rateLimiter.middleware';

function createResendVerificationTestApp() {
  const service = {
    register: vi.fn(),
    resendVerification: vi.fn().mockResolvedValue({
      accepted: true,
      debug: 'should-not-leak'
    }),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
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

describe('resend-verification routes', () => {
  beforeEach(() => {
    clearRateLimiterStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearRateLimiterStore();
  });

  it('returns the hardened resend-verification envelope without leaking internals', async () => {
    const { app, service } = createResendVerificationTestApp();
    const response = await request(app).post('/api/v1/auth/resend-verification').send({
      email: 'john@example.com'
    });

    expect(response.status).toBe(202);
    expect(service.resendVerification).toHaveBeenCalledWith(
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
    expect(response.body.data.debug).toBeUndefined();
  });

  it('applies sensitive rate limiting to resend-verification', async () => {
    const { app } = createResendVerificationTestApp();
    let lastResponse = await request(app).post('/api/v1/auth/resend-verification').send({
      email: 'john@example.com'
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      lastResponse = await request(app).post('/api/v1/auth/resend-verification').send({
        email: 'john@example.com'
      });
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.error.code).toBe('GEN_RATE_LIMITED');
  });
});
