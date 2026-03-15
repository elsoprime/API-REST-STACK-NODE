import { createHmac } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import {
  BILLING_CHECKOUT_STATUS,
  BILLING_EVENT_STATUS,
  BILLING_WEBHOOK_EVENT_TYPE
} from '@/constants/billing';
import { TENANT_SUBSCRIPTION_STATUS } from '@/constants/tenant';
import { BillingCheckoutSessionModel } from '@/core/platform/billing/models/billing-checkout-session.model';
import { BillingEventModel } from '@/core/platform/billing/models/billing-event.model';
import { BillingService } from '@/core/platform/billing/services/billing.service';
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

function serializePayload(payload: unknown): string {
  return JSON.stringify(sortRecordKeys(payload));
}

function signPayload(payload: unknown, timestampSeconds: number, rawPayload?: string): string {
  const payloadToSign = rawPayload ?? serializePayload(payload);
  return createHmac('sha256', process.env.BILLING_WEBHOOK_SECRET ?? 'dev-billing-webhook-secret')
    .update(`${timestampSeconds}.${payloadToSign}`)
    .digest('hex');
}

function currentTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function buildWebhookPayload(overrides?: Partial<{
  id: string;
  provider: 'simulated';
  type: string;
  tenantId: string;
  planId: string | null;
  providerSessionId: string | null;
  checkoutSessionId: string | null;
  reason: string | null;
}>) {
  return {
    id: overrides?.id ?? 'evt_test_1',
    provider: overrides?.provider ?? 'simulated',
    type: (overrides?.type ?? BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_PAID) as
      | 'billing.checkout.paid'
      | 'billing.checkout.failed'
      | 'billing.checkout.canceled',
    data: {
      tenantId: overrides?.tenantId ?? '507f1f77bcf86cd799439011',
      planId: overrides?.planId === undefined ? 'plan:growth' : overrides.planId,
      providerSessionId:
        overrides?.providerSessionId === undefined ? 'chk_test_session' : overrides.providerSessionId,
      checkoutSessionId:
        overrides?.checkoutSessionId === undefined
          ? null
          : overrides.checkoutSessionId,
      reason: overrides?.reason === undefined ? null : overrides.reason
    }
  };
}

function buildWebhookInput(
  payload: ReturnType<typeof buildWebhookPayload>,
  overrides?: Partial<{
    timestamp: string | null;
    signature: string | null;
    rawBody: string | null;
    context: Record<string, unknown>;
  }>
) {
  const timestampSeconds = currentTimestampSeconds();
  const rawBody = overrides?.rawBody === undefined ? serializePayload(payload) : overrides.rawBody;

  return {
    payload,
    rawBody,
    timestamp: overrides?.timestamp === undefined ? String(timestampSeconds) : overrides.timestamp,
    signature:
      overrides?.signature === undefined
        ? signPayload(payload, timestampSeconds, rawBody ?? undefined)
        : overrides.signature,
    context: overrides?.context
  };
}

function createSessionMock() {
  return {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn().mockResolvedValue(undefined)
  };
}

