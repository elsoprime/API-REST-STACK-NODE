import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { BILLING_CHECKOUT_STATUS, BILLING_PROVIDER } from '@/constants/billing';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const billingCheckoutSessionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    initiatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    planId: {
      type: String,
      required: true,
      trim: true
    },
    provider: {
      type: String,
      enum: Object.values(BILLING_PROVIDER),
      required: true,
      default: BILLING_PROVIDER.SIMULATED
    },
    providerSessionId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(BILLING_CHECKOUT_STATUS),
      default: BILLING_CHECKOUT_STATUS.PENDING,
      index: true
    },
    checkoutUrl: {
      type: String,
      required: true,
      trim: true
    },
    lastError: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    activatedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'billing_checkout_sessions'
  }
);

billingCheckoutSessionSchema.plugin(baseDocumentPlugin);

export type BillingCheckoutSessionDocument = HydratedDocument<
  InferSchemaType<typeof billingCheckoutSessionSchema>
>;

export const BillingCheckoutSessionModel = model<BillingCheckoutSessionDocument>(
  'BillingCheckoutSession',
  billingCheckoutSessionSchema
);
