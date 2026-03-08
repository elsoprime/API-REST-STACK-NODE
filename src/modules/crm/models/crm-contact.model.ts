import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const crmContactSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    normalizedFullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    normalizedEmail: {
      type: String,
      default: null,
      trim: true
    },
    phone: {
      type: String,
      default: null
    },
    normalizedPhone: {
      type: String,
      default: null,
      trim: true
    },
    dedupFallbackKey: {
      type: String,
      default: null,
      trim: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'CrmOrganization',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'crm_contacts'
  }
);

crmContactSchema.index(
  {
    tenantId: 1,
    normalizedEmail: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      normalizedEmail: {
        $type: 'string'
      }
    }
  }
);
crmContactSchema.index(
  {
    tenantId: 1,
    dedupFallbackKey: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      dedupFallbackKey: {
        $type: 'string'
      }
    }
  }
);

crmContactSchema.plugin(baseDocumentPlugin);

export type CrmContactDocument = HydratedDocument<InferSchemaType<typeof crmContactSchema>>;

export const CrmContactModel = model<CrmContactDocument>('CrmContact', crmContactSchema);
