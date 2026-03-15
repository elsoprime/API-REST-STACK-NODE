import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { HTTP_STATUS } from '@/constants/http';
import { createBillingRouter } from '@/core/platform/billing/routes/billing.routes';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function createBillingWebhookSecurityTestApp() {
  const service = {
    listPlans: vi.fn(),
    createCheckoutSession: vi.fn(),
    processProviderWebhook: vi.fn()
  };

  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.BILLING_BASE_PATH, createBillingRouter(service as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    service
  };
}

describe('billing webhook security routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the standard 401 error envelope when the signature is invalid', async () => {
    const { app, service } = createBillingWebhookSecurityTestApp();
    service.processProviderWebhook.mockRejectedValueOnce(
      new AppError({
        code: ERROR_CODES.AUTH_UNAUTHENTICATED,
        message: 'Billing webhook signature is invalid',
        statusCode: HTTP_STATUS.UNAUTHORIZED
      })
    );

    const response = await request(app)
      .post('/api/v1/billing/webhooks/provider')
      .set('Content-Type', 'application/json')
      .set('X-Billing-Signature', 'invalid-signature')
      .set('X-Billing-Timestamp', String(Math.floor(Date.now() / 1000)))
      .send({
        id: 'evt_signature_invalid',
        provider: 'simulated',
        type: 'billing.checkout.paid',
        data: {
          tenantId: '507f1f77bcf86cd799439011',
          planId: 'plan:growth',
          providerSessionId: 'chk_signature_invalid'
        }
      });

    expect(response.status).toBe(401);
    expect(service.processProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: 'invalid-signature',
        timestamp: expect.any(String),
        rawBody: expect.any(String)
      })
    );
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Billing webhook signature is invalid'
      },
      traceId: expect.any(String)
    });
  });

  it('returns the standard 401 error envelope when the timestamp is outside the tolerance window', async () => {
    const { app, service } = createBillingWebhookSecurityTestApp();
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    service.processProviderWebhook.mockRejectedValueOnce(
      new AppError({
        code: ERROR_CODES.AUTH_UNAUTHENTICATED,
        message: 'Billing webhook timestamp is outside tolerance window',
        statusCode: HTTP_STATUS.UNAUTHORIZED
      })
    );

    const response = await request(app)
      .post('/api/v1/billing/webhooks/provider')
      .set('Content-Type', 'application/json')
      .set('X-Billing-Signature', 'signed-but-expired')
      .set('X-Billing-Timestamp', expiredTimestamp)
      .send({
        id: 'evt_timestamp_invalid',
        provider: 'simulated',
        type: 'billing.checkout.paid',
        data: {
          tenantId: '507f1f77bcf86cd799439011',
          planId: 'plan:growth',
          providerSessionId: 'chk_timestamp_invalid'
        }
      });

    expect(response.status).toBe(401);
    expect(service.processProviderWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: 'signed-but-expired',
        timestamp: expiredTimestamp,
        rawBody: expect.any(String)
      })
    );
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'AUTH_UNAUTHENTICATED',
        message: 'Billing webhook timestamp is outside tolerance window'
      },
      traceId: expect.any(String)
    });
  });
});
