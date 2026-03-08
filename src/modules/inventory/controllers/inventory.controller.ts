import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import { type InventoryServiceContract } from '@/modules/inventory/types/inventory.types';

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
    }
  };
}
