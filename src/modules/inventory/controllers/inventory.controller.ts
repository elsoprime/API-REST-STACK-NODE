import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import {
  type InventoryMovementType,
  type InventoryServiceContract,
  type InventoryStocktakeStatus
} from '@/modules/inventory/types/inventory.types';

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

export function createInventoryController(service: InventoryServiceContract) {
  return {
    createCategory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const category = await service.createCategory({
          tenantId: tenantContext.tenantId,
          name: req.body.name,
          description: req.body.description,
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
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listCategories({
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

    deleteCategory: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawCategoryId = req.params.categoryId;
        const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
        const category = await service.deleteCategory({
          tenantId: tenantContext.tenantId,
          categoryId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ category }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createWarehouse: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const warehouse = await service.createWarehouse({
          tenantId: tenantContext.tenantId,
          name: req.body.name,
          description: req.body.description,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ warehouse }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listWarehouses: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listWarehouses({
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

    updateWarehouse: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawWarehouseId = req.params.warehouseId;
        const warehouseId = Array.isArray(rawWarehouseId) ? rawWarehouseId[0] : rawWarehouseId;
        const warehouse = await service.updateWarehouse({
          tenantId: tenantContext.tenantId,
          warehouseId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ warehouse }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createLot: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const lot = await service.createLot({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          warehouseId: req.body.warehouseId,
          lotCode: req.body.lotCode,
          quantity: req.body.quantity,
          receivedAt: req.body.receivedAt,
          expiresAt: req.body.expiresAt,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ lot }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listLots: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listLots({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          itemId: typeof query.itemId === 'string' ? query.itemId : undefined,
          warehouseId: typeof query.warehouseId === 'string' ? query.warehouseId : undefined,
          expiringBefore: typeof query.expiringBefore === 'string' ? query.expiringBefore : undefined
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

    updateLot: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawLotId = req.params.lotId;
        const lotId = Array.isArray(rawLotId) ? rawLotId[0] : rawLotId;

        const lot = await service.updateLot({
          tenantId: tenantContext.tenantId,
          lotId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ lot }, getTraceId(res)));
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
          lotAllocationPolicy: req.body.lotAllocationPolicy,
          rolloutPhase: req.body.rolloutPhase,
          capabilities: req.body.capabilities,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createStocktake: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const stocktake = await service.createStocktake({
          tenantId: tenantContext.tenantId,
          warehouseId: req.body.warehouseId,
          name: req.body.name,
          lines: req.body.lines,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ stocktake }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    upsertStocktakeCounts: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawStocktakeId = req.params.stocktakeId;
        const stocktakeId = Array.isArray(rawStocktakeId) ? rawStocktakeId[0] : rawStocktakeId;
        const stocktake = await service.upsertStocktakeCounts({
          tenantId: tenantContext.tenantId,
          stocktakeId,
          lines: req.body.lines,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ stocktake }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    applyStocktake: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawStocktakeId = req.params.stocktakeId;
        const stocktakeId = Array.isArray(rawStocktakeId) ? rawStocktakeId[0] : rawStocktakeId;
        const stocktake = await service.applyStocktake({
          tenantId: tenantContext.tenantId,
          stocktakeId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ stocktake }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    cancelStocktake: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawStocktakeId = req.params.stocktakeId;
        const stocktakeId = Array.isArray(rawStocktakeId) ? rawStocktakeId[0] : rawStocktakeId;
        const stocktake = await service.cancelStocktake({
          tenantId: tenantContext.tenantId,
          stocktakeId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ stocktake }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listStocktakes: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listStocktakes({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          warehouseId: typeof query.warehouseId === 'string' ? query.warehouseId : undefined,
          status: typeof query.status === 'string' ? (query.status as InventoryStocktakeStatus) : undefined
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

    getStocktake: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawStocktakeId = req.params.stocktakeId;
        const stocktakeId = Array.isArray(rawStocktakeId) ? rawStocktakeId[0] : rawStocktakeId;
        const stocktake = await service.getStocktake({
          tenantId: tenantContext.tenantId,
          stocktakeId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ stocktake }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createMovementEntry: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createMovementCommand({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          movementType: 'entry',
          quantity: req.body.quantity,
          reason: req.body.reason,
          warehouseId: req.body.warehouseId,
          lotCode: req.body.lotCode,
          receivedAt: req.body.receivedAt,
          expiresAt: req.body.expiresAt,
          idempotencyKey: req.body.idempotencyKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createMovementExit: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createMovementCommand({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          movementType: 'exit',
          quantity: req.body.quantity,
          reason: req.body.reason,
          warehouseId: req.body.warehouseId,
          idempotencyKey: req.body.idempotencyKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createMovementAdjust: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createMovementCommand({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          movementType: 'adjust',
          direction: req.body.direction,
          quantity: req.body.quantity,
          reason: req.body.reason,
          warehouseId: req.body.warehouseId,
          lotCode: req.body.lotCode,
          receivedAt: req.body.receivedAt,
          expiresAt: req.body.expiresAt,
          idempotencyKey: req.body.idempotencyKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createMovementTransfer: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createMovementCommand({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          movementType: 'transfer',
          quantity: req.body.quantity,
          reason: req.body.reason,
          sourceWarehouseId: req.body.sourceWarehouseId,
          destinationWarehouseId: req.body.destinationWarehouseId,
          idempotencyKey: req.body.idempotencyKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createMovementReturn: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createMovementCommand({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          movementType: 'return',
          quantity: req.body.quantity,
          reason: req.body.reason,
          warehouseId: req.body.warehouseId,
          lotCode: req.body.lotCode,
          receivedAt: req.body.receivedAt,
          expiresAt: req.body.expiresAt,
          idempotencyKey: req.body.idempotencyKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const item = await service.createItem({
          tenantId: tenantContext.tenantId,
          categoryId: req.body.categoryId,
          sku: req.body.sku,
          name: req.body.name,
          description: req.body.description,
          initialStock: req.body.initialStock,
          minStock: req.body.minStock,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ item }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listItems: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | boolean | undefined>;
        const result = await service.listItems({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          categoryId: typeof query.categoryId === 'string' ? query.categoryId : undefined,
          search: typeof query.search === 'string' ? query.search : undefined,
          lowStockOnly: Boolean(query.lowStockOnly)
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

    getItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawItemId = req.params.itemId;
        const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
        const item = await service.getItem({
          tenantId: tenantContext.tenantId,
          itemId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ item }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawItemId = req.params.itemId;
        const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
        const item = await service.updateItem({
          tenantId: tenantContext.tenantId,
          itemId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ item }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteItem: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawItemId = req.params.itemId;
        const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;
        const item = await service.deleteItem({
          tenantId: tenantContext.tenantId,
          itemId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ item }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createStockMovement: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const movement = await service.createStockMovement({
          tenantId: tenantContext.tenantId,
          itemId: req.body.itemId,
          direction: req.body.direction,
          quantity: req.body.quantity,
          reason: req.body.reason,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ movement }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listStockMovements: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listStockMovements({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          itemId: typeof query.itemId === 'string' ? query.itemId : undefined,
          movementType:
            typeof query.movementType === 'string'
              ? (query.movementType as InventoryMovementType)
              : undefined
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

    listLowStockAlerts: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listLowStockAlerts({
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


    getReconciliation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const report = await service.getReconciliation({
          tenantId: tenantContext.tenantId,
          sinceDays: Number(query.sinceDays)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ report }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listExpiringLotAlerts: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listExpiringLotAlerts({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          withinDays: Number(query.withinDays),
          warehouseId: typeof query.warehouseId === 'string' ? query.warehouseId : undefined,
          itemId: typeof query.itemId === 'string' ? query.itemId : undefined
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
    }
  };
}


