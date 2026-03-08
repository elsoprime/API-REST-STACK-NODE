import { Router } from 'express';

import { auditService } from '@/core/platform/audit/services/audit.service';
import { createAuditController } from '@/core/platform/audit/controllers/audit.controller';
import { type AuditServiceContract } from '@/core/platform/audit/types/audit.types';
import { listAuditLogsQuerySchema } from '@/core/platform/audit/schemas/audit.schemas';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';

export function createAuditRouter(service: AuditServiceContract = auditService) {
  const router = Router();
  const controller = createAuditController(service);

  router.get(
    '/',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:audit:read'),
    validateQuery(listAuditLogsQuerySchema),
    controller.listAuditLogs
  );

  return router;
}

export const auditRouter = createAuditRouter();
