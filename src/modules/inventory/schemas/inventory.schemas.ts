import { z } from 'zod';

import { INVENTORY_MOVEMENT_DIRECTIONS } from '@/modules/inventory/types/inventory.types';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

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

export const getInventoryCategoryParamsSchema = z.object({
  categoryId: objectIdSchema
});

export const getInventoryItemParamsSchema = z.object({
  itemId: objectIdSchema
});

export const createInventoryStockMovementSchema = z.object({
  itemId: objectIdSchema,
  direction: z.enum(INVENTORY_MOVEMENT_DIRECTIONS),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(240)
});

export const listInventoryStockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  itemId: objectIdSchema.optional()
});

export const listInventoryLowStockAlertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
