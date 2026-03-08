import { Router } from 'express';

import { createTenantSettingsController } from '@/core/tenant/settings/controllers/tenant-settings.controller';
import { updateTenantSettingsSchema } from '@/core/tenant/settings/schemas/tenant-settings.schemas';
import { tenantSettingsService } from '@/core/tenant/settings/services/tenant-settings.service';
import {
  type TenantSettingsServiceContract
} from '@/core/tenant/settings/types/tenant-settings.types';
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

export function createTenantSettingsRouter(
  service: TenantSettingsServiceContract = tenantSettingsService
): Router {
  const router = Router();
  const controller = createTenantSettingsController(service);

  router.get(
    '/',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:read'),
    controller.getSettings
  );
  router.patch(
    '/',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:update'),
    validateBody(updateTenantSettingsSchema),
    controller.updateSettings
  );
  router.get(
    '/effective',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:settings:read'),
    controller.getEffectiveSettings
  );

  return router;
}

export const tenantSettingsRouter = createTenantSettingsRouter();
