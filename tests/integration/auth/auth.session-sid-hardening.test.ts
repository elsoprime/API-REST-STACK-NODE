import jwt from 'jsonwebtoken';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { env } from '@/config/env';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';

function createInvalidSessionClaimsApp() {
  const authService = {
    register: vi.fn(),
    resendVerification: vi.fn(),
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
  const tenantService = {
    createTenant: vi.fn(),
    listMyTenants: vi.fn(),
    switchActiveTenant: vi.fn(),
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    transferOwnership: vi.fn()
  };
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(authService as never));
  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, createTenantRouter(tenantService as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    authService,
    tenantService
  };
}

function signInvalidSessionAccessToken(): string {
  return jwt.sign(
    {
      sub: '507f1f77bcf86cd799439010',
      sid: 'session-1',
      scope: ['platform:self'],
      tokenType: 'access'
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
}

describe('auth session sid hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects access tokens with a non-ObjectId sid before authenticated routes reach their services', async () => {
    const { app, authService, tenantService } = createInvalidSessionClaimsApp();
    const accessToken = signInvalidSessionAccessToken();

    const requests = await Promise.all([
      request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`),
      request(app).post('/api/v1/auth/2fa/setup').set('Authorization', `Bearer ${accessToken}`),
      request(app)
        .post('/api/v1/tenant')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Acme' }),
      request(app).get('/api/v1/tenant/mine').set('Authorization', `Bearer ${accessToken}`)
    ]);

    for (const response of requests) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
    }

    expect(authService.logout).not.toHaveBeenCalled();
    expect(authService.setupTwoFactor).not.toHaveBeenCalled();
    expect(tenantService.createTenant).not.toHaveBeenCalled();
    expect(tenantService.listMyTenants).not.toHaveBeenCalled();
  });
});
