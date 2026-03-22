import { type NextFunction, type Request, type Response, Router } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { createTenantMembershipsController } from '@/core/tenant/memberships/controllers/tenant-memberships.controller';
import {
  listTenantMembershipsQuerySchema,
  tenantMembershipIdParamSchema,
  updateTenantMembershipSchema
} from '@/core/tenant/memberships/schemas/tenant-memberships.schemas';
import { tenantMembershipsService } from '@/core/tenant/memberships/services/tenant-memberships.service';
import {
  type TenantMembershipsServiceContract
} from '@/core/tenant/memberships/types/tenant-memberships.types';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
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

function validateMembershipIdParam(req: Request, _res: Response, next: NextFunction): void {
  const parsed = tenantMembershipIdParamSchema.safeParse(req.params);

  if (!parsed.success) {
    next(
      new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request params validation failed',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: mapZodIssuesToErrorDetails(parsed.error.issues)
      })
    );
    return;
  }

  req.params = parsed.data;
  next();
}

export function createTenantMembershipsRouter(
  service: TenantMembershipsServiceContract = tenantMembershipsService
): Router {
  const router = Router();
  const controller = createTenantMembershipsController(service);

  router.get(
    '/',
    authenticateMiddleware,
    resolveTenantContextMiddleware,
    requirePermission('tenant:memberships:read'),
    validateQuery(listTenantMembershipsQuerySchema),
    controller.listMemberships
  );
  router.patch(
    '/:membershipId',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:memberships:update'),
    validateMembershipIdParam,
    validateBody(updateTenantMembershipSchema),
    controller.updateMembership
  );
  router.delete(
    '/:membershipId',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    resolveTenantContextMiddleware,
    requirePermission('tenant:memberships:delete'),
    validateMembershipIdParam,
    controller.deleteMembership
  );

  return router;
}

export const tenantMembershipsRouter = createTenantMembershipsRouter();
