import { Router } from 'express';

import { createBillingController } from '@/core/platform/billing/controllers/billing.controller';
import {
  createCheckoutSessionSchema,
  providerBillingWebhookSchema
} from '@/core/platform/billing/schemas/billing.schemas';
import { billingService } from '@/core/platform/billing/services/billing.service';
import { type BillingServiceContract } from '@/core/platform/billing/types/billing.types';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { requireCsrfToken } from '@/infrastructure/security/csrf';

function requireCsrfForCookieAuth() {
  return (
    req: Parameters<typeof requireCsrfToken>[0],
    res: Parameters<typeof requireCsrfToken>[1],
    next: Parameters<typeof requireCsrfToken>[2]
  ) => {
    if (req.header('authorization')?.startsWith('Bearer ')) {
      next();
      return;
    }

    requireCsrfToken(req, res, next);
  };
}

export function createBillingRouter(service: BillingServiceContract = billingService): Router {
  const router = Router();
  const controller = createBillingController(service);

  router.get('/plans', authenticateMiddleware, controller.listPlans);

  router.post(
    '/checkout/session',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:update'),
    validateBody(createCheckoutSessionSchema),
    controller.createCheckoutSession
  );

  router.post(
    '/webhooks/provider',
    validateBody(providerBillingWebhookSchema),
    controller.processProviderWebhook
  );

  return router;
}

export const billingRouter = createBillingRouter();
