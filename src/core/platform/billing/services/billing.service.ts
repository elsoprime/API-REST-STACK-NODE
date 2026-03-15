import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import {
  BILLING_CHECKOUT_STATUS,
  BILLING_EVENT_STATUS,
  BILLING_WEBHOOK_EVENT_TYPE,
  BILLING_WEBHOOK_EVENT_TYPES,
  type BillingProvider
} from '@/constants/billing';
import { HTTP_STATUS } from '@/constants/http';
import { env } from '@/config/env';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import { BillingCheckoutSessionModel } from '@/core/platform/billing/models/billing-checkout-session.model';
import { BillingEventModel } from '@/core/platform/billing/models/billing-event.model';
import {
  type BillingCheckoutSessionView,
  type BillingPlanCatalogResult,
  type BillingServiceContract,
  type BillingWebhookProcessResult,
  type CreateCheckoutSessionInput,
  type ProcessBillingWebhookInput
} from '@/core/platform/billing/types/billing.types';
import { systemRbacCatalog } from '@/core/platform/rbac/catalog/system-rbac.catalog';
import { rbacService, type RbacService } from '@/core/platform/rbac/services/rbac.service';
import { TENANT_SUBSCRIPTION_STATUS } from '@/constants/tenant';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { logger } from '@/infrastructure/logger/logger';

function ensureObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function toIsoDateString(value: Date): string {
  return value.toISOString();
}

function normalizeFrontEndBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildBillingError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function toCheckoutSessionView(session: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  planId: string;
  provider: BillingProvider;
  providerSessionId: string;
  status: (typeof BILLING_CHECKOUT_STATUS)[keyof typeof BILLING_CHECKOUT_STATUS];
  checkoutUrl: string;
  createdAt?: Date;
  expiresAt: Date;
  activatedAt?: Date | null;
}): BillingCheckoutSessionView {
  return {
    id: session.id ?? session._id?.toString() ?? '',
    tenantId: typeof session.tenantId === 'string' ? session.tenantId : session.tenantId.toString(),
    planId: session.planId,
    provider: session.provider,
    providerSessionId: session.providerSessionId,
    status: session.status,
    checkoutUrl: session.checkoutUrl,
    createdAt: toIsoDateString(session.createdAt ?? new Date()),
    expiresAt: toIsoDateString(session.expiresAt),
    activatedAt: session.activatedAt ? toIsoDateString(session.activatedAt) : null
  };
}

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

function buildCanonicalWebhookPayload(payload: ProcessBillingWebhookInput['payload']): string {
  return JSON.stringify(sortRecordKeys(payload));
}

function buildWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function buildWebhookSignedPayload(timestampSeconds: number, payload: string): string {
  return `${timestampSeconds}.${payload}`;
}

function buildWebhookPayloadHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

function buildWebhookIdempotencyKey(payload: ProcessBillingWebhookInput['payload']): string {
  const sessionKey = payload.data.checkoutSessionId ?? payload.data.providerSessionId ?? payload.id;
  return `${payload.provider}:${payload.type}:${payload.data.tenantId}:${sessionKey}`;
}

function resolveActivatedTenantSubscriptionStatus(
  previousStatus: string | null | undefined
): 'active' | 'reactivated' {
  if (
    previousStatus === TENANT_SUBSCRIPTION_STATUS.CANCELED ||
    previousStatus === TENANT_SUBSCRIPTION_STATUS.SUSPENDED ||
    previousStatus === TENANT_SUBSCRIPTION_STATUS.GRACE
  ) {
    return TENANT_SUBSCRIPTION_STATUS.REACTIVATED;
  }

  return TENANT_SUBSCRIPTION_STATUS.ACTIVE;
}

