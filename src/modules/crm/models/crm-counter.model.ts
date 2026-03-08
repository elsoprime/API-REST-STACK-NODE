import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const crmCounterSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true
    },
    contactsActive: {
      type: Number,
      default: 0,
      min: 0
    },
    organizationsActive: {
      type: Number,
      default: 0,
      min: 0
    },
    opportunitiesOpen: {
      type: Number,
      default: 0,
      min: 0
    },
    opportunitiesWon: {
      type: Number,
      default: 0,
      min: 0
    },
    opportunitiesLost: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    collection: 'crm_counters'
  }
);

crmCounterSchema.plugin(baseDocumentPlugin);

export type CrmCounterDocument = HydratedDocument<InferSchemaType<typeof crmCounterSchema>>;

export const CrmCounterModel = model<CrmCounterDocument>('CrmCounter', crmCounterSchema);
