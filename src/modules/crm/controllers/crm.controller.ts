import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import { type CrmOpportunityStage, type CrmServiceContract } from '@/modules/crm/types/crm.types';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getTenantContext(res: Response): TenantContext {
  return (res.locals.tenantContext ?? {}) as TenantContext;
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined,
    tenant: res.locals.tenantContext as TenantContext | undefined
  });
}

export function createCrmController(service: CrmServiceContract) {
  return {
    createContact: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const contact = await service.createContact({
          tenantId: tenantContext.tenantId,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone,
          organizationId: req.body.organizationId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ contact }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listContacts: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listContacts({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined,
          organizationId: typeof query.organizationId === 'string' ? query.organizationId : undefined
        });

        res
          .status(HTTP_STATUS.OK)
          .json(
            buildPaginatedSuccess(
              { items: result.items },
              {
                page: result.page,
                limit: result.limit,
                total: result.total
              },
              getTraceId(res)
            )
          );
      } catch (error) {
        next(error);
      }
    },

    getContact: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawContactId = req.params.contactId;
        const contactId = Array.isArray(rawContactId) ? rawContactId[0] : rawContactId;
        const contact = await service.getContact({
          tenantId: tenantContext.tenantId,
          contactId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ contact }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateContact: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawContactId = req.params.contactId;
        const contactId = Array.isArray(rawContactId) ? rawContactId[0] : rawContactId;
        const contact = await service.updateContact({
          tenantId: tenantContext.tenantId,
          contactId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ contact }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteContact: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawContactId = req.params.contactId;
        const contactId = Array.isArray(rawContactId) ? rawContactId[0] : rawContactId;
        const contact = await service.deleteContact({
          tenantId: tenantContext.tenantId,
          contactId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ contact }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createOrganization: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const organization = await service.createOrganization({
          tenantId: tenantContext.tenantId,
          name: req.body.name,
          domain: req.body.domain,
          industry: req.body.industry,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ organization }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listOrganizations: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listOrganizations({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined
        });

        res
          .status(HTTP_STATUS.OK)
          .json(
            buildPaginatedSuccess(
              { items: result.items },
              {
                page: result.page,
                limit: result.limit,
                total: result.total
              },
              getTraceId(res)
            )
          );
      } catch (error) {
        next(error);
      }
    },

    getOrganization: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOrganizationId = req.params.organizationId;
        const organizationId = Array.isArray(rawOrganizationId)
          ? rawOrganizationId[0]
          : rawOrganizationId;
        const organization = await service.getOrganization({
          tenantId: tenantContext.tenantId,
          organizationId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ organization }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateOrganization: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOrganizationId = req.params.organizationId;
        const organizationId = Array.isArray(rawOrganizationId)
          ? rawOrganizationId[0]
          : rawOrganizationId;
        const organization = await service.updateOrganization({
          tenantId: tenantContext.tenantId,
          organizationId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ organization }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteOrganization: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOrganizationId = req.params.organizationId;
        const organizationId = Array.isArray(rawOrganizationId)
          ? rawOrganizationId[0]
          : rawOrganizationId;
        const organization = await service.deleteOrganization({
          tenantId: tenantContext.tenantId,
          organizationId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ organization }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createOpportunity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const opportunity = await service.createOpportunity({
          tenantId: tenantContext.tenantId,
          title: req.body.title,
          description: req.body.description,
          amount: req.body.amount,
          currency: req.body.currency,
          contactId: req.body.contactId,
          organizationId: req.body.organizationId,
          expectedCloseDate: req.body.expectedCloseDate,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ opportunity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listOpportunities: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listOpportunities({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined,
          stage:
            typeof query.stage === 'string' ? (query.stage as CrmOpportunityStage) : undefined,
          contactId: typeof query.contactId === 'string' ? query.contactId : undefined,
          organizationId: typeof query.organizationId === 'string' ? query.organizationId : undefined
        });

        res
          .status(HTTP_STATUS.OK)
          .json(
            buildPaginatedSuccess(
              { items: result.items },
              {
                page: result.page,
                limit: result.limit,
                total: result.total
              },
              getTraceId(res)
            )
          );
      } catch (error) {
        next(error);
      }
    },

    getOpportunity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOpportunityId = req.params.opportunityId;
        const opportunityId = Array.isArray(rawOpportunityId)
          ? rawOpportunityId[0]
          : rawOpportunityId;
        const opportunity = await service.getOpportunity({
          tenantId: tenantContext.tenantId,
          opportunityId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ opportunity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateOpportunity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOpportunityId = req.params.opportunityId;
        const opportunityId = Array.isArray(rawOpportunityId)
          ? rawOpportunityId[0]
          : rawOpportunityId;
        const opportunity = await service.updateOpportunity({
          tenantId: tenantContext.tenantId,
          opportunityId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ opportunity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteOpportunity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOpportunityId = req.params.opportunityId;
        const opportunityId = Array.isArray(rawOpportunityId)
          ? rawOpportunityId[0]
          : rawOpportunityId;
        const opportunity = await service.deleteOpportunity({
          tenantId: tenantContext.tenantId,
          opportunityId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ opportunity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    changeOpportunityStage: async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawOpportunityId = req.params.opportunityId;
        const opportunityId = Array.isArray(rawOpportunityId)
          ? rawOpportunityId[0]
          : rawOpportunityId;
        const opportunity = await service.changeOpportunityStage({
          tenantId: tenantContext.tenantId,
          opportunityId,
          stage: req.body.stage,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ opportunity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createActivity: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const activity = await service.createActivity({
          tenantId: tenantContext.tenantId,
          type: req.body.type,
          note: req.body.note,
          contactId: req.body.contactId,
          organizationId: req.body.organizationId,
          opportunityId: req.body.opportunityId,
          occurredAt: req.body.occurredAt,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ activity }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listActivities: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listActivities({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined,
          contactId: typeof query.contactId === 'string' ? query.contactId : undefined,
          organizationId: typeof query.organizationId === 'string' ? query.organizationId : undefined,
          opportunityId: typeof query.opportunityId === 'string' ? query.opportunityId : undefined
        });

        res
          .status(HTTP_STATUS.OK)
          .json(
            buildPaginatedSuccess(
              { items: result.items },
              {
                page: result.page,
                limit: result.limit,
                total: result.total
              },
              getTraceId(res)
            )
          );
      } catch (error) {
        next(error);
      }
    },

    getCounters: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const counters = await service.getCounters({
          tenantId: tenantContext.tenantId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ counters }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