function resolveGracePeriodEnd(): Date {
  return new Date(Date.now() + env.BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

 type SubscriptionTransition = {
  tenantId: string;
  previousStatus: string | null;
  nextStatus: string;
  reason: string;
};

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function isSignatureValid(signature: string, expectedSignature: string): boolean {
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export class BillingService implements BillingServiceContract {
  constructor(
    private readonly authorization: RbacService = rbacService,
    private readonly audit: AuditService = auditService
  ) {}

  async listPlans(): Promise<BillingPlanCatalogResult> {
    const items = systemRbacCatalog
      .listPlans()
      .sort((left, right) => left.rank - right.rank)
      .map((plan) => ({
        key: plan.key,
        name: plan.name,
        description: plan.description,
        rank: plan.rank,
        allowedModuleKeys: [...plan.allowedModuleKeys],
        featureFlagKeys: [...plan.featureFlagKeys],
        memberLimit: plan.memberLimit ?? null
      }));

    return { items };
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<BillingCheckoutSessionView> {
    const [tenant, resolvedPlan] = await Promise.all([
      TenantModel.findById(input.tenantId),
      this.authorization.resolvePlan(input.planId)
    ]);

    if (!tenant) {
      throw buildBillingError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!resolvedPlan) {
      throw buildBillingError(
        ERROR_CODES.RBAC_PLAN_DENIED,
        'Plan could not be resolved for checkout',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const providerSessionId = `chk_${randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const checkoutUrl = `${normalizeFrontEndBaseUrl(env.FRONTEND_URL)}/app/settings/billing?session=${providerSessionId}`;

    const checkoutSession = await BillingCheckoutSessionModel.create({
      tenantId: tenant._id,
      initiatedByUserId: ensureObjectId(input.userId),
      planId: resolvedPlan.key,
      provider: input.provider,
      providerSessionId,
      status: BILLING_CHECKOUT_STATUS.PENDING,
      checkoutUrl,
      lastError: null,
      expiresAt,
      activatedAt: null
    });

    await this.recordAuditLog({
      context: input.context,
      tenant: {
        tenantId: tenant._id.toString()
      },
      action: 'billing.checkout.session.create',
      resource: {
        type: 'billing_checkout_session',
        id: checkoutSession._id.toString()
      },
      severity: 'info',
      metadata: {
        provider: input.provider,
        planId: resolvedPlan.key,
        providerSessionId,
        expiresAt: toIsoDateString(expiresAt)
      }
    });

    return toCheckoutSessionView(checkoutSession.toObject());
  }

  async processProviderWebhook(
    input: ProcessBillingWebhookInput
  ): Promise<BillingWebhookProcessResult> {
    const rawPayload = this.resolveRawWebhookPayload(input);
    const signatureTimestamp = await this.assertWebhookSecurity(input, rawPayload);

    const isSupportedEventType = BILLING_WEBHOOK_EVENT_TYPES.includes(input.payload.type);

    if (!isSupportedEventType) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook event type is not supported');
      throw buildBillingError(
        ERROR_CODES.VALIDATION_ERROR,
        'Billing webhook event type is not supported',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const idempotencyKey = buildWebhookIdempotencyKey(input.payload);
    const payloadHash = buildWebhookPayloadHash(rawPayload);

    const [duplicateByEventId, duplicateByIdempotencyKey] = await Promise.all([
      BillingEventModel.findOne({ providerEventId: input.payload.id }).lean(),
      BillingEventModel.findOne({
        idempotencyKey,
        status: {
          $in: [BILLING_EVENT_STATUS.PROCESSED, BILLING_EVENT_STATUS.IGNORED]
        }
      }).lean()
    ]);

    const duplicate = duplicateByEventId ?? duplicateByIdempotencyKey;

    if (duplicate) {
      return this.buildDuplicateWebhookResult(input, duplicate);
    }

    let billingEventId = '';

    try {
      const createdBillingEvent = await BillingEventModel.create({
        providerEventId: input.payload.id,
        idempotencyKey,
        provider: input.payload.provider,
        type: input.payload.type,
        status: BILLING_EVENT_STATUS.RECEIVED,
        tenantId: Types.ObjectId.isValid(input.payload.data.tenantId)
          ? ensureObjectId(input.payload.data.tenantId)
          : null,
        checkoutSessionId:
          input.payload.data.checkoutSessionId && Types.ObjectId.isValid(input.payload.data.checkoutSessionId)
            ? ensureObjectId(input.payload.data.checkoutSessionId)
            : null,
        reason: null,
        payloadHash,
        payload: input.payload,
        signatureTimestamp,
        processedAt: null
      });
      billingEventId = createdBillingEvent._id.toString();
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        const duplicateByRace = await BillingEventModel.findOne({ idempotencyKey }).lean();

        if (duplicateByRace) {
          return this.buildDuplicateWebhookResult(input, duplicateByRace);
        }
      }

      throw error;
    }

    if (input.payload.type === BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_PAID) {
      return await this.processPaidWebhook(billingEventId, input);
    }

    return await this.processTerminalWebhook(billingEventId, input);
  }

  private resolveRawWebhookPayload(input: ProcessBillingWebhookInput): string {
    if (typeof input.rawBody === 'string' && input.rawBody.length > 0) {
      return input.rawBody;
    }

    return buildCanonicalWebhookPayload(input.payload);
  }

  private async assertWebhookSecurity(
    input: ProcessBillingWebhookInput,
    rawPayload: string
  ): Promise<Date> {
    const signature = input.signature?.trim();

    if (!signature) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook signature is required');
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook signature is required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const rawTimestamp = input.timestamp?.trim();

    if (!rawTimestamp) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook timestamp is required');
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook timestamp is required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const parsedTimestampSeconds = Number.parseInt(rawTimestamp, 10);

    if (!Number.isInteger(parsedTimestampSeconds) || parsedTimestampSeconds <= 0) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook timestamp is invalid');
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook timestamp is invalid',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (Math.abs(nowSeconds - parsedTimestampSeconds) > env.BILLING_WEBHOOK_TOLERANCE_SECONDS) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook timestamp is outside tolerance window');
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook timestamp is outside tolerance window',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const expectedSignature = buildWebhookSignature(
      buildWebhookSignedPayload(parsedTimestampSeconds, rawPayload),
      env.BILLING_WEBHOOK_SECRET
    );

    if (!isSignatureValid(signature, expectedSignature)) {
      await this.recordWebhookSecurityRejection(input, 'Billing webhook signature is invalid');
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook signature is invalid',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    return new Date(parsedTimestampSeconds * 1000);
  }

  private async recordWebhookSecurityRejection(
    input: ProcessBillingWebhookInput,
    reason: string
  ): Promise<void> {
    logger.warn(
      {
        scope: 'billing.webhook.security.reject',
        eventId: input.payload.id,
        provider: input.payload.provider,
        type: input.payload.type,
        reason,
        timestamp: input.timestamp
      },
      'Billing webhook security rejection recorded.'
    );

    if (!input.context) {
      return;
    }

    await this.recordAuditLog({
      context: input.context,
      action: 'billing.webhook.security.reject',
      resource: {
        type: 'billing_webhook',
        id: input.payload.id
      },
      severity: 'critical',
      metadata: {
        reason,
        provider: input.payload.provider,
        type: input.payload.type,
        timestamp: input.timestamp
      }
    });
  }

  private buildDuplicateWebhookResult(
    input: ProcessBillingWebhookInput,
    duplicate: {
      checkoutSessionId?: Types.ObjectId | null;
      tenantId?: Types.ObjectId | null;
    }
  ): BillingWebhookProcessResult {
    logger.info(
      {
        scope: 'billing.webhook.duplicate',
        eventId: input.payload.id,
        provider: input.payload.provider,
        type: input.payload.type,
        tenantId: duplicate.tenantId ? duplicate.tenantId.toString() : null,
        checkoutSessionId: duplicate.checkoutSessionId ? duplicate.checkoutSessionId.toString() : null
      },
      'Billing webhook duplicate detected.'
    );

    return {
      eventId: input.payload.id,
      provider: input.payload.provider,
      type: input.payload.type,
      status: 'duplicate',
      checkoutSessionId: duplicate.checkoutSessionId ? duplicate.checkoutSessionId.toString() : null,
      tenantId: duplicate.tenantId ? duplicate.tenantId.toString() : null
    };
  }

  private async processPaidWebhook(
    billingEventId: string,
    input: ProcessBillingWebhookInput
  ): Promise<BillingWebhookProcessResult> {
    const session = await mongoose.startSession();

    try {
      let checkoutSessionId: string | null = null;
      let tenantId: string | null = null;

      await session.withTransaction(async () => {
        const billingEvent = await BillingEventModel.findById(billingEventId).session(session);

        if (!billingEvent) {
          throw buildBillingError(
            ERROR_CODES.INTERNAL_ERROR,
            'Billing event could not be resolved',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        const checkoutSession = await this.findCheckoutSessionForWebhook(input, session);

        if (!checkoutSession) {
          billingEvent.status = BILLING_EVENT_STATUS.IGNORED;
          billingEvent.reason = 'Checkout session could not be resolved for webhook payload';
          billingEvent.processedAt = new Date();
          await billingEvent.save({ session });
          return;
        }

        const tenant = await TenantModel.findById(input.payload.data.tenantId).session(session);

        if (!tenant) {
          billingEvent.status = BILLING_EVENT_STATUS.IGNORED;
          billingEvent.reason = 'Tenant could not be resolved for webhook payload';
          billingEvent.checkoutSessionId = checkoutSession._id;
          billingEvent.processedAt = new Date();
          await billingEvent.save({ session });
          return;
        }

        const planId = input.payload.data.planId ?? checkoutSession.planId;
        const resolvedPlan = await this.authorization.resolvePlan(planId);

        if (!resolvedPlan) {
          billingEvent.status = BILLING_EVENT_STATUS.FAILED;
          billingEvent.reason = `Plan could not be resolved during webhook activation (${planId})`;
          billingEvent.checkoutSessionId = checkoutSession._id;
          billingEvent.tenantId = tenant._id;
          billingEvent.processedAt = new Date();
          checkoutSession.status = BILLING_CHECKOUT_STATUS.FAILED;
          checkoutSession.lastError = billingEvent.reason;
          await Promise.all([billingEvent.save({ session }), checkoutSession.save({ session })]);
          return;
        }

        checkoutSession.status = BILLING_CHECKOUT_STATUS.PAID;
        checkoutSession.lastError = null;

        tenant.planId = resolvedPlan.key;
        tenant.activeModuleKeys = [...resolvedPlan.allowedModuleKeys];
        tenant.subscriptionStatus = resolveActivatedTenantSubscriptionStatus(tenant.subscriptionStatus);
        tenant.subscriptionGraceEndsAt = null;

        checkoutSession.planId = resolvedPlan.key;
        checkoutSession.status = BILLING_CHECKOUT_STATUS.ACTIVATED;
        checkoutSession.activatedAt = new Date();

        billingEvent.status = BILLING_EVENT_STATUS.PROCESSED;
        billingEvent.reason = null;
        billingEvent.tenantId = tenant._id;
        billingEvent.checkoutSessionId = checkoutSession._id;
        billingEvent.processedAt = new Date();

        await Promise.all([
          checkoutSession.save({ session }),
          tenant.save({ session }),
          billingEvent.save({ session })
        ]);

        checkoutSessionId = checkoutSession._id.toString();
        tenantId = tenant._id.toString();
      });

      if (tenantId && checkoutSessionId) {
        await this.recordAuditLog({
          context: input.context,
          tenant: {
            tenantId
          },
          action: 'tenant.subscription.activate_via_webhook',
          resource: {
            type: 'tenant',
            id: tenantId
          },
          severity: 'warning',
          metadata: {
            billingEventId: input.payload.id,
            checkoutSessionId,
            provider: input.payload.provider,
            planId: input.payload.data.planId ?? null,
            statusTransition: 'pending->paid->activated'
          }
        });
      }

      return {
        eventId: input.payload.id,
        provider: input.payload.provider,
        type: input.payload.type,
        status: tenantId && checkoutSessionId ? 'processed' : 'ignored',
        checkoutSessionId,
        tenantId
      };
    } finally {
      await session.endSession();
    }
  }

  private async processTerminalWebhook(
    billingEventId: string,
    input: ProcessBillingWebhookInput
  ): Promise<BillingWebhookProcessResult> {
    const session = await mongoose.startSession();
    let subscriptionTransition: SubscriptionTransition | null = null;

    try {
      let checkoutSessionId: string | null = null;
      let tenantId: string | null = null;

      await session.withTransaction(async () => {
        const billingEvent = await BillingEventModel.findById(billingEventId).session(session);

        if (!billingEvent) {
          throw buildBillingError(
            ERROR_CODES.INTERNAL_ERROR,
            'Billing event could not be resolved',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        const checkoutSession = await this.findCheckoutSessionForWebhook(input, session);

        if (!checkoutSession) {
          billingEvent.status = BILLING_EVENT_STATUS.IGNORED;
          billingEvent.reason = 'Checkout session could not be resolved for terminal webhook payload';
          billingEvent.processedAt = new Date();
          await billingEvent.save({ session });
          return;
        }

        const tenant = await TenantModel.findById(checkoutSession.tenantId).session(session);

        checkoutSession.status =
          input.payload.type === BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_FAILED
            ? BILLING_CHECKOUT_STATUS.FAILED
            : BILLING_CHECKOUT_STATUS.CANCELED;
        checkoutSession.lastError = input.payload.data.reason ?? null;

        billingEvent.status = BILLING_EVENT_STATUS.PROCESSED;
        billingEvent.reason = input.payload.data.reason ?? null;
        billingEvent.tenantId = checkoutSession.tenantId;
        billingEvent.checkoutSessionId = checkoutSession._id;
        billingEvent.processedAt = new Date();

        const saveOperations: Promise<unknown>[] = [
          checkoutSession.save({ session }),
          billingEvent.save({ session })
        ];

        if (tenant) {
          const previousStatus = tenant.subscriptionStatus ?? null;

          if (input.payload.type === BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_FAILED) {
            tenant.subscriptionStatus = TENANT_SUBSCRIPTION_STATUS.GRACE;
            tenant.subscriptionGraceEndsAt = resolveGracePeriodEnd();
            subscriptionTransition = {
              tenantId: tenant._id.toString(),
              previousStatus,
              nextStatus: tenant.subscriptionStatus,
              reason: 'payment_failed'
            };
          }

          if (input.payload.type === BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_CANCELED) {
            tenant.subscriptionStatus = TENANT_SUBSCRIPTION_STATUS.SUSPENDED;
            tenant.subscriptionGraceEndsAt = null;
            subscriptionTransition = {
              tenantId: tenant._id.toString(),
              previousStatus,
              nextStatus: tenant.subscriptionStatus,
              reason: 'payment_canceled'
            };
          }

          saveOperations.push(tenant.save({ session }));
        }

        await Promise.all(saveOperations);

        checkoutSessionId = checkoutSession._id.toString();
        tenantId = checkoutSession.tenantId.toString();
      });

      const transition = subscriptionTransition as SubscriptionTransition | null;

      if (transition) {
        await this.recordAuditLog({
          context: input.context,
          tenant: {
            tenantId: transition.tenantId
          },
          action:
            transition.nextStatus === TENANT_SUBSCRIPTION_STATUS.GRACE
              ? 'tenant.subscription.grace'
              : 'tenant.subscription.suspend',
          resource: {
            type: 'tenant',
            id: transition.tenantId
          },
          severity: 'warning',
          changes: {
            before: {
              subscriptionStatus: transition.previousStatus
            },
            after: {
              subscriptionStatus: transition.nextStatus
            },
            fields: ['subscriptionStatus']
          },
          metadata: {
            reason: transition.reason,
            billingEventId: input.payload.id,
            provider: input.payload.provider
          }
        });
      }

      return {
        eventId: input.payload.id,
        provider: input.payload.provider,
        type: input.payload.type,
        status: checkoutSessionId ? 'processed' : 'ignored',
        checkoutSessionId,
        tenantId
      };
    } finally {
      await session.endSession();
    }
  }

  private async findCheckoutSessionForWebhook(
    input: ProcessBillingWebhookInput,
    session: mongoose.ClientSession
  ) {
    if (input.payload.data.checkoutSessionId) {
      return await BillingCheckoutSessionModel.findById(input.payload.data.checkoutSessionId).session(session);
    }

    if (input.payload.data.providerSessionId) {
      return await BillingCheckoutSessionModel.findOne({
        providerSessionId: input.payload.data.providerSessionId,
        tenantId: ensureObjectId(input.payload.data.tenantId)
      }).session(session);
    }

    return null;
  }

  private async recordAuditLog(
    input: {
      context?: CreateCheckoutSessionInput['context'];
      tenant?: {
        tenantId: string;
      };
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: input.tenant,
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const billingService = new BillingService();




















