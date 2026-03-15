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

const INVENTORY_PERMISSIONS = {
  MODULE_USE: 'tenant:modules:inventory:use',
  READ: 'tenant:modules:inventory:read',
  CREATE: 'tenant:modules:inventory:create',
  UPDATE: 'tenant:modules:inventory:update',
  DELETE: 'tenant:modules:inventory:delete',
  STOCK_WRITE: 'tenant:modules:inventory:stock:write'
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
  router.use(requirePermission(INVENTORY_PERMISSIONS.MODULE_USE));

  router.post(
    '/categories',
    requirePermission(INVENTORY_PERMISSIONS.CREATE),
    requireCsrfForCookieAuth(),
    validateBody(createInventoryCategorySchema),
    controller.createCategory
  );
  router.get(
    '/categories',
    requirePermission(INVENTORY_PERMISSIONS.READ),
    validateQuery(listInventoryCategoriesQuerySchema),
    controller.listCategories
  );
  router.patch(
    '/categories/:categoryId',
    requirePermission(INVENTORY_PERMISSIONS.UPDATE),
    requireCsrfForCookieAuth(),
    validateInventoryCategoryParams,
    validateBody(updateInventoryCategorySchema),
    controller.updateCategory
  );
  router.delete(
    '/categories/:categoryId',
    requirePermission(INVENTORY_PERMISSIONS.DELETE),
    requireCsrfForCookieAuth(),
    validateInventoryCategoryParams,
    controller.deleteCategory
  );
  router.post(
    '/items',
    requirePermission(INVENTORY_PERMISSIONS.CREATE),
    requireCsrfForCookieAuth(),
    validateBody(createInventoryItemSchema),
    controller.createItem
  );
  router.get(
    '/items',
    requirePermission(INVENTORY_PERMISSIONS.READ),
    validateQuery(listInventoryItemsQuerySchema),
    controller.listItems
  );
  router.get(
    '/items/:itemId',
    requirePermission(INVENTORY_PERMISSIONS.READ),
    validateInventoryItemParams,
    controller.getItem
  );
  router.patch(
    '/items/:itemId',
    requirePermission(INVENTORY_PERMISSIONS.UPDATE),
    requireCsrfForCookieAuth(),
    validateInventoryItemParams,
    validateBody(updateInventoryItemSchema),
    controller.updateItem
  );
  router.delete(
    '/items/:itemId',
    requirePermission(INVENTORY_PERMISSIONS.DELETE),
    requireCsrfForCookieAuth(),
    validateInventoryItemParams,
    controller.deleteItem
  );
  router.post(
    '/stock-movements',
    requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE),
    requireCsrfForCookieAuth(),
    validateBody(createInventoryStockMovementSchema),
    controller.createStockMovement
  );
  router.get(
    '/stock-movements',
    requirePermission(INVENTORY_PERMISSIONS.READ),
    validateQuery(listInventoryStockMovementsQuerySchema),
    controller.listStockMovements
  );
  router.get(
    '/alerts/low-stock',
    requirePermission(INVENTORY_PERMISSIONS.READ),
    validateQuery(listInventoryLowStockAlertsQuerySchema),
    controller.listLowStockAlerts
  );

  return router;
}

export const inventoryRouter = createInventoryRouter();