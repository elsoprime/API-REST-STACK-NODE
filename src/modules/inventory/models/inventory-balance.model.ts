import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryBalanceSchema = new Schema(
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
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true
    }
  },
  {
    collection: 'inventory_balances'
  }
);

inventoryBalanceSchema.index(
  {
    tenantId: 1,
    itemId: 1,
    warehouseId: 1
  },
  {
    unique: true
  }
);
inventoryBalanceSchema.index({
  tenantId: 1,
  warehouseId: 1,
  isActive: 1
});

inventoryBalanceSchema.plugin(baseDocumentPlugin);

export type InventoryBalanceDocument = HydratedDocument<InferSchemaType<typeof inventoryBalanceSchema>>;

export const InventoryBalanceModel = model<InventoryBalanceDocument>('InventoryBalance', inventoryBalanceSchema);
