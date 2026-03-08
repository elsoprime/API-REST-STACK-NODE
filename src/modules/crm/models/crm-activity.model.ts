import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const crmActivitySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    note: {
      type: String,
      required: true,
      trim: true
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
    opportunityId: {
      type: Schema.Types.ObjectId,
      ref: 'CrmOpportunity',
      default: null
    },
    occurredAt: {
      type: Date,
      required: true
    }
  },
  {
    collection: 'crm_activities'
  }
);

crmActivitySchema.index({
  tenantId: 1,
  occurredAt: -1
});
crmActivitySchema.index({
  tenantId: 1,
  contactId: 1,
  occurredAt: -1
});
crmActivitySchema.index({
  tenantId: 1,
  organizationId: 1,
  occurredAt: -1
});
crmActivitySchema.index({
  tenantId: 1,
  opportunityId: 1,
  occurredAt: -1
});

crmActivitySchema.plugin(baseDocumentPlugin);

export type CrmActivityDocument = HydratedDocument<InferSchemaType<typeof crmActivitySchema>>;

export const CrmActivityModel = model<CrmActivityDocument>('CrmActivity', crmActivitySchema);
