import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const inventoryCategorySchema = new Schema(
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
    collection: 'inventory_categories'
  }
);

inventoryCategorySchema.index(
  {
    tenantId: 1,
    normalizedName: 1
  },
  {
    unique: true
  }
);

inventoryCategorySchema.plugin(baseDocumentPlugin);

export type InventoryCategoryDocument = HydratedDocument<
  InferSchemaType<typeof inventoryCategorySchema>
>;

export const InventoryCategoryModel = model<InventoryCategoryDocument>(
  'InventoryCategory',
  inventoryCategorySchema
);
