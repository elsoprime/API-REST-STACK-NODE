import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { INVENTORY_MOVEMENT_DIRECTIONS } from '@/modules/inventory/types/inventory.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryStockMovementSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true
    },
    direction: {
      type: String,
      enum: [...INVENTORY_MOVEMENT_DIRECTIONS],
      required: true
    },
    quantity: {
      type: Number,
      min: 1,
      required: true
    },
    stockBefore: {
      type: Number,
      min: 0,
      required: true
    },
    stockAfter: {
      type: Number,
      min: 0,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    performedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    collection: 'inventory_stock_movements'
  }
);

inventoryStockMovementSchema.index({
  tenantId: 1,
  itemId: 1,
  createdAt: -1
});
inventoryStockMovementSchema.index({
  tenantId: 1,
  createdAt: -1
});

inventoryStockMovementSchema.plugin(baseDocumentPlugin);

export type InventoryStockMovementDocument = HydratedDocument<
  InferSchemaType<typeof inventoryStockMovementSchema>
>;

export const InventoryStockMovementModel = model<InventoryStockMovementDocument>(
  'InventoryStockMovement',
  inventoryStockMovementSchema
);
