import { Router, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { createInventoryController } from '@/modules/inventory/controllers/inventory.controller';
import {
  createInventoryCategorySchema,
  createInventoryItemSchema,
  createInventoryStockMovementSchema,
  getInventoryCategoryParamsSchema,
  getInventoryItemParamsSchema,
  listInventoryCategoriesQuerySchema,
  listInventoryItemsQuerySchema,
  listInventoryStockMovementsQuerySchema,
  listInventoryLowStockAlertsQuerySchema,
  updateInventoryCategorySchema,
  updateInventoryItemSchema
} from '@/modules/inventory/schemas/inventory.schemas';
import { inventoryService } from '@/modules/inventory/services/inventory.service';
import { type InventoryServiceContract } from '@/modules/inventory/types/inventory.types';
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

const validateInventoryItemParams: RequestHandler = (req, _res, next) => {
  const parsed = getInventoryItemParamsSchema.safeParse(req.params);

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

const validateInventoryCategoryParams: RequestHandler = (req, _res, next) => {
  const parsed = getInventoryCategoryParamsSchema.safeParse(req.params);

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

export function createInventoryRouter(service: InventoryServiceContract = inventoryService): Router {
  const router = Router();
  const controller = createInventoryController(service);

  router.use(authenticateMiddleware, resolveTenantContextMiddleware);
  router.use(requirePermission('tenant:modules:inventory:use'));

  router.post(
    '/categories',
    requireCsrfForCookieAuth(),
    validateBody(createInventoryCategorySchema),
    controller.createCategory
  );
  router.get(
    '/categories',
    validateQuery(listInventoryCategoriesQuerySchema),
    controller.listCategories
  );
  router.patch(
    '/categories/:categoryId',
    requireCsrfForCookieAuth(),
    validateInventoryCategoryParams,
    validateBody(updateInventoryCategorySchema),
    controller.updateCategory
  );
  router.delete(
    '/categories/:categoryId',
    requireCsrfForCookieAuth(),
    validateInventoryCategoryParams,
    controller.deleteCategory
  );
  router.post(
    '/items',
    requireCsrfForCookieAuth(),
    validateBody(createInventoryItemSchema),
    controller.createItem
  );
  router.get('/items', validateQuery(listInventoryItemsQuerySchema), controller.listItems);
  router.get('/items/:itemId', validateInventoryItemParams, controller.getItem);
  router.patch(
    '/items/:itemId',
    requireCsrfForCookieAuth(),
    validateInventoryItemParams,
    validateBody(updateInventoryItemSchema),
    controller.updateItem
  );
  router.delete(
    '/items/:itemId',
    requireCsrfForCookieAuth(),
    validateInventoryItemParams,
    controller.deleteItem
  );
  router.post(
    '/stock-movements',
    requireCsrfForCookieAuth(),
    validateBody(createInventoryStockMovementSchema),
    controller.createStockMovement
  );
  router.get(
    '/stock-movements',
    validateQuery(listInventoryStockMovementsQuerySchema),
    controller.listStockMovements
  );
  router.get(
    '/alerts/low-stock',
    validateQuery(listInventoryLowStockAlertsQuerySchema),
    controller.listLowStockAlerts
  );

  return router;
}

export const inventoryRouter = createInventoryRouter();
