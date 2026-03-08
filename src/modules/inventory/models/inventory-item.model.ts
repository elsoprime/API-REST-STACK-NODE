import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryItemSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      required: true,
      index: true
    },
    sku: {
      type: String,
      required: true,
      trim: true
    },
    normalizedSku: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0
    },
    minStock: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: 'inventory_items'
  }
);

inventoryItemSchema.index(
  {
    tenantId: 1,
    normalizedSku: 1
  },
  {
    unique: true
  }
);
inventoryItemSchema.index({
  tenantId: 1,
  categoryId: 1,
  isActive: 1
});

inventoryItemSchema.plugin(baseDocumentPlugin);

export type InventoryItemDocument = HydratedDocument<InferSchemaType<typeof inventoryItemSchema>>;

export const InventoryItemModel = model<InventoryItemDocument>('InventoryItem', inventoryItemSchema);
