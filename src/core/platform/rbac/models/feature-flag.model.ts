import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const featureFlagSchema = new Schema(
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
    moduleKey: {
      type: String,
      default: null
    },
    allowAdminBypass: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: 'feature_flags'
  }
);

featureFlagSchema.plugin(baseDocumentPlugin);

export type FeatureFlagDocument = HydratedDocument<InferSchemaType<typeof featureFlagSchema>>;

export const FeatureFlagModel = model<FeatureFlagDocument>('FeatureFlag', featureFlagSchema);
