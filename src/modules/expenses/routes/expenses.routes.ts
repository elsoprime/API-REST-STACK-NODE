import { Router, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requireModule } from '@/infrastructure/middleware/requireModule.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';
import { requireCsrfToken } from '@/infrastructure/security/csrf';
import { createExpensesController } from '@/modules/expenses/controllers/expenses.controller';
import {
  bulkApproveExpenseRequestsSchema,
  bulkExportExpenseRequestsSchema,
  bulkMarkPaidExpenseRequestsSchema,
  bulkRejectExpenseRequestsSchema,
  createExpenseAttachmentSchema,
  createExpenseCategorySchema,
  createExpenseRequestSchema,
  createExpenseSubcategorySchema,
  createExpenseUploadPresignSchema,
  expenseAttachmentParamsSchema,
  expenseCategoryParamsSchema,
  expenseSubcategoryParamsSchema,
  listExpenseDashboardQuerySchema,
  listExpenseSubcategoriesQuerySchema,
  expenseRequestParamsSchema,
  listExpenseCategoriesQuerySchema,
  listExpenseQueueQuerySchema,
  listExpenseRequestsQuerySchema,
  updateExpenseCategorySchema,
  updateExpenseSubcategorySchema,
  updateExpenseRequestSchema,
  updateExpenseSettingsSchema
} from '@/modules/expenses/schemas/expenses.schemas';
import {
  cancelExpenseRequestSchema,
  expenseWorkflowRequestParamsSchema,
  markPaidExpenseRequestSchema,
  rejectExpenseRequestSchema,
  reviewExpenseRequestSchema
} from '@/modules/expenses/schemas/expenses-workflow.schemas';
import { expensesService } from '@/modules/expenses/services/expenses.service';
import { type ExpenseServiceContract } from '@/modules/expenses/types/expenses.types';

const EXPENSES_PERMISSIONS = {
  MODULE_USE: 'tenant:modules:expenses:use',
  REQUEST_CREATE: 'tenant:expenses:request:create',
  REQUEST_READ: 'tenant:expenses:request:read',
  REQUEST_UPDATE_OWN: 'tenant:expenses:request:update:own',
  REQUEST_CANCEL_OWN: 'tenant:expenses:request:cancel:own',
  REQUEST_REVIEW: 'tenant:expenses:request:review',
  REQUEST_APPROVE: 'tenant:expenses:request:approve',
  REQUEST_REJECT: 'tenant:expenses:request:reject',
  PAYMENT_MARK_PAID: 'tenant:expenses:payment:mark-paid',
  SETTINGS_READ: 'tenant:expenses:settings:read',
  SETTINGS_UPDATE: 'tenant:expenses:settings:update',
  REPORT_READ: 'tenant:expenses:report:read',
  EXPORT: 'tenant:expenses:export'
} as const;

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

function buildParamValidator<T>(safeParse: (value: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } }): RequestHandler {
  return (req, _res, next) => {
    const parsed = safeParse(req.params);

    if (!parsed.success) {
      next(
        new AppError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Route params validation failed',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: mapZodIssuesToErrorDetails((parsed.error?.issues ?? []) as never)
        })
      );
      return;
    }

    req.params = parsed.data as never;
    next();
  };
}

const validateExpenseRequestParams = buildParamValidator(expenseRequestParamsSchema.safeParse);
const validateExpenseWorkflowRequestParams = buildParamValidator(
  expenseWorkflowRequestParamsSchema.safeParse
);
const validateExpenseAttachmentParams = buildParamValidator(expenseAttachmentParamsSchema.safeParse);
const validateExpenseCategoryParams = buildParamValidator(expenseCategoryParamsSchema.safeParse);
const validateExpenseSubcategoryParams = buildParamValidator(
  expenseSubcategoryParamsSchema.safeParse
);

