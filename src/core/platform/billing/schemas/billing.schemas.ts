import { z } from 'zod';

import { BILLING_PROVIDER, BILLING_WEBHOOK_EVENT_TYPES } from '@/constants/billing';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

export const createCheckoutSessionSchema = z.object({
  planId: z.string().trim().min(1),
  provider: z.enum([BILLING_PROVIDER.SIMULATED, BILLING_PROVIDER.STRIPE]).default(BILLING_PROVIDER.SIMULATED)
});

export const providerBillingWebhookSchema = z
  .object({
    id: z.string().trim().min(1),
    provider: z.enum([BILLING_PROVIDER.SIMULATED, BILLING_PROVIDER.STRIPE]).default(BILLING_PROVIDER.SIMULATED),
    type: z.enum(BILLING_WEBHOOK_EVENT_TYPES),
    createdAt: z.string().datetime().optional(),
    data: z.object({
      tenantId: objectIdSchema,
      planId: z.string().trim().min(1).nullable().optional(),
      checkoutSessionId: objectIdSchema.optional(),
      providerSessionId: z.string().trim().min(1).optional(),
      reason: z.string().trim().min(1).optional()
    })
  })
  .refine(
    (payload) => Boolean(payload.data.checkoutSessionId || payload.data.providerSessionId),
    {
      message: 'Either checkoutSessionId or providerSessionId is required',
      path: ['data', 'checkoutSessionId']
    }
  );