import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const planSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    rank: {
      type: Number,
      required: true
    },
    allowedModuleKeys: {
      type: [String],
      default: []
    },
    featureFlagKeys: {
      type: [String],
      default: []
    },
    memberLimit: {
      type: Number,
      default: null
    }
  },
  {
    collection: 'plans'
  }
);

planSchema.plugin(baseDocumentPlugin);

export type PlanDocument = HydratedDocument<InferSchemaType<typeof planSchema>>;

export const PlanModel = model<PlanDocument>('Plan', planSchema);
