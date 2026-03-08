import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { CRM_OPPORTUNITY_STAGES } from '@/modules/crm/types/crm.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const crmOpportunitySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null
    },
    stage: {
      type: String,
      enum: [...CRM_OPPORTUNITY_STAGES],
      default: 'lead',
      index: true
    },
    amount: {
      type: Number,
      default: null,
      min: 0
    },
    currency: {
      type: String,
      default: null
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'CrmContact',
      default: null
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'CrmOrganization',
      default: null
    },
    expectedCloseDate: {
      type: Date,
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
    collection: 'crm_opportunities'
  }
);

crmOpportunitySchema.index({
  tenantId: 1,
  stage: 1,
  isActive: 1
});
crmOpportunitySchema.index({
  tenantId: 1,
  contactId: 1,
  isActive: 1
});
crmOpportunitySchema.index({
  tenantId: 1,
  organizationId: 1,
  isActive: 1
});

crmOpportunitySchema.plugin(baseDocumentPlugin);

export type CrmOpportunityDocument = HydratedDocument<InferSchemaType<typeof crmOpportunitySchema>>;

export const CrmOpportunityModel = model<CrmOpportunityDocument>(
  'CrmOpportunity',
  crmOpportunitySchema
);
