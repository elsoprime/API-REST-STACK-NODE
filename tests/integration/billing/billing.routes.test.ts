import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createBillingRouter } from '@/core/platform/billing/routes/billing.routes';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function createBillingTestApp() {
  const service = {
    listPlans: vi.fn().mockResolvedValue({
      items: [
        {
          key: 'plan:starter',
          name: 'Starter',
          description: 'Entry plan',
          rank: 100,
          allowedModuleKeys: ['inventory'],
          featureFlagKeys: ['inventory:base'],
          memberLimit: 5
        }
      ]
    }),
    createCheckoutSession: vi.fn().mockResolvedValue({
      id: '507f1f77bcf86cd799439091',
      tenantId: '507f1f77bcf86cd799439011',
      planId: 'plan:growth',
      provider: 'simulated',
      providerSessionId: 'chk_test_123',
      status: 'pending',
      checkoutUrl: 'http://localhost:3000/app/settings/billing?session=chk_test_123',
      createdAt: '2026-03-10T12:00:00.000Z',
      expiresAt: '2026-03-10T12:30:00.000Z',
      activatedAt: null
    }),
    processProviderWebhook: vi.fn().mockResolvedValue({
      eventId: 'evt_123',
      provider: 'simulated',
      type: 'billing.checkout.paid',
      status: 'processed',
      checkoutSessionId: '507f1f77bcf86cd799439091',
      tenantId: '507f1f77bcf86cd799439011'
    })
  };

  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.BILLING_BASE_PATH, createBillingRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    service
  };
}

describe('billing routes', () => {
  const userId = '507f1f77bcf86cd799439010';
  const sessionId = '507f1f77bcf86cd799439012';
  const tenantId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: sessionId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists billing plans for authenticated users', async () => {
    const { app, service } = createBillingTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: sessionId,
      scope: ['platform:self']
    });

    const response = await request(app)
      .get('/api/v1/billing/plans')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(service.listPlans).toHaveBeenCalled();
    expect(response.body.data.items[0].key).toBe('plan:starter');
  });

  it('creates checkout session for tenant owner', async () => {
    const { app, service } = createBillingTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: sessionId,
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: new Types.ObjectId(tenantId),
      status: 'active',
      ownerUserId: new Types.ObjectId(userId),
      planId: null,
      activeModuleKeys: []
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(userId),
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .post('/api/v1/billing/checkout/session')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId)
      .send({
        planId: 'plan:growth',
        provider: 'simulated'
      });

    expect(response.status).toBe(201);
    expect(service.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        planId: 'plan:growth',
        provider: 'simulated'
      })
    );
    expect(response.body.data.checkoutSession.status).toBe('pending');
  });

  it('accepts provider webhook payload and returns process result envelope', async () => {
    const { app, service } = createBillingTestApp();

    const response = await request(app)
      .post('/api/v1/billing/webhooks/provider')
      .set('X-Billing-Signature', 'test-signature')
      .send({
        id: 'evt_123',
        provider: 'simulated',
        type: 'billing.checkout.paid',
        data: {
          tenantId,
          planId: 'plan:growth',
          providerSessionId: 'chk_test_123'
        }
      });

    expect(response.status).toBe(200);
    expect(service.processProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: 'test-signature'
      })
    );
    expect(response.body.data.status).toBe('processed');
  });
});
