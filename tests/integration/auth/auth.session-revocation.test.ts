import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AUTH_SESSION_STATUS } from '@/constants/security';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';

function createAuthSessionHardeningApp() {
  const service = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue({
      revokedSessionIds: ['507f1f77bcf86cd799439011']
    }),
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

describe('auth session revocation hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects logout when the persisted auth session has been revoked', async () => {
    const { app, service } = createAuthSessionHardeningApp();
    const fakeSessionId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeSessionId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: fakeSessionId,
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.REVOKED,
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
    expect(service.logout).not.toHaveBeenCalled();
  });

  it('rejects logout when the persisted auth session has expired', async () => {
    const { app, service } = createAuthSessionHardeningApp();
    const fakeSessionId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeSessionId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: fakeSessionId,
      userId: fakeUserId,
      status: AUTH_SESSION_STATUS.ACTIVE,
      expiresAt: new Date(Date.now() - 60_000)
    } as never);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_UNAUTHENTICATED');
    expect(service.logout).not.toHaveBeenCalled();
  });
});
