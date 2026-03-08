import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthService } from '@/core/platform/auth/services/auth.service';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { tokenService } from '@/core/platform/auth/services/token.service';
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

describe('auth delivery flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies email using a token obtained from the delivery adapter instead of HTTP', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const provisioningAdapter = new InMemoryTwoFactorProvisioningAdapter();
    const sessionMock = {
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
    const registerSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const savedUser = {
      _id: fakeUserId,
      status: 'pending_verification' as const,
      save: vi.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: fakeUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: savedUser.status
      })
    };

    vi.spyOn(mongoose, 'startSession')
      .mockResolvedValueOnce(registerSession as never)
      .mockResolvedValueOnce(sessionMock as never);
    vi.spyOn(UserModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockResolvedValueOnce(savedUser as never);
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

    apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service));
    rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

    const app = createServer({
      rootRouterOverride: rootRouter
    });
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    });

    const delivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.verification.token).toBeUndefined();
    expect(delivery?.token).toBeDefined();

    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValueOnce({
      isEmailVerified: false,
      emailVerificationTokenHash: tokenService.hashToken(delivery?.token ?? ''),
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(undefined)
    } as never);
    const verifyResponse = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'john@example.com',
      token: delivery?.token
    });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.user).toMatchObject({
      email: 'john@example.com'
    });
  });
});