export function createExpensesRouter(service: ExpenseServiceContract = expensesService): Router {
  const router = Router();
  const controller = createExpensesController(service);

  router.use(authenticateMiddleware, resolveTenantContextMiddleware);
  router.use(requireModule('expenses'));
  router.use(requirePermission(EXPENSES_PERMISSIONS.MODULE_USE));

  router.post(
    '/requests',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_CREATE),
    requireCsrfForCookieAuth(),
    validateBody(createExpenseRequestSchema),
    controller.createRequest
  );
  router.post(
    '/uploads/presign',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_UPDATE_OWN),
    requireCsrfForCookieAuth(),
    validateBody(createExpenseUploadPresignSchema),
    controller.createUploadPresign
  );
  router.get(
    '/requests',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_READ),
    validateQuery(listExpenseRequestsQuerySchema),
    controller.listRequests
  );
  router.post(
    '/requests/bulk/approve',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_APPROVE),
    requireCsrfForCookieAuth(),
    validateBody(bulkApproveExpenseRequestsSchema),
    controller.bulkApproveRequests
  );
  router.post(
    '/requests/bulk/reject',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_REJECT),
    requireCsrfForCookieAuth(),
    validateBody(bulkRejectExpenseRequestsSchema),
    controller.bulkRejectRequests
  );
  router.post(
    '/requests/bulk/mark-paid',
    requirePermission(EXPENSES_PERMISSIONS.PAYMENT_MARK_PAID),
    requireCsrfForCookieAuth(),
    validateBody(bulkMarkPaidExpenseRequestsSchema),
    controller.bulkMarkRequestsAsPaid
  );
  router.post(
    '/requests/bulk/export',
    requirePermission(EXPENSES_PERMISSIONS.EXPORT),
    validateBody(bulkExportExpenseRequestsSchema),
    controller.bulkExportRequests
  );
  router.get(
    '/requests/:requestId',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_READ),
    validateExpenseRequestParams,
    controller.getRequest
  );
  router.patch(
    '/requests/:requestId',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_UPDATE_OWN),
    requireCsrfForCookieAuth(),
    validateExpenseRequestParams,
    validateBody(updateExpenseRequestSchema),
    controller.updateRequest
  );
  router.post(
    '/requests/:requestId/submit',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_UPDATE_OWN),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    controller.submitRequest
  );
  router.post(
    '/requests/:requestId/review',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_REVIEW),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    validateBody(reviewExpenseRequestSchema),
    controller.reviewRequest
  );
  router.post(
    '/requests/:requestId/approve',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_APPROVE),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    controller.approveRequest
  );
  router.post(
    '/requests/:requestId/reject',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_REJECT),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    validateBody(rejectExpenseRequestSchema),
    controller.rejectRequest
  );
  router.post(
    '/requests/:requestId/cancel',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_CANCEL_OWN),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    validateBody(cancelExpenseRequestSchema),
    controller.cancelRequest
  );
  router.post(
    '/requests/:requestId/mark-paid',
    requirePermission(EXPENSES_PERMISSIONS.PAYMENT_MARK_PAID),
    requireCsrfForCookieAuth(),
    validateExpenseWorkflowRequestParams,
    validateBody(markPaidExpenseRequestSchema),
    controller.markRequestAsPaid
  );
  router.post(
    '/requests/:requestId/attachments',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_UPDATE_OWN),
    requireCsrfForCookieAuth(),
    validateExpenseRequestParams,
    validateBody(createExpenseAttachmentSchema),
    controller.createAttachment
  );
  router.get(
    '/requests/:requestId/attachments',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_READ),
    validateExpenseRequestParams,
    controller.listAttachments
  );
  router.delete(
    '/requests/:requestId/attachments/:attachmentId',
    requirePermission(EXPENSES_PERMISSIONS.REQUEST_UPDATE_OWN),
    requireCsrfForCookieAuth(),
    validateExpenseAttachmentParams,
    controller.deleteAttachment
  );

  router.get(
    '/queue',
    requirePermission(EXPENSES_PERMISSIONS.REPORT_READ),
    validateQuery(listExpenseQueueQuerySchema),
    controller.listQueue
  );
  router.get(
    '/counters',
    requirePermission(EXPENSES_PERMISSIONS.REPORT_READ),
    controller.getCounters
  );
  router.get(
    '/reports/dashboard',
    requirePermission(EXPENSES_PERMISSIONS.REPORT_READ),
    validateQuery(listExpenseDashboardQuerySchema),
    controller.getDashboard
  );
  router.get('/reports/summary', requirePermission(EXPENSES_PERMISSIONS.REPORT_READ), controller.getSummary);
  router.get(
    '/exports/requests.csv',
    requirePermission(EXPENSES_PERMISSIONS.EXPORT),
    controller.exportRequestsCsv
  );
  router.post(
    '/categories',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_UPDATE),
    requireCsrfForCookieAuth(),
    validateBody(createExpenseCategorySchema),
    controller.createCategory
  );
  router.get(
    '/categories',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_READ),
    validateQuery(listExpenseCategoriesQuerySchema),
    controller.listCategories
  );
  router.patch(
    '/categories/:categoryId',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_UPDATE),
    requireCsrfForCookieAuth(),
    validateExpenseCategoryParams,
    validateBody(updateExpenseCategorySchema),
    controller.updateCategory
  );
  router.post(
    '/subcategories',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_UPDATE),
    requireCsrfForCookieAuth(),
    validateBody(createExpenseSubcategorySchema),
    controller.createSubcategory
  );
  router.get(
    '/subcategories',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_READ),
    validateQuery(listExpenseSubcategoriesQuerySchema),
    controller.listSubcategories
  );
  router.patch(
    '/subcategories/:subcategoryId',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_UPDATE),
    requireCsrfForCookieAuth(),
    validateExpenseSubcategoryParams,
    validateBody(updateExpenseSubcategorySchema),
    controller.updateSubcategory
  );

  router.get('/settings', requirePermission(EXPENSES_PERMISSIONS.SETTINGS_READ), controller.getSettings);
  router.put(
    '/settings',
    requirePermission(EXPENSES_PERMISSIONS.SETTINGS_UPDATE),
    requireCsrfForCookieAuth(),
    validateBody(updateExpenseSettingsSchema),
    controller.updateSettings
  );

  return router;
}

export const expensesRouter = createExpensesRouter();
