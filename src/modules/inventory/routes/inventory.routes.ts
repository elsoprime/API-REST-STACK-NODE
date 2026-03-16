import { Router, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';
import { createInventoryController } from '@/modules/inventory/controllers/inventory.controller';
import {
  createInventoryCategorySchema,
  createInventoryItemSchema,
  createInventoryLotSchema,
  createInventoryMovementAdjustSchema,
  createInventoryMovementEntrySchema,
  createInventoryMovementExitSchema,
  createInventoryMovementReturnSchema,
  createInventoryMovementTransferSchema,
  createInventoryStockMovementSchema,
  createInventoryStocktakeSchema,
  createInventoryWarehouseSchema,
  getInventoryCategoryParamsSchema,
  getInventoryItemParamsSchema,
  getInventoryLotParamsSchema,
  getInventoryStocktakeParamsSchema,
  getInventoryWarehouseParamsSchema,
  listInventoryCategoriesQuerySchema,
  listInventoryExpiringLotsQuerySchema,
  listInventoryReconciliationQuerySchema,
  listInventoryItemsQuerySchema,
  listInventoryLotsQuerySchema,
  listInventoryLowStockAlertsQuerySchema,
  listInventoryStockMovementsQuerySchema,
  listInventoryStocktakesQuerySchema,
  listInventoryWarehousesQuerySchema,
  updateInventoryCategorySchema,
  updateInventoryItemSchema,
  updateInventoryLotSchema,
  updateInventorySettingsSchema,
  updateInventoryWarehouseSchema,
  upsertInventoryStocktakeCountsSchema
} from '@/modules/inventory/schemas/inventory.schemas';
import { inventoryService } from '@/modules/inventory/services/inventory.service';
import { type InventoryServiceContract } from '@/modules/inventory/types/inventory.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { requirePermission } from '@/infrastructure/middleware/requirePermission.middleware';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';
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

const validateInventoryWarehouseParams = buildParamValidator(getInventoryWarehouseParamsSchema.safeParse);
const validateInventoryLotParams = buildParamValidator(getInventoryLotParamsSchema.safeParse);
const validateInventoryItemParams = buildParamValidator(getInventoryItemParamsSchema.safeParse);
const validateInventoryCategoryParams = buildParamValidator(getInventoryCategoryParamsSchema.safeParse);
const validateInventoryStocktakeParams = buildParamValidator(getInventoryStocktakeParamsSchema.safeParse);

export function createInventoryRouter(service: InventoryServiceContract = inventoryService): Router {
  const router = Router();
  const controller = createInventoryController(service);

  router.use(authenticateMiddleware, resolveTenantContextMiddleware);
  router.use(requirePermission(INVENTORY_PERMISSIONS.MODULE_USE));

  router.post('/categories', requirePermission(INVENTORY_PERMISSIONS.CREATE), requireCsrfForCookieAuth(), validateBody(createInventoryCategorySchema), controller.createCategory);
  router.get('/categories', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryCategoriesQuerySchema), controller.listCategories);
  router.patch('/categories/:categoryId', requirePermission(INVENTORY_PERMISSIONS.UPDATE), requireCsrfForCookieAuth(), validateInventoryCategoryParams, validateBody(updateInventoryCategorySchema), controller.updateCategory);
  router.delete('/categories/:categoryId', requirePermission(INVENTORY_PERMISSIONS.DELETE), requireCsrfForCookieAuth(), validateInventoryCategoryParams, controller.deleteCategory);

  router.post('/warehouses', requirePermission(INVENTORY_PERMISSIONS.CREATE), requireCsrfForCookieAuth(), validateBody(createInventoryWarehouseSchema), controller.createWarehouse);
  router.get('/warehouses', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryWarehousesQuerySchema), controller.listWarehouses);
  router.patch('/warehouses/:warehouseId', requirePermission(INVENTORY_PERMISSIONS.UPDATE), requireCsrfForCookieAuth(), validateInventoryWarehouseParams, validateBody(updateInventoryWarehouseSchema), controller.updateWarehouse);

  router.get('/settings', requirePermission(INVENTORY_PERMISSIONS.READ), controller.getSettings);
  router.put('/settings', requirePermission(INVENTORY_PERMISSIONS.UPDATE), requireCsrfForCookieAuth(), validateBody(updateInventorySettingsSchema), controller.updateSettings);
  router.get('/reconciliation', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryReconciliationQuerySchema), controller.getReconciliation);

  router.post('/lots', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryLotSchema), controller.createLot);
  router.get('/lots', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryLotsQuerySchema), controller.listLots);
  router.patch('/lots/:lotId', requirePermission(INVENTORY_PERMISSIONS.UPDATE), requireCsrfForCookieAuth(), validateInventoryLotParams, validateBody(updateInventoryLotSchema), controller.updateLot);

  router.post('/stocktakes', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryStocktakeSchema), controller.createStocktake);
  router.get('/stocktakes', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryStocktakesQuerySchema), controller.listStocktakes);
  router.get('/stocktakes/:stocktakeId', requirePermission(INVENTORY_PERMISSIONS.READ), validateInventoryStocktakeParams, controller.getStocktake);
  router.put('/stocktakes/:stocktakeId/counts', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateInventoryStocktakeParams, validateBody(upsertInventoryStocktakeCountsSchema), controller.upsertStocktakeCounts);
  router.post('/stocktakes/:stocktakeId/apply', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateInventoryStocktakeParams, controller.applyStocktake);
  router.post('/stocktakes/:stocktakeId/cancel', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateInventoryStocktakeParams, controller.cancelStocktake);

  router.post('/items', requirePermission(INVENTORY_PERMISSIONS.CREATE), requireCsrfForCookieAuth(), validateBody(createInventoryItemSchema), controller.createItem);
  router.get('/items', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryItemsQuerySchema), controller.listItems);
  router.get('/items/:itemId', requirePermission(INVENTORY_PERMISSIONS.READ), validateInventoryItemParams, controller.getItem);
  router.patch('/items/:itemId', requirePermission(INVENTORY_PERMISSIONS.UPDATE), requireCsrfForCookieAuth(), validateInventoryItemParams, validateBody(updateInventoryItemSchema), controller.updateItem);
  router.delete('/items/:itemId', requirePermission(INVENTORY_PERMISSIONS.DELETE), requireCsrfForCookieAuth(), validateInventoryItemParams, controller.deleteItem);

  router.post('/stock-movements', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryStockMovementSchema), controller.createStockMovement);
  router.post('/movements/entry', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryMovementEntrySchema), controller.createMovementEntry);
  router.post('/movements/exit', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryMovementExitSchema), controller.createMovementExit);
  router.post('/movements/adjust', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryMovementAdjustSchema), controller.createMovementAdjust);
  router.post('/movements/transfer', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryMovementTransferSchema), controller.createMovementTransfer);
  router.post('/movements/return', requirePermission(INVENTORY_PERMISSIONS.STOCK_WRITE), requireCsrfForCookieAuth(), validateBody(createInventoryMovementReturnSchema), controller.createMovementReturn);

  router.get('/stock-movements', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryStockMovementsQuerySchema), controller.listStockMovements);
  router.get('/alerts/low-stock', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryLowStockAlertsQuerySchema), controller.listLowStockAlerts);
  router.get('/alerts/expiring-lots', requirePermission(INVENTORY_PERMISSIONS.READ), validateQuery(listInventoryExpiringLotsQuerySchema), controller.listExpiringLotAlerts);

  return router;
}

export const inventoryRouter = createInventoryRouter();

