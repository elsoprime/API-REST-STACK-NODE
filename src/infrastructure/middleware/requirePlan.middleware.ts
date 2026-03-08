import { type RequestHandler } from 'express';

import { type RbacServiceContract } from '@/core/platform/rbac/types/rbac.types';
import { rbacService } from '@/core/platform/rbac/services/rbac.service';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function getTenantContext(locals: Record<string, unknown>): TenantContext {
  const tenantContext = locals.tenantContext as TenantContext | undefined;

  if (!tenantContext?.authorization) {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Tenant authorization context is not available',
      statusCode: 500
    });
  }

  return tenantContext;
}

export function createRequirePlanMiddleware(
  requiredPlanKey: string,
  authorization: RbacServiceContract = rbacService
): RequestHandler {
  return async (_req, res, next) => {
    try {
      const tenantContext = getTenantContext(res.locals as Record<string, unknown>);
      await authorization.assertPlanGranted(tenantContext.authorization, requiredPlanKey);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requirePlan = createRequirePlanMiddleware;
