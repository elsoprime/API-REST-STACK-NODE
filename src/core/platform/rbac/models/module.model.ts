import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const moduleSchema = new Schema(
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
    }
  },
  {
    collection: 'modules'
  }
);

moduleSchema.plugin(baseDocumentPlugin);

export type ModuleDocument = HydratedDocument<InferSchemaType<typeof moduleSchema>>;

export const ModuleModel = model<ModuleDocument>('Module', moduleSchema);
