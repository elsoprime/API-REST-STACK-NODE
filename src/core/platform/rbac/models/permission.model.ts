import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { RBAC_ROLE_SCOPE_VALUES } from '@/core/platform/rbac/types/rbac.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const permissionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    scope: {
      type: String,
      enum: RBAC_ROLE_SCOPE_VALUES,
      required: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    moduleKey: {
      type: String,
      default: null
    }
  },
  {
    collection: 'permissions'
  }
);

permissionSchema.plugin(baseDocumentPlugin);

export type PermissionDocument = HydratedDocument<InferSchemaType<typeof permissionSchema>>;

export const PermissionModel = model<PermissionDocument>('Permission', permissionSchema);
