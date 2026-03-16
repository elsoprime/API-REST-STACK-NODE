import { z } from 'zod';

import {
  INVENTORY_LOT_ALLOCATION_POLICIES,
  INVENTORY_MOVEMENT_DIRECTIONS,
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_ROLLOUT_PHASES,
  INVENTORY_STOCKTAKE_STATUSES
} from '@/modules/inventory/types/inventory.types';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');
const lotCodeSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/);
const isoDateStringSchema = z.string().datetime({ offset: true });

export const createInventoryCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.union([z.string().trim().min(1).max(500), z.null()]).optional()
});

export const listInventoryCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional()
});

export const updateInventoryCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.union([z.string().trim().min(1).max(500), z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one category field is required'
  });

export const createInventoryWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.union([z.string().trim().min(1).max(500), z.null()]).optional()
});

export const listInventoryWarehousesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional()
});

export const updateInventoryWarehouseSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.union([z.string().trim().min(1).max(500), z.null()]).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one warehouse field is required'
  });

export const createInventoryItemSchema = z.object({
  categoryId: objectIdSchema,
  sku: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  name: z.string().trim().min(1).max(160),
  description: z.union([z.string().trim().min(1).max(500), z.null()]).optional(),
  initialStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0)
});

export const listInventoryItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: objectIdSchema.optional(),
  search: z.string().trim().min(1).max(160).optional(),
  lowStockOnly: z.coerce.boolean().default(false)
});

export const updateInventoryItemSchema = z
  .object({
    categoryId: objectIdSchema.optional(),
    sku: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    name: z.string().trim().min(1).max(160).optional(),
    description: z.union([z.string().trim().min(1).max(500), z.null()]).optional(),
    minStock: z.coerce.number().int().min(0).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one item field is required'
  });

export const getInventoryWarehouseParamsSchema = z.object({
  warehouseId: objectIdSchema
});

export const getInventoryCategoryParamsSchema = z.object({
  categoryId: objectIdSchema
});

export const getInventoryItemParamsSchema = z.object({
  itemId: objectIdSchema
});

export const getInventoryLotParamsSchema = z.object({
  lotId: objectIdSchema
});

export const getInventoryStocktakeParamsSchema = z.object({
  stocktakeId: objectIdSchema
});

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[a-zA-Z0-9._:-]+$/)
  .optional();

export const createInventoryStockMovementSchema = z.object({
  itemId: objectIdSchema,
  direction: z.enum(INVENTORY_MOVEMENT_DIRECTIONS),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240)
});

export const createInventoryMovementEntrySchema = z.object({
  itemId: objectIdSchema,
  warehouseId: objectIdSchema,
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240),
  lotCode: lotCodeSchema.optional(),
  receivedAt: isoDateStringSchema.optional(),
  expiresAt: z.union([isoDateStringSchema, z.null()]).optional(),
  idempotencyKey: idempotencyKeySchema
});

export const createInventoryMovementExitSchema = z.object({
  itemId: objectIdSchema,
  warehouseId: objectIdSchema,
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240),
  idempotencyKey: idempotencyKeySchema
});

export const createInventoryMovementAdjustSchema = z.object({
  itemId: objectIdSchema,
  warehouseId: objectIdSchema,
  direction: z.enum(INVENTORY_MOVEMENT_DIRECTIONS),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240),
  lotCode: lotCodeSchema.optional(),
  receivedAt: isoDateStringSchema.optional(),
  expiresAt: z.union([isoDateStringSchema, z.null()]).optional(),
  idempotencyKey: idempotencyKeySchema
});

export const createInventoryMovementTransferSchema = z
  .object({
    itemId: objectIdSchema,
    sourceWarehouseId: objectIdSchema,
    destinationWarehouseId: objectIdSchema,
    quantity: z.coerce.number().int().min(1),
    reason: z.string().trim().min(1).max(240),
    idempotencyKey: idempotencyKeySchema
  })
  .refine((value) => value.sourceWarehouseId !== value.destinationWarehouseId, {
    message: 'sourceWarehouseId and destinationWarehouseId must be different',
    path: ['destinationWarehouseId']
  });

export const createInventoryMovementReturnSchema = z.object({
  itemId: objectIdSchema,
  warehouseId: objectIdSchema,
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240),
  lotCode: lotCodeSchema.optional(),
  receivedAt: isoDateStringSchema.optional(),
  expiresAt: z.union([isoDateStringSchema, z.null()]).optional(),
  idempotencyKey: idempotencyKeySchema
});

export const createInventoryLotSchema = z.object({
  itemId: objectIdSchema,
  warehouseId: objectIdSchema,
  lotCode: lotCodeSchema,
  quantity: z.coerce.number().int().min(1),
  receivedAt: isoDateStringSchema.optional(),
  expiresAt: z.union([isoDateStringSchema, z.null()]).optional()
});

const stocktakeLineSchema = z.object({
  itemId: objectIdSchema,
  countedStock: z.coerce.number().int().min(0),
  lotId: objectIdSchema.optional()
});

export const createInventoryStocktakeSchema = z.object({
  warehouseId: objectIdSchema,
  name: z.string().trim().min(1).max(140),
  lines: z.array(stocktakeLineSchema).max(1000).optional()
});

export const upsertInventoryStocktakeCountsSchema = z.object({
  lines: z.array(stocktakeLineSchema).min(1).max(1000)
});

export const listInventoryLotsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  itemId: objectIdSchema.optional(),
  warehouseId: objectIdSchema.optional(),
  expiringBefore: isoDateStringSchema.optional()
});

export const listInventoryStocktakesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  warehouseId: objectIdSchema.optional(),
  status: z.enum(INVENTORY_STOCKTAKE_STATUSES).optional()
});

export const updateInventoryLotSchema = z
  .object({
    expiresAt: z.union([isoDateStringSchema, z.null()]).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one lot field is required'
  });

const inventoryCapabilitiesSchema = z.object({
  warehouses: z.boolean().optional(),
  lots: z.boolean().optional(),
  stocktakes: z.boolean().optional()
});

export const updateInventorySettingsSchema = z
  .object({
    lotAllocationPolicy: z.enum(INVENTORY_LOT_ALLOCATION_POLICIES).optional(),
    rolloutPhase: z.enum(INVENTORY_ROLLOUT_PHASES).optional(),
    capabilities: inventoryCapabilitiesSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one settings field is required'
  });

export const listInventoryReconciliationQuerySchema = z.object({
  sinceDays: z.coerce.number().int().min(1).max(30).default(1)
});

export const listInventoryStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  itemId: objectIdSchema.optional(),
  movementType: z.enum(INVENTORY_MOVEMENT_TYPES).optional()
});

export const listInventoryLowStockAlertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const listInventoryExpiringLotsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
  warehouseId: objectIdSchema.optional(),
  itemId: objectIdSchema.optional()
});

