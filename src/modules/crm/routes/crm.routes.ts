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
import { createCrmController } from '@/modules/crm/controllers/crm.controller';
import {
  changeCrmOpportunityStageSchema,
  crmContactParamsSchema,
  crmOpportunityParamsSchema,
  crmOrganizationParamsSchema,
  createCrmActivitySchema,
  createCrmContactSchema,
  createCrmOpportunitySchema,
  createCrmOrganizationSchema,
  listCrmActivitiesQuerySchema,
  listCrmContactsQuerySchema,
  listCrmOpportunitiesQuerySchema,
  listCrmOrganizationsQuerySchema,
  updateCrmContactSchema,
  updateCrmOpportunitySchema,
  updateCrmOrganizationSchema
} from '@/modules/crm/schemas/crm.schemas';
import { crmService } from '@/modules/crm/services/crm.service';
import { type CrmServiceContract } from '@/modules/crm/types/crm.types';

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

const validateCrmContactParams: RequestHandler = (req, _res, next) => {
  const parsed = crmContactParamsSchema.safeParse(req.params);

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

const validateCrmOrganizationParams: RequestHandler = (req, _res, next) => {
  const parsed = crmOrganizationParamsSchema.safeParse(req.params);

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

const validateCrmOpportunityParams: RequestHandler = (req, _res, next) => {
  const parsed = crmOpportunityParamsSchema.safeParse(req.params);

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

export function createCrmRouter(service: CrmServiceContract = crmService): Router {
  const router = Router();
  const controller = createCrmController(service);
  const requireCrmRead = requirePermission('tenant:crm:read');
  const requireCrmWrite = requirePermission('tenant:crm:write');
  const requireCrmDelete = requirePermission('tenant:crm:delete');
  const requireCrmStageUpdate = requirePermission('tenant:crm:stage:update');

  router.use(authenticateMiddleware, resolveTenantContextMiddleware);
  router.use(requirePermission('tenant:modules:crm:use'));

  router.post(
    '/contacts',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateBody(createCrmContactSchema),
    controller.createContact
  );
  router.get('/contacts', requireCrmRead, validateQuery(listCrmContactsQuerySchema), controller.listContacts);
  router.get('/contacts/:contactId', requireCrmRead, validateCrmContactParams, controller.getContact);
  router.patch(
    '/contacts/:contactId',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateCrmContactParams,
    validateBody(updateCrmContactSchema),
    controller.updateContact
  );
  router.delete(
    '/contacts/:contactId',
    requireCrmDelete,
    requireCsrfForCookieAuth(),
    validateCrmContactParams,
    controller.deleteContact
  );

  router.post(
    '/organizations',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateBody(createCrmOrganizationSchema),
    controller.createOrganization
  );
  router.get(
    '/organizations',
    requireCrmRead,
    validateQuery(listCrmOrganizationsQuerySchema),
    controller.listOrganizations
  );
  router.get(
    '/organizations/:organizationId',
    requireCrmRead,
    validateCrmOrganizationParams,
    controller.getOrganization
  );
  router.patch(
    '/organizations/:organizationId',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateCrmOrganizationParams,
    validateBody(updateCrmOrganizationSchema),
    controller.updateOrganization
  );
  router.delete(
    '/organizations/:organizationId',
    requireCrmDelete,
    requireCsrfForCookieAuth(),
    validateCrmOrganizationParams,
    controller.deleteOrganization
  );

  router.post(
    '/opportunities',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateBody(createCrmOpportunitySchema),
    controller.createOpportunity
  );
  router.get(
    '/opportunities',
    requireCrmRead,
    validateQuery(listCrmOpportunitiesQuerySchema),
    controller.listOpportunities
  );
  router.get(
    '/opportunities/:opportunityId',
    requireCrmRead,
    validateCrmOpportunityParams,
    controller.getOpportunity
  );
  router.patch(
    '/opportunities/:opportunityId',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateCrmOpportunityParams,
    validateBody(updateCrmOpportunitySchema),
    controller.updateOpportunity
  );
  router.delete(
    '/opportunities/:opportunityId',
    requireCrmDelete,
    requireCsrfForCookieAuth(),
    validateCrmOpportunityParams,
    controller.deleteOpportunity
  );
  router.patch(
    '/opportunities/:opportunityId/stage',
    requireCrmStageUpdate,
    requireCsrfForCookieAuth(),
    validateCrmOpportunityParams,
    validateBody(changeCrmOpportunityStageSchema),
    controller.changeOpportunityStage
  );

  router.post(
    '/activities',
    requireCrmWrite,
    requireCsrfForCookieAuth(),
    validateBody(createCrmActivitySchema),
    controller.createActivity
  );
  router.get('/activities', requireCrmRead, validateQuery(listCrmActivitiesQuerySchema), controller.listActivities);

  router.get('/counters', requireCrmRead, controller.getCounters);

  return router;
}

export const crmRouter = createCrmRouter();
