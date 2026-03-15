import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { type BillingServiceContract } from '@/core/platform/billing/types/billing.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';

interface RawBodyRequest extends Request {
  rawBody?: string;
}

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getAuthContext(res: Response): AuthContext {
  return (res.locals.auth ?? {}) as AuthContext;
}

function getTenantContext(res: Response): TenantContext {
  return (res.locals.tenantContext ?? {}) as TenantContext;
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined,
    tenant: res.locals.tenantContext as TenantContext | undefined
  });
}

function getWebhookSignature(req: Request): string | null {
  const value = req.header('X-Billing-Signature')?.trim();
  return value && value.length > 0 ? value : null;
}

function getWebhookTimestamp(req: Request): string | null {
  const value = req.header('X-Billing-Timestamp')?.trim();
  return value && value.length > 0 ? value : null;
}

function getRawWebhookBody(req: Request): string | null {
  const rawBody = (req as RawBodyRequest).rawBody;

  if (typeof rawBody !== 'string') {
    return null;
  }

  return rawBody.length > 0 ? rawBody : null;
}

export function createBillingController(service: BillingServiceContract) {
  return {
    listPlans: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.listPlans();
        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    createCheckoutSession: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.createCheckoutSession({
          tenantId: tenantContext.tenantId,
          userId: auth.userId,
          planId: req.body.planId,
          provider: req.body.provider,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess({ checkoutSession: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    processProviderWebhook: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.processProviderWebhook({
          signature: getWebhookSignature(req),
          timestamp: getWebhookTimestamp(req),
          rawBody: getRawWebhookBody(req),
          payload: req.body,
          context: createExecutionContext({
            traceId: getTraceId(res),
            actor: {
              kind: 'system',
              systemId: 'billing.webhook',
              label: 'Billing Webhook'
            }
          })
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}