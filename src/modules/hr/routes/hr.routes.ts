import { Router, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { requireCsrfToken } from '@/infrastructure/security/csrf';
import { createHrController } from '@/modules/hr/controllers/hr.controller';
import {
  createHrEmployeeSchema,
  hrEmployeeParamsSchema,
  listHrEmployeesQuerySchema,
  updateHrCompensationSchema,
  updateHrEmployeeSchema
} from '@/modules/hr/schemas/hr.schemas';
import { hrService } from '@/modules/hr/services/hr.service';
import { type HrServiceContract } from '@/modules/hr/types/hr.types';

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

const validateHrEmployeeParams: RequestHandler = (req, _res, next) => {
  const parsed = hrEmployeeParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    next(
      new AppError({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Route params validation failed',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: mapZodIssuesToErrorDetails(parsed.error.issues)
      })
    );
    return;
  }

  req.params = parsed.data;
  next();
};

export function createHrRouter(service: HrServiceContract = hrService): Router {
  const router = Router();
  const controller = createHrController(service);

  const requireHrEmployeeRead = requirePermission('tenant:hr:employee:read');
  const requireHrEmployeeWrite = requirePermission('tenant:hr:employee:write');
  const requireHrEmployeeDelete = requirePermission('tenant:hr:employee:delete');
  const requireHrCompensationRead = requirePermission('tenant:hr:compensation:read');
  const requireHrCompensationUpdate = requirePermission('tenant:hr:compensation:update');

  router.use(authenticateMiddleware, resolveTenantContextMiddleware);
  router.use(requirePermission('tenant:modules:hr:use'));

  router.post(
    '/employees',
    requireHrEmployeeWrite,
    requireCsrfForCookieAuth(),
    validateBody(createHrEmployeeSchema),
    controller.createEmployee
  );
  router.get('/employees', requireHrEmployeeRead, validateQuery(listHrEmployeesQuerySchema), controller.listEmployees);
  router.get('/employees/:employeeId', requireHrEmployeeRead, validateHrEmployeeParams, controller.getEmployee);
  router.patch(
    '/employees/:employeeId',
    requireHrEmployeeWrite,
    requireCsrfForCookieAuth(),
    validateHrEmployeeParams,
    validateBody(updateHrEmployeeSchema),
    controller.updateEmployee
  );
  router.delete(
    '/employees/:employeeId',
    requireHrEmployeeDelete,
    requireCsrfForCookieAuth(),
    validateHrEmployeeParams,
    controller.deleteEmployee
  );
  router.get(
    '/employees/:employeeId/compensation',
    requireHrCompensationRead,
    validateHrEmployeeParams,
    controller.getCompensation
  );
  router.patch(
    '/employees/:employeeId/compensation',
    requireHrCompensationUpdate,
    requireCsrfForCookieAuth(),
    validateHrEmployeeParams,
    validateBody(updateHrCompensationSchema),
    controller.updateCompensation
  );

  return router;
}

export const hrRouter = createHrRouter();
