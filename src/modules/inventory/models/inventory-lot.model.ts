import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryLotSchema = new Schema(
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryWarehouse',
      required: true,
      index: true
    },
    lotCode: {
      type: String,
      required: true,
      trim: true
    },
    receivedAt: {
      type: Date,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    currentQuantity: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true
    }
  },
  {
    collection: 'inventory_lots'
  }
);

inventoryLotSchema.index({
  tenantId: 1,
  itemId: 1,
  warehouseId: 1,
  isActive: 1
});
inventoryLotSchema.index(
  {
    tenantId: 1,
    itemId: 1,
    warehouseId: 1,
    lotCode: 1
  },
  {
    unique: true
  }
);

inventoryLotSchema.plugin(baseDocumentPlugin);

export type InventoryLotDocument = HydratedDocument<InferSchemaType<typeof inventoryLotSchema>>;

export const InventoryLotModel = model<InventoryLotDocument>('InventoryLot', inventoryLotSchema);

