import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { RBAC_ROLE_SCOPE_VALUES } from '@/core/platform/rbac/types/rbac.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const roleSchema = new Schema(
  {
    key: {
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
      required: true,
      trim: true
    },
    scope: {
      type: String,
      enum: RBAC_ROLE_SCOPE_VALUES,
      required: true,
      index: true
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true
    },
    hierarchyLevel: {
      type: Number,
      required: true
    },
    permissions: {
      type: [String],
      default: []
    }
  },
  {
    collection: 'roles'
  }
);

roleSchema.index({ key: 1, scope: 1, tenantId: 1 }, { unique: true });
roleSchema.plugin(baseDocumentPlugin);

export type RoleDocument = HydratedDocument<InferSchemaType<typeof roleSchema>>;

export const RoleModel = model<RoleDocument>('Role', roleSchema);
