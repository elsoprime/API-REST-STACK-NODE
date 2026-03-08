import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthService } from '@/core/platform/auth/services/auth.service';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { twoFactorService } from '@/core/platform/auth/services/two-factor.service';
import { InMemoryEmailVerificationDeliveryAdapter } from '@/infrastructure/security/email-verification-delivery.memory';
import { InMemoryTwoFactorProvisioningAdapter } from '@/infrastructure/security/two-factor-provisioning.memory';
import { UserModel } from '@/core/platform/users/models/user.model';
import { UserSecurityModel } from '@/core/platform/users/models/user-security.model';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

describe('auth 2FA provisioning flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms 2FA using the secret obtained from the provisioning adapter instead of HTTP', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const provisioningAdapter = new InMemoryTwoFactorProvisioningAdapter();
    const setupSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const confirmSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AuthService(
      undefined,
      undefined,
      undefined,
      deliveryAdapter,
      provisioningAdapter,
      createAuditStub() as never
    );
    const rootRouter = Router();
    const apiV1Router = Router();
    const fakeUserId = new Types.ObjectId();
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });
    const securityRecord = {
      twoFactorEnabled: false,
      twoFactorPendingSecretEncrypted: null as string | null,
      recoveryCodeHashes: [] as string[],
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(UserModel, 'findById').mockResolvedValue({
      _id: fakeUserId,
      email: 'john@example.com'
    } as never);
    vi.spyOn(mongoose, 'startSession')
      .mockResolvedValueOnce(setupSession as never)
      .mockResolvedValueOnce(confirmSession as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: fakeUserId,
      userId: fakeUserId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue(securityRecord as never);

    apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service));
    rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

    const app = createServer({
      rootRouterOverride: rootRouter
    });
    const setupResponse = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${accessToken}`);

    const provisioning = provisioningAdapter.peekLatestByUserId(fakeUserId.toString());

    expect(setupResponse.status).toBe(200);
    expect(setupResponse.body.data.secret).toBeUndefined();
    expect(provisioning?.secret).toBeDefined();

    const code = twoFactorService.generateCode(provisioning?.secret ?? '');
    const confirmResponse = await request(app)
      .post('/api/v1/auth/2fa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code
      });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.data).toEqual({
      enabled: true
    });
    expect(securityRecord.twoFactorEnabled).toBe(true);
    expect(securityRecord.recoveryCodeHashes.length).toBeGreaterThan(0);
  });
});
