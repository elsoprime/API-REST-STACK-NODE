export const BILLING_PROVIDER = {
  SIMULATED: 'simulated',
  STRIPE: 'stripe'
} as const;

export type BillingProvider = (typeof BILLING_PROVIDER)[keyof typeof BILLING_PROVIDER];

export const BILLING_CHECKOUT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  ACTIVATED: 'activated',
  FAILED: 'failed',
  CANCELED: 'canceled'
} as const;

export type BillingCheckoutStatus =
  (typeof BILLING_CHECKOUT_STATUS)[keyof typeof BILLING_CHECKOUT_STATUS];

export const BILLING_EVENT_STATUS = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  IGNORED: 'ignored',
  FAILED: 'failed'
} as const;

export type BillingEventStatus = (typeof BILLING_EVENT_STATUS)[keyof typeof BILLING_EVENT_STATUS];

export const BILLING_WEBHOOK_EVENT_TYPE = {
  CHECKOUT_PAID: 'billing.checkout.paid',
  CHECKOUT_FAILED: 'billing.checkout.failed',
  CHECKOUT_CANCELED: 'billing.checkout.canceled'
} as const;

export type BillingWebhookEventType =
  (typeof BILLING_WEBHOOK_EVENT_TYPE)[keyof typeof BILLING_WEBHOOK_EVENT_TYPE];

export const BILLING_WEBHOOK_EVENT_TYPES = [
  BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_PAID,
  BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_FAILED,
  BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_CANCELED
] as const;
