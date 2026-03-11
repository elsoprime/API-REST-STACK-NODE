import mongoose, { Types } from 'mongoose';
import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { createAuthRouter } from '@/core/platform/auth/routes/auth.routes';
import { AuthService } from '@/core/platform/auth/services/auth.service';
import { UserModel } from '@/core/platform/users/models/user.model';
import { UserSecurityModel } from '@/core/platform/users/models/user-security.model';
import { clearRateLimiterStore } from '@/infrastructure/middleware/rateLimiter.middleware';
import { InMemoryEmailVerificationDeliveryAdapter } from '@/infrastructure/security/email-verification-delivery.memory';
import { InMemoryTwoFactorProvisioningAdapter } from '@/infrastructure/security/two-factor-provisioning.memory';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

describe('register privacy hardening', () => {
  beforeEach(() => {
    clearRateLimiterStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearRateLimiterStore();
  });

  it('returns the same hardened response for new and existing pending emails', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const service = new AuthService(
      undefined,
      undefined,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      createAuditStub() as never
    );
    const rootRouter = Router();
    const apiV1Router = Router();
    const registerSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const newUserId = new Types.ObjectId();
    const existingUserId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(registerSession as never);
    vi.spyOn(UserModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: existingUserId,
          email: 'existing@example.com',
          firstName: 'Existing',
          lastName: 'User',
          status: 'pending_verification'
        })
      } as never);
    vi.spyOn(UserModel, 'create').mockResolvedValue([
      {
        _id: newUserId,
        toObject: () => ({
          _id: newUserId,
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          status: 'pending_verification'
        })
      }
    ] as never);
    vi.spyOn(UserSecurityModel, 'create').mockResolvedValue([] as never);
    vi.spyOn(UserSecurityModel, 'updateOne').mockResolvedValue({
      acknowledged: true
    } as never);

    apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, createAuthRouter(service));
    rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

    const app = createServer({
      rootRouterOverride: rootRouter
    });
    const newRegistrationResponse = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User'
    });
    const existingRegistrationResponse = await request(app).post('/api/v1/auth/register').send({
      email: 'existing@example.com',
      password: 'Password123!',
      firstName: 'Different',
      lastName: 'Payload'
    });

    expect(newRegistrationResponse.status).toBe(202);
    expect(existingRegistrationResponse.status).toBe(202);
    expect(newRegistrationResponse.body.data).toEqual({
      accepted: true
    });
    expect(existingRegistrationResponse.body.data).toEqual({
      accepted: true
    });
    expect(deliveryAdapter.peekLatestByEmail('new@example.com')?.token).toBeDefined();
    expect(deliveryAdapter.peekLatestByEmail('existing@example.com')).toBeUndefined();
  });
});
