import { Router } from 'express';

import { createPlatformSettingsController } from '@/core/platform/settings/controllers/platform-settings.controller';
import { updatePlatformSettingsSchema } from '@/core/platform/settings/schemas/platform-settings.schemas';
import { platformSettingsService } from '@/core/platform/settings/services/platform-settings.service';
import { type PlatformSettingsServiceContract } from '@/core/platform/settings/types/platform-settings.types';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePlatformPermission } from '@/infrastructure/middleware/requirePlatformPermission.middleware';
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

export function createPlatformSettingsRouter(
  service: PlatformSettingsServiceContract = platformSettingsService
): Router {
  const router = Router();
  const controller = createPlatformSettingsController(service);

  router.get(
    '/settings',
    authenticateMiddleware,
    requirePlatformPermission('platform:settings:read'),
    controller.getSettings
  );
  router.patch(
    '/settings',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    requirePlatformPermission('platform:settings:update'),
    validateBody(updatePlatformSettingsSchema),
    controller.updateSettings
  );

  return router;
}

export const platformSettingsRouter = createPlatformSettingsRouter();
