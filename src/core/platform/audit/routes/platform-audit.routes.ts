import { Router, type RequestHandler } from 'express';

import { createAuditController } from '@/core/platform/audit/controllers/audit.controller';
import { listAuditLogsQuerySchema } from '@/core/platform/audit/schemas/audit.schemas';
import { auditService } from '@/core/platform/audit/services/audit.service';
import { type AuditServiceContract } from '@/core/platform/audit/types/audit.types';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePlatformPermission } from '@/infrastructure/middleware/requirePlatformPermission.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';

export function createPlatformAuditRouter(
  platformAccessMiddleware: RequestHandler = requirePlatformPermission('platform:audit:read'),
  service: AuditServiceContract = auditService
) {
  const router = Router();
  const controller = createAuditController(service);

  router.get(
    '/',
    authenticateMiddleware,
    platformAccessMiddleware,
    validateQuery(listAuditLogsQuerySchema),
    controller.listPlatformAuditLogs
  );

  return router;
}
