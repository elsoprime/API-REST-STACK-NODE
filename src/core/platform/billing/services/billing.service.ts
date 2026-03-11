import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import {
  BILLING_CHECKOUT_STATUS,
  BILLING_EVENT_STATUS,  BILLING_WEBHOOK_EVENT_TYPE,
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
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

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
    this.assertWebhookSignature(input.signature, input.payload);

    const duplicate = await BillingEventModel.findOne({ providerEventId: input.payload.id }).lean();

    if (duplicate) {
      return {
        eventId: input.payload.id,
        provider: input.payload.provider,
        type: input.payload.type,
        status: 'duplicate',
        checkoutSessionId: duplicate.checkoutSessionId ? duplicate.checkoutSessionId.toString() : null,
        tenantId: duplicate.tenantId ? duplicate.tenantId.toString() : null
      };
    }

    const billingEvent = await BillingEventModel.create({
      providerEventId: input.payload.id,
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
      payload: input.payload,
      processedAt: null
    });

    if (input.payload.type === BILLING_WEBHOOK_EVENT_TYPE.CHECKOUT_PAID) {
      return await this.processPaidWebhook(billingEvent._id.toString(), input);
    }

    return await this.processTerminalWebhook(billingEvent._id.toString(), input);
  }

  private assertWebhookSignature(
    signature: string | null,
    payload: ProcessBillingWebhookInput['payload']
  ): void {
    if (!signature) {
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook signature is required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const canonicalPayload = buildCanonicalWebhookPayload(payload);
    const expectedSignature = buildWebhookSignature(canonicalPayload, env.BILLING_WEBHOOK_SECRET);

    if (!isSignatureValid(signature, expectedSignature)) {
      throw buildBillingError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Billing webhook signature is invalid',
        HTTP_STATUS.UNAUTHORIZED
      );
    }
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

        await Promise.all([checkoutSession.save({ session }), billingEvent.save({ session })]);

        checkoutSessionId = checkoutSession._id.toString();
        tenantId = checkoutSession.tenantId.toString();
      });

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

