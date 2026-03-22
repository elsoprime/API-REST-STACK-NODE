import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryWarehouseSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: 'inventory_warehouses'
  }
);

inventoryWarehouseSchema.index(
  {
    tenantId: 1,
    normalizedName: 1
  },
  {
    unique: true
  }
);

inventoryWarehouseSchema.plugin(baseDocumentPlugin);

export type InventoryWarehouseDocument = HydratedDocument<
  InferSchemaType<typeof inventoryWarehouseSchema>
>;

export const InventoryWarehouseModel = model<InventoryWarehouseDocument>(
  'InventoryWarehouse',
  inventoryWarehouseSchema
);