function createSessionBoundDocument<T>(document: T) {
  return {
    session: vi.fn().mockResolvedValue(document)
  };
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

  it('rejects checkout creation when the tenant cannot be resolved', async () => {
    const service = new BillingService(
      {
        resolvePlan: vi.fn().mockResolvedValue({
          key: 'plan:growth'
        })
      } as never,
      {
        record: vi.fn()
      } as never
    );

    vi.spyOn(TenantModel, 'findById').mockResolvedValue(null as never);

    await expect(
      service.createCheckoutSession({
        tenantId: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439010',
        planId: 'plan:growth',
        provider: 'simulated'
      })
    ).rejects.toThrow('Tenant not found');
  });

  it('rejects webhook processing when signature is invalid', async () => {
    const service = new BillingService();

    const payload = {
      id: 'evt_test_invalid',
      provider: 'simulated' as const,
      type: 'billing.checkout.paid' as const,
      data: {
        tenantId: '507f1f77bcf86cd799439011',
        planId: 'plan:growth',
        providerSessionId: 'chk_invalid'
      }
    };
    const timestampSeconds = currentTimestampSeconds();

    await expect(
      service.processProviderWebhook({
        signature: 'invalid-signature',
        timestamp: String(timestampSeconds),
        rawBody: serializePayload(payload),
        payload
      })
    ).rejects.toThrow('Billing webhook signature is invalid');
  });

  it('rejects webhook processing when signature is missing', async () => {
    const service = new BillingService();
    const payload = buildWebhookPayload({
      id: 'evt_test_missing_signature'
    });

    await expect(
      service.processProviderWebhook(
        buildWebhookInput(payload, {
          signature: null
        })
      )
    ).rejects.toThrow('Billing webhook signature is required');
  });

  it('rejects webhook processing when timestamp is missing', async () => {
    const service = new BillingService();

    const payload = {
      id: 'evt_test_missing_timestamp',
      provider: 'simulated' as const,
      type: 'billing.checkout.paid' as const,
      data: {
        tenantId: '507f1f77bcf86cd799439011',
        planId: 'plan:growth',
        providerSessionId: 'chk_missing_timestamp'
      }
    };
    const timestampSeconds = currentTimestampSeconds();

    await expect(
      service.processProviderWebhook({
        signature: signPayload(payload, timestampSeconds),
        timestamp: null,
        rawBody: serializePayload(payload),
        payload
      })
    ).rejects.toThrow('Billing webhook timestamp is required');
  });

  it('rejects webhook processing when timestamp is outside the tolerance window', async () => {
    const service = new BillingService();

    const payload = {
      id: 'evt_test_timestamp_expired',
      provider: 'simulated' as const,
      type: 'billing.checkout.paid' as const,
      data: {
        tenantId: '507f1f77bcf86cd799439011',
        planId: 'plan:growth',
        providerSessionId: 'chk_timestamp_expired'
      }
    };
    const timestampSeconds =
      currentTimestampSeconds() - Number(process.env.BILLING_WEBHOOK_TOLERANCE_SECONDS ?? '300') - 10;

    await expect(
      service.processProviderWebhook({
        signature: signPayload(payload, timestampSeconds),
        timestamp: String(timestampSeconds),
        rawBody: serializePayload(payload),
        payload
      })
    ).rejects.toThrow('Billing webhook timestamp is outside tolerance window');
  });

  it('rejects webhook processing when timestamp is invalid', async () => {
    const service = new BillingService();
    const payload = buildWebhookPayload({
      id: 'evt_test_timestamp_invalid'
    });

    await expect(
      service.processProviderWebhook(
        buildWebhookInput(payload, {
          timestamp: 'not-a-number'
        })
      )
    ).rejects.toThrow('Billing webhook timestamp is invalid');
  });

  it('rejects webhook processing when the event type is not supported', async () => {
    const service = new BillingService();
    const payload = buildWebhookPayload({
      id: 'evt_test_unsupported_type',
      type: 'billing.unknown' as never
    });

    await expect(service.processProviderWebhook(buildWebhookInput(payload))).rejects.toThrow(
      'Billing webhook event type is not supported'
    );
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

    const timestampSeconds = currentTimestampSeconds();
    const result = await service.processProviderWebhook({
      signature: signPayload(payload, timestampSeconds),
      timestamp: String(timestampSeconds),
      rawBody: serializePayload(payload),
      payload
    });

    expect(result.status).toBe('duplicate');
    expect(result.checkoutSessionId).toBe('507f1f77bcf86cd799439091');
    expect(result.tenantId).toBe('507f1f77bcf86cd799439011');
  });

  it('returns duplicate status when idempotency key was already processed', async () => {
    const service = new BillingService();
    const payload = {
      id: 'evt_duplicate_2',
      provider: 'simulated' as const,
      type: 'billing.checkout.paid' as const,
      data: {
        tenantId: '507f1f77bcf86cd799439011',
        planId: 'plan:growth',
        providerSessionId: 'chk_same_session'
      }
    };

    const findOneSpy = vi.spyOn(BillingEventModel, 'findOne');
    findOneSpy
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          checkoutSessionId: {
            toString: () => '507f1f77bcf86cd799439091'
          },
          tenantId: {
            toString: () => '507f1f77bcf86cd799439011'
          }
        })
      } as never);

    const timestampSeconds = currentTimestampSeconds();
    const result = await service.processProviderWebhook({
      signature: signPayload(payload, timestampSeconds),
      timestamp: String(timestampSeconds),
      rawBody: serializePayload(payload),
      payload
    });

    expect(result.status).toBe('duplicate');
    expect(result.checkoutSessionId).toBe('507f1f77bcf86cd799439091');
    expect(result.tenantId).toBe('507f1f77bcf86cd799439011');
  });

  it('returns duplicate status when the create path races on a duplicate idempotency key', async () => {
    const service = new BillingService();
    const payload = buildWebhookPayload({
      id: 'evt_duplicate_race',
      providerSessionId: null,
      checkoutSessionId: null
    });
    const findOneSpy = vi.spyOn(BillingEventModel, 'findOne');

    findOneSpy
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          checkoutSessionId: null,
          tenantId: null
        })
      } as never);

    vi.spyOn(BillingEventModel, 'create').mockRejectedValue({
      code: 11000
    } as never);

    const result = await service.processProviderWebhook(buildWebhookInput(payload));

    expect(result.status).toBe('duplicate');
    expect(result.checkoutSessionId).toBeNull();
    expect(result.tenantId).toBeNull();
  });

  it('ignores paid webhook when the checkout session cannot be resolved', async () => {
    const sessionMock = createSessionMock();
    const service = new BillingService(
      {
        resolvePlan: vi.fn()
      } as never,
      {
        record: vi.fn().mockResolvedValue(undefined)
      } as never
    );
    const payload = buildWebhookPayload({
      id: 'evt_paid_missing_checkout'
    });
    const billingEventSave = vi.fn().mockResolvedValue(undefined);
    const billingEventDocument = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439071'),
      status: BILLING_EVENT_STATUS.RECEIVED,
      reason: null,
      processedAt: null,
      save: billingEventSave
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(BillingEventModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);
    vi.spyOn(BillingEventModel, 'create').mockResolvedValue({
      _id: billingEventDocument._id
    } as never);
    vi.spyOn(BillingEventModel, 'findById').mockReturnValue(createSessionBoundDocument(billingEventDocument) as never);
    vi.spyOn(BillingCheckoutSessionModel, 'findOne').mockReturnValue(createSessionBoundDocument(null) as never);

    const result = await service.processProviderWebhook(buildWebhookInput(payload));

    expect(result.status).toBe('ignored');
    expect(billingEventDocument.status).toBe(BILLING_EVENT_STATUS.IGNORED);
    expect(billingEventDocument.reason).toBe('Checkout session could not be resolved for webhook payload');
    expect(billingEventSave).toHaveBeenCalled();
    expect(sessionMock.endSession).toHaveBeenCalled();
  });

  it('marks paid webhook as failed when the plan cannot be resolved during activation', async () => {
    const sessionMock = createSessionMock();
    const authorization = {
      resolvePlan: vi.fn().mockResolvedValue(null)
    };
    const service = new BillingService(
      authorization as never,
      {
        record: vi.fn().mockResolvedValue(undefined)
      } as never
    );
    const payload = buildWebhookPayload({
      id: 'evt_paid_plan_missing'
    });
    const checkoutSessionSave = vi.fn().mockResolvedValue(undefined);
    const billingEventSave = vi.fn().mockResolvedValue(undefined);
    const checkoutSessionId = new Types.ObjectId('507f1f77bcf86cd799439081');
    const tenantObjectId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const checkoutSessionDocument = {
      _id: checkoutSessionId,
      tenantId: tenantObjectId,
      planId: 'plan:legacy',
      status: BILLING_CHECKOUT_STATUS.PENDING,
      lastError: null,
      save: checkoutSessionSave
    };
    const billingEventDocument = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439071'),
      status: BILLING_EVENT_STATUS.RECEIVED,
      reason: null,
      tenantId: null,
      checkoutSessionId: null,
      processedAt: null,
      save: billingEventSave
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(BillingEventModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);
    vi.spyOn(BillingEventModel, 'create').mockResolvedValue({
      _id: billingEventDocument._id
    } as never);
    vi.spyOn(BillingEventModel, 'findById').mockReturnValue(createSessionBoundDocument(billingEventDocument) as never);
    vi.spyOn(BillingCheckoutSessionModel, 'findOne').mockReturnValue(
      createSessionBoundDocument(checkoutSessionDocument) as never
    );
    vi.spyOn(TenantModel, 'findById').mockReturnValue(
      createSessionBoundDocument({
        _id: tenantObjectId
      }) as never
    );

    const result = await service.processProviderWebhook(buildWebhookInput(payload));

    expect(result.status).toBe('ignored');
    expect(authorization.resolvePlan).toHaveBeenCalledWith('plan:growth');
    expect(checkoutSessionDocument.status).toBe(BILLING_CHECKOUT_STATUS.FAILED);
    expect(billingEventDocument.status).toBe(BILLING_EVENT_STATUS.FAILED);
    expect(checkoutSessionDocument.lastError).toContain('Plan could not be resolved during webhook activation');
  });

  it('processes paid webhook and reactivates the tenant subscription', async () => {
    const sessionMock = createSessionMock();
    const authorization = {
      resolvePlan: vi.fn().mockResolvedValue({
        key: 'plan:growth',
        allowedModuleKeys: ['inventory', 'crm', 'hr']
      })
    };
    const audit = {
      record: vi.fn().mockResolvedValue(undefined)
    };
    const service = new BillingService(authorization as never, audit as never);
    const checkoutSessionId = new Types.ObjectId('507f1f77bcf86cd799439081');
    const tenantObjectId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const payload = buildWebhookPayload({
      id: 'evt_paid_processed',
      checkoutSessionId: checkoutSessionId.toString()
    });
    const checkoutSessionDocument = {
      _id: checkoutSessionId,
      tenantId: tenantObjectId,
      planId: 'plan:starter',
      status: BILLING_CHECKOUT_STATUS.PENDING,
      lastError: 'old',
      activatedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };
    const tenantDocument = {
      _id: tenantObjectId,
      planId: 'plan:starter',
      activeModuleKeys: ['inventory'],
      subscriptionStatus: TENANT_SUBSCRIPTION_STATUS.SUSPENDED,
      subscriptionGraceEndsAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const billingEventDocument = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439071'),
      status: BILLING_EVENT_STATUS.RECEIVED,
      reason: 'old',
      tenantId: null,
      checkoutSessionId: null,
      processedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(BillingEventModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);
    vi.spyOn(BillingEventModel, 'create').mockResolvedValue({
      _id: billingEventDocument._id
    } as never);
    vi.spyOn(BillingEventModel, 'findById').mockReturnValue(createSessionBoundDocument(billingEventDocument) as never);
    vi.spyOn(BillingCheckoutSessionModel, 'findById').mockReturnValue(
      createSessionBoundDocument(checkoutSessionDocument) as never
    );
    vi.spyOn(TenantModel, 'findById').mockReturnValue(createSessionBoundDocument(tenantDocument) as never);

    const result = await service.processProviderWebhook(
      buildWebhookInput(payload, {
        context: {
          actor: 'system'
        }
      })
    );

    expect(result.status).toBe('processed');
    expect(result.checkoutSessionId).toBe(checkoutSessionId.toString());
    expect(result.tenantId).toBe(tenantObjectId.toString());
    expect(checkoutSessionDocument.status).toBe(BILLING_CHECKOUT_STATUS.ACTIVATED);
    expect(tenantDocument.subscriptionStatus).toBe(TENANT_SUBSCRIPTION_STATUS.REACTIVATED);
    expect(tenantDocument.activeModuleKeys).toEqual(['inventory', 'crm', 'hr']);
    expect(billingEventDocument.status).toBe(BILLING_EVENT_STATUS.PROCESSED);
    expect(audit.record).toHaveBeenCalled();
  });

  it('processes failed webhook and moves the tenant into grace period', async () => {
    const sessionMock = createSessionMock();
    const audit = {
      record: vi.fn().mockResolvedValue(undefined)
    };
    const service = new BillingService(
      {
        resolvePlan: vi.fn()
      } as never,
      audit as never
    );
    const checkoutSessionId = new Types.ObjectId('507f1f77bcf86cd799439081');
    const tenantObjectId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const payload = buildWebhookPayload({
      id: 'evt_terminal_failed',
      type: BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_FAILED,
      reason: 'card_declined'
    });
    const checkoutSessionDocument = {
      _id: checkoutSessionId,
      tenantId: tenantObjectId,
      status: BILLING_CHECKOUT_STATUS.PENDING,
      lastError: null,
      save: vi.fn().mockResolvedValue(undefined)
    };
    const tenantDocument = {
      _id: tenantObjectId,
      subscriptionStatus: TENANT_SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionGraceEndsAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };
    const billingEventDocument = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439071'),
      status: BILLING_EVENT_STATUS.RECEIVED,
      reason: null,
      tenantId: null,
      checkoutSessionId: null,
      processedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(BillingEventModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);
    vi.spyOn(BillingEventModel, 'create').mockResolvedValue({
      _id: billingEventDocument._id
    } as never);
    vi.spyOn(BillingEventModel, 'findById').mockReturnValue(createSessionBoundDocument(billingEventDocument) as never);
    vi.spyOn(BillingCheckoutSessionModel, 'findOne').mockReturnValue(
      createSessionBoundDocument(checkoutSessionDocument) as never
    );
    vi.spyOn(TenantModel, 'findById').mockReturnValue(createSessionBoundDocument(tenantDocument) as never);

    const result = await service.processProviderWebhook(
      buildWebhookInput(payload, {
        context: {
          actor: 'system'
        }
      })
    );

    expect(result.status).toBe('processed');
    expect(checkoutSessionDocument.status).toBe(BILLING_CHECKOUT_STATUS.FAILED);
    expect(checkoutSessionDocument.lastError).toBe('card_declined');
    expect(tenantDocument.subscriptionStatus).toBe(TENANT_SUBSCRIPTION_STATUS.GRACE);
    expect(tenantDocument.subscriptionGraceEndsAt).toBeInstanceOf(Date);
    expect(audit.record).toHaveBeenCalled();
  });

  it('processes canceled webhook and suspends the tenant subscription', async () => {
    const sessionMock = createSessionMock();
    const audit = {
      record: vi.fn().mockResolvedValue(undefined)
    };
    const service = new BillingService(
      {
        resolvePlan: vi.fn()
      } as never,
      audit as never
    );
    const checkoutSessionId = new Types.ObjectId('507f1f77bcf86cd799439081');
    const tenantObjectId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const payload = buildWebhookPayload({
      id: 'evt_terminal_canceled',
      type: BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_CANCELED,
      reason: null
    });
    const checkoutSessionDocument = {
      _id: checkoutSessionId,
      tenantId: tenantObjectId,
      status: BILLING_CHECKOUT_STATUS.PENDING,
      lastError: 'old',
      save: vi.fn().mockResolvedValue(undefined)
    };
    const tenantDocument = {
      _id: tenantObjectId,
      subscriptionStatus: TENANT_SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionGraceEndsAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined)
    };
    const billingEventDocument = {
      _id: new Types.ObjectId('507f1f77bcf86cd799439071'),
      status: BILLING_EVENT_STATUS.RECEIVED,
      reason: 'old',
      tenantId: null,
      checkoutSessionId: null,
      processedAt: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(BillingEventModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);
    vi.spyOn(BillingEventModel, 'create').mockResolvedValue({
      _id: billingEventDocument._id
    } as never);
    vi.spyOn(BillingEventModel, 'findById').mockReturnValue(createSessionBoundDocument(billingEventDocument) as never);
    vi.spyOn(BillingCheckoutSessionModel, 'findOne').mockReturnValue(
      createSessionBoundDocument(checkoutSessionDocument) as never
    );
    vi.spyOn(TenantModel, 'findById').mockReturnValue(createSessionBoundDocument(tenantDocument) as never);

    const result = await service.processProviderWebhook(
      buildWebhookInput(payload, {
        context: {
          actor: 'system'
        }
      })
    );

    expect(result.status).toBe('processed');
    expect(checkoutSessionDocument.status).toBe(BILLING_CHECKOUT_STATUS.CANCELED);
    expect(checkoutSessionDocument.lastError).toBeNull();
    expect(tenantDocument.subscriptionStatus).toBe(TENANT_SUBSCRIPTION_STATUS.SUSPENDED);
    expect(tenantDocument.subscriptionGraceEndsAt).toBeNull();
    expect(audit.record).toHaveBeenCalled();
  });
});
