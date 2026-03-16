import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

export const INVENTORY_LOT_ALLOCATION_POLICIES = ['FIFO', 'FEFO'] as const;
export const INVENTORY_ROLLOUT_PHASES = ['pilot', 'cohort', 'general'] as const;

const inventorySettingsSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true
    },
    lotAllocationPolicy: {
      type: String,
      enum: INVENTORY_LOT_ALLOCATION_POLICIES,
      required: true,
      default: 'FIFO'
    },
    rolloutPhase: {
      type: String,
      enum: INVENTORY_ROLLOUT_PHASES,
      required: true,
      default: 'pilot'
    },
    capabilities: {
      warehouses: {
        type: Boolean,
        required: true,
        default: true
      },
      lots: {
        type: Boolean,
        required: true,
        default: false
      },
      stocktakes: {
        type: Boolean,
        required: true,
        default: false
      }
    }
  },
  {
    collection: 'inventory_settings'
  }
);

inventorySettingsSchema.plugin(baseDocumentPlugin);

export type InventorySettingsDocument = HydratedDocument<
  InferSchemaType<typeof inventorySettingsSchema>
>;

export const InventorySettingsModel = model<InventorySettingsDocument>(
  'InventorySettings',
  inventorySettingsSchema
);
