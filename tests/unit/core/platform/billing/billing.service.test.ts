import { createHmac } from 'node:crypto';

import { BillingService } from '@/core/platform/billing/services/billing.service';
import { BillingEventModel } from '@/core/platform/billing/models/billing-event.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function sortRecordKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecordKeys);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortRecordKeys((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function signPayload(payload: unknown): string {
  const canonicalPayload = JSON.stringify(sortRecordKeys(payload));
  return createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET ?? 'dev-billing-webhook-secret')
    .update(canonicalPayload)
    .digest('hex');
}

describe('billing.service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the billing plan catalog ordered by rank', async () => {
    const service = new BillingService();

    const result = await service.listPlans();

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].rank).toBeLessThanOrEqual(result.items[result.items.length - 1].rank);
  });

  it('rejects checkout creation when the plan cannot be resolved', async () => {
    const service = new BillingService(
      {
        resolvePlan: vi.fn().mockResolvedValue(null)
      } as never,
      {
        record: vi.fn()
      } as never
    );

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: '507f1f77bcf86cd799439011'
    } as never);

    await expect(
      service.createCheckoutSession({
        tenantId: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439010',
        planId: 'plan:unknown',
        provider: 'simulated'
      })
    ).rejects.toThrow('Plan could not be resolved for checkout');
  });

  it('rejects webhook processing when signature is invalid', async () => {
    const service = new BillingService();

    await expect(
      service.processProviderWebhook({
        signature: 'invalid-signature',
        payload: {
          id: 'evt_test_invalid',
          provider: 'simulated',
          type: 'billing.checkout.paid',
          data: {
            tenantId: '507f1f77bcf86cd799439011',
            planId: 'plan:growth',
            providerSessionId: 'chk_invalid'
          }
        }
      })
    ).rejects.toThrow('Billing webhook signature is invalid');
  });

  it('returns duplicate status when webhook event id was already processed', async () => {
    const service = new BillingService();
    const payload = {
      id: 'evt_duplicate_1',
      provider: 'simulated' as const,
      type: 'billing.checkout.paid' as const,
      data: {
        tenantId: '507f1f77bcf86cd799439011',
        planId: 'plan:growth',
        providerSessionId: 'chk_duplicate'
      }
    };

    vi.spyOn(BillingEventModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        checkoutSessionId: {
          toString: () => '507f1f77bcf86cd799439091'
        },
        tenantId: {
          toString: () => '507f1f77bcf86cd799439011'
        }
      })
    } as never);

    const result = await service.processProviderWebhook({
      signature: signPayload(payload),
      payload
    });

    expect(result.status).toBe('duplicate');
    expect(result.checkoutSessionId).toBe('507f1f77bcf86cd799439091');
    expect(result.tenantId).toBe('507f1f77bcf86cd799439011');
  });
});

