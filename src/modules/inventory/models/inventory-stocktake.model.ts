import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';
import { INVENTORY_STOCKTAKE_STATUSES } from '@/modules/inventory/types/inventory.types';

const inventoryStocktakeLineSchema = new Schema(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true
    },
    countedStock: {
      type: Number,
      required: true,
      min: 0
    },
    lotId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryLot',
      default: null
    }
  },
  {
    _id: false
  }
);

const inventoryStocktakeSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryWarehouse',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: [...INVENTORY_STOCKTAKE_STATUSES],
      required: true,
      default: 'draft'
    },
    lines: {
      type: [inventoryStocktakeLineSchema],
      default: []
    }
  },
  {
    collection: 'inventory_stocktakes'
  }
);

inventoryStocktakeSchema.index({
  tenantId: 1,
  warehouseId: 1,
  status: 1,
  createdAt: -1
});

inventoryStocktakeSchema.plugin(baseDocumentPlugin);

export type InventoryStocktakeDocument = HydratedDocument<
  InferSchemaType<typeof inventoryStocktakeSchema>
>;

export const InventoryStocktakeModel = model<InventoryStocktakeDocument>(
  'InventoryStocktake',
  inventoryStocktakeSchema
);
