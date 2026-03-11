import { Router } from 'express';

import { createTenantController } from '@/core/tenant/controllers/tenant.controller';
import { tenantSettingsRouter } from '@/core/tenant/settings/routes/tenant-settings.routes';
import {
  acceptInvitationSchema,
  assignTenantSubscriptionSchema,
  createInvitationSchema,
  createTenantSchema,
  revokeInvitationSchema,
  switchActiveTenantSchema,
  transferOwnershipSchema
} from '@/core/tenant/schemas/tenant.schemas';
import { tenantService } from '@/core/tenant/services/tenant.service';
import { type TenantServiceContract } from '@/core/tenant/types/tenant.types';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { sensitiveRateLimiter } from '@/infrastructure/middleware/rateLimiter.middleware';
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

export function createTenantRouter(service: TenantServiceContract = tenantService): Router {
  const tenantRouter = Router();
  const controller = createTenantController(service);

  tenantRouter.use('/settings', tenantSettingsRouter);

  tenantRouter.post(
    '/',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    validateBody(createTenantSchema),
    controller.createTenant
  );
  tenantRouter.get('/mine', authenticateMiddleware, controller.listMyTenants);
  tenantRouter.post(
    '/switch',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    validateBody(switchActiveTenantSchema),
    controller.switchActiveTenant
  );
  tenantRouter.post(
    '/invitations',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    validateBody(createInvitationSchema),
    controller.createInvitation
  );
  tenantRouter.post(
    '/invitations/accept',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    sensitiveRateLimiter,
    validateBody(acceptInvitationSchema),
    controller.acceptInvitation
  );
  tenantRouter.post(
    '/invitations/revoke',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    validateBody(revokeInvitationSchema),
    controller.revokeInvitation
  );
  tenantRouter.post(
    '/transfer-ownership',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    validateBody(transferOwnershipSchema),
    controller.transferOwnership
  );
  tenantRouter.patch(
    '/subscription',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:update'),
    validateBody(assignTenantSubscriptionSchema),
    controller.assignSubscription
  );
  tenantRouter.delete(
    '/subscription',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:update'),
    controller.cancelSubscription
  );

  return tenantRouter;
}

export const tenantRouter = createTenantRouter();
