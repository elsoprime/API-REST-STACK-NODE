import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { TENANT_STATUS, TENANT_SUBSCRIPTION_STATUS } from '@/constants/tenant';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const tenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    status: {
      type: String,
      enum: Object.values(TENANT_STATUS),
      default: TENANT_STATUS.ACTIVE,
      index: true
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(TENANT_SUBSCRIPTION_STATUS),
      default: TENANT_SUBSCRIPTION_STATUS.PENDING,
      index: true
    },
    subscriptionGraceEndsAt: {
      type: Date,
      default: null
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    planId: {
      type: String,
      default: null
    },
    activeModuleKeys: {
      type: [String],
      default: []
    },
    memberLimit: {
      type: Number,
      default: null
    }
  },
  {
    collection: 'tenants'
  }
);

tenantSchema.plugin(baseDocumentPlugin);

export type TenantDocument = HydratedDocument<InferSchemaType<typeof tenantSchema>>;

export const TenantModel = model<TenantDocument>('Tenant', tenantSchema);


