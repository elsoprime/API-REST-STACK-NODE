import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const crmOrganizationSchema = new Schema(
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
    domain: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    normalizedDomain: {
      type: String,
      default: null,
      trim: true
    },
    industry: {
      type: String,
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
    collection: 'crm_organizations'
  }
);

crmOrganizationSchema.index(
  {
    tenantId: 1,
    normalizedName: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true
    }
  }
);
crmOrganizationSchema.index({
  tenantId: 1,
  normalizedDomain: 1
});

crmOrganizationSchema.plugin(baseDocumentPlugin);

export type CrmOrganizationDocument = HydratedDocument<InferSchemaType<typeof crmOrganizationSchema>>;

export const CrmOrganizationModel = model<CrmOrganizationDocument>(
  'CrmOrganization',
  crmOrganizationSchema
);
