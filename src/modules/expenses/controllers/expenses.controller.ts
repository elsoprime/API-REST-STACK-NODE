import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import {
  type ExpenseRequestStatus,
  type ExpenseServiceContract
} from '@/modules/expenses/types/expenses.types';

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

function getActorUserId(res: Response): string | null {
  const context = getExecutionContext(res);
  if (context.actor.kind !== 'user') {
    return null;
  }

  return context.actor.userId;
}

function requireActorUserId(res: Response): string {
  const actorUserId = getActorUserId(res);
  if (!actorUserId) {
    throw new AppError({
      code: ERROR_CODES.AUTH_UNAUTHENTICATED,
      message: 'Authenticated user required for expense operation',
      statusCode: HTTP_STATUS.UNAUTHORIZED
    });
  }

  return actorUserId;
}

export function createExpensesController(service: ExpenseServiceContract) {
  return {
    createRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const requesterUserId = getActorUserId(res);

        if (!requesterUserId) {
          throw new AppError({
            code: ERROR_CODES.AUTH_UNAUTHENTICATED,
            message: 'Authenticated user required for expense request creation',
            statusCode: HTTP_STATUS.UNAUTHORIZED
          });
        }

        const request = await service.createRequest({
          tenantId: tenantContext.tenantId,
          requesterUserId,
          title: req.body.title,
          description: req.body.description,
          categoryKey: req.body.categoryKey,
          amount: req.body.amount,
          currency: req.body.currency,
          expenseDate: req.body.expenseDate,
          metadata: req.body.metadata,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listRequests: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listRequests({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          status: typeof query.status === 'string' ? (query.status as ExpenseRequestStatus) : undefined,
          categoryKey: typeof query.categoryKey === 'string' ? query.categoryKey : undefined,
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

    getRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.getRequest({
          tenantId: tenantContext.tenantId,
          requestId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.updateRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          patch: req.body,
          actorUserId: requireActorUserId(res),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listQueue: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listQueue({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit)
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
        const counters = await service.getCounters(tenantContext.tenantId);

        res.status(HTTP_STATUS.OK).json(buildSuccess({ counters }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createCategory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const category = await service.createCategory({
          tenantId: tenantContext.tenantId,
          key: req.body.key,
          name: req.body.name,
          requiresAttachment: req.body.requiresAttachment,
          monthlyLimit: req.body.monthlyLimit,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ category }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listCategories: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | boolean | undefined>;
        const result = await service.listCategories({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined,
          includeInactive: Boolean(query.includeInactive)
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

    updateCategory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawCategoryId = req.params.categoryId;
        const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
        const category = await service.updateCategory({
          tenantId: tenantContext.tenantId,
          categoryId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ category }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    getSettings: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const settings = await service.getSettings(tenantContext.tenantId);

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateSettings: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const settings = await service.updateSettings({
          tenantId: tenantContext.tenantId,
          allowedCurrencies: req.body.allowedCurrencies,
          maxAmountWithoutReview: req.body.maxAmountWithoutReview,
          approvalMode: req.body.approvalMode,
          bulkMaxItemsPerOperation: req.body.bulkMaxItemsPerOperation,
          exportsEnabled: req.body.exportsEnabled,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    submitRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.submitRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          actorUserId: requireActorUserId(res),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    reviewRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.reviewRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          comment: req.body.comment,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    approveRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.approveRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    rejectRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.rejectRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          reasonCode: req.body.reasonCode,
          comment: req.body.comment,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    cancelRequest: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.cancelRequest({
          tenantId: tenantContext.tenantId,
          requestId,
          actorUserId: requireActorUserId(res),
          reason: req.body.reason,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    markRequestAsPaid: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const request = await service.markRequestAsPaid({
          tenantId: tenantContext.tenantId,
          requestId,
          paymentReference: req.body.paymentReference,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ request }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createUploadPresign: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const upload = await service.createUploadPresign({
          tenantId: tenantContext.tenantId,
          requestId: req.body.requestId,
          originalFilename: req.body.originalFilename,
          mimeType: req.body.mimeType,
          sizeBytes: req.body.sizeBytes,
          actorUserId: requireActorUserId(res),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ upload }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createAttachment: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const attachment = await service.createAttachment({
          tenantId: tenantContext.tenantId,
          requestId,
          storageProvider: req.body.storageProvider,
          objectKey: req.body.objectKey,
          originalFilename: req.body.originalFilename,
          mimeType: req.body.mimeType,
          sizeBytes: req.body.sizeBytes,
          checksumSha256: req.body.checksumSha256,
          actorUserId: requireActorUserId(res),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ attachment }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listAttachments: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const attachments = await service.listAttachments({
          tenantId: tenantContext.tenantId,
          requestId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ items: attachments }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteAttachment: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawRequestId = req.params.requestId;
        const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
        const rawAttachmentId = req.params.attachmentId;
        const attachmentId = Array.isArray(rawAttachmentId) ? rawAttachmentId[0] : rawAttachmentId;
        const attachment = await service.deleteAttachment({
          tenantId: tenantContext.tenantId,
          requestId,
          attachmentId,
          actorUserId: requireActorUserId(res),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ attachment }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    bulkApproveRequests: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.bulkApproveRequests({
          tenantId: tenantContext.tenantId,
          requestIds: req.body.requestIds,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    bulkRejectRequests: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.bulkRejectRequests({
          tenantId: tenantContext.tenantId,
          requestIds: req.body.requestIds,
          reasonCode: req.body.reasonCode,
          comment: req.body.comment,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    bulkMarkRequestsAsPaid: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.bulkMarkRequestsAsPaid({
          tenantId: tenantContext.tenantId,
          requestIds: req.body.requestIds,
          paymentReference: req.body.paymentReference,
          actorUserId: getActorUserId(res) ?? undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    bulkExportRequests: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rows = await service.bulkExportRequests({
          tenantId: tenantContext.tenantId,
          requestIds: req.body.requestIds
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ rows }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    getSummary: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const summary = await service.getSummary(tenantContext.tenantId);

        res.status(HTTP_STATUS.OK).json(buildSuccess({ summary }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    exportRequestsCsv: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const exportResult = await service.exportRequestsCsv(tenantContext.tenantId);
        res
          .status(HTTP_STATUS.OK)
          .type(exportResult.contentType)
          .setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
          .send(exportResult.csv);
      } catch (error) {
        next(error);
      }
    }
  };
}
