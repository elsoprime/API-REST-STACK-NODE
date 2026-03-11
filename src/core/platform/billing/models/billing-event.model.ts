import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { BILLING_EVENT_STATUS, BILLING_PROVIDER, BILLING_WEBHOOK_EVENT_TYPES } from '@/constants/billing';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const billingEventSchema = new Schema(
  {
    providerEventId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    provider: {
      type: String,
      enum: Object.values(BILLING_PROVIDER),
      required: true,
      default: BILLING_PROVIDER.SIMULATED
    },
    type: {
      type: String,
      enum: BILLING_WEBHOOK_EVENT_TYPES,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(BILLING_EVENT_STATUS),
      required: true,
      default: BILLING_EVENT_STATUS.RECEIVED,
      index: true
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
    },
    checkoutSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'BillingCheckoutSession',
      default: null,
      index: true
    },
    reason: {
      type: String,
      default: null
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true
    },
    processedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    collection: 'billing_events'
  }
);

billingEventSchema.plugin(baseDocumentPlugin);

export type BillingEventDocument = HydratedDocument<InferSchemaType<typeof billingEventSchema>>;

export const BillingEventModel = model<BillingEventDocument>('BillingEvent', billingEventSchema);
