import { type Request, type RequestHandler } from 'express';
import { Types } from 'mongoose';

import { APP_CONFIG } from '@/config/app';
import { HTTP_STATUS } from '@/constants/http';
import { MEMBERSHIP_STATUS, TENANT_STATUS, TENANT_SUBSCRIPTION_STATUS } from '@/constants/tenant';
import { rbacService, type RbacService } from '@/core/platform/rbac/services/rbac.service';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { logger } from '@/infrastructure/logger/logger';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function getAuthContext(locals: Record<string, unknown>): AuthContext {
  return (locals.auth ?? {}) as AuthContext;
}

function buildTenantError(code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES], message: string, statusCode: number): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function parseTenantId(headerValue: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(headerValue) ? new Types.ObjectId(headerValue) : null;
}

function resolveSubscriptionStatus(tenant: { subscriptionStatus?: string | null; planId?: string | null }): string {
  if (tenant.subscriptionStatus) {
    return tenant.subscriptionStatus;
  }

  return tenant.planId ? TENANT_SUBSCRIPTION_STATUS.ACTIVE : TENANT_SUBSCRIPTION_STATUS.PENDING;
}

function isSubscriptionActive(status: string): boolean {
  return status === TENANT_SUBSCRIPTION_STATUS.ACTIVE || status === TENANT_SUBSCRIPTION_STATUS.REACTIVATED;
}

function shouldBypassSubscriptionGate(req: Request): boolean {
  const method = (req.method ?? '').toUpperCase();
  const path = req.originalUrl ?? req.path ?? '';

  if (method === 'POST' && path.includes('/billing/checkout/session')) {
    return true;
  }

  if ((method === 'PATCH' || method === 'DELETE') && path.includes('/tenant/subscription')) {
    return true;
  }

  return false;
}

function parseAuthenticatedUserId(userId: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;
}

export function createResolveTenantContextMiddleware(
  authorization: RbacService = rbacService
): RequestHandler {
  return async (req, res, next) => {
    try {
      const rawTenantId = req.header(APP_CONFIG.TENANT_ID_HEADER);

      if (!rawTenantId) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_HEADER_REQUIRED,
            `${APP_CONFIG.TENANT_ID_HEADER} header is required`,
            HTTP_STATUS.BAD_REQUEST
          )
        );
        return;
      }

      const tenantObjectId = parseTenantId(rawTenantId);

      if (!tenantObjectId) {
        next(
          buildTenantError(
            ERROR_CODES.VALIDATION_ERROR,
            `${APP_CONFIG.TENANT_ID_HEADER} must be a valid ObjectId`,
            HTTP_STATUS.BAD_REQUEST
          )
        );
        return;
      }

      const auth = getAuthContext(res.locals as Record<string, unknown>);

      if (!auth.userId) {
        next(
          buildTenantError(
            ERROR_CODES.AUTH_UNAUTHENTICATED,
            'Authentication required',
            HTTP_STATUS.UNAUTHORIZED
          )
        );
        return;
      }

      const userObjectId = parseAuthenticatedUserId(auth.userId);

      if (!userObjectId) {
        next(
          buildTenantError(
            ERROR_CODES.AUTH_UNAUTHENTICATED,
            'Authentication required',
            HTTP_STATUS.UNAUTHORIZED
          )
        );
        return;
      }

      if (auth.tenantId && auth.tenantId !== tenantObjectId.toString()) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_SCOPE_MISMATCH,
            'Authenticated tenant scope does not match the requested tenant',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      const [tenant, membership] = await Promise.all([
        TenantModel.findById(tenantObjectId),
        MembershipModel.findOne({
          tenantId: tenantObjectId,
          userId: userObjectId
        })
      ]);

      if (!tenant) {
        next(
          buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND)
        );
        return;
      }

      if (tenant.status !== TENANT_STATUS.ACTIVE) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_INACTIVE,
            'Tenant is not active',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      if (!membership) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_MEMBERSHIP_REQUIRED,
            'Active tenant membership required',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      if (auth.membershipId && auth.membershipId !== membership._id.toString()) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_SCOPE_MISMATCH,
            'Authenticated membership scope does not match the requested tenant',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_MEMBERSHIP_INACTIVE,
            'Tenant membership is not active',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      const roleKey = membership.roleKey?.trim();

      if (!roleKey) {
        next(
          buildTenantError(
            ERROR_CODES.TENANT_ACCESS_DENIED,
            'Tenant role could not be resolved',
            HTTP_STATUS.FORBIDDEN
          )
        );
        return;
      }

      const resolvedAuthorization = await authorization.resolveTenantAuthorization({
        tenantId: tenant._id.toString(),
        roleKey,
        ownerUserId: tenant.ownerUserId.toString(),
        membershipUserId: membership.userId.toString(),
        planId: tenant.planId ?? null,
        activeModuleKeys: tenant.activeModuleKeys ?? []
      });

      if (!shouldBypassSubscriptionGate(req)) {
        const subscriptionStatus = resolveSubscriptionStatus({
          subscriptionStatus: tenant.subscriptionStatus ?? null,
          planId: tenant.planId ?? null
        });

        if (subscriptionStatus === TENANT_SUBSCRIPTION_STATUS.GRACE) {
          const graceEndsAt = tenant.subscriptionGraceEndsAt;

          if (!graceEndsAt || graceEndsAt.getTime() <= Date.now()) {
            tenant.subscriptionStatus = TENANT_SUBSCRIPTION_STATUS.SUSPENDED;
            tenant.subscriptionGraceEndsAt = graceEndsAt ?? new Date();
            await tenant.save();

            logger.warn(
              {
                scope: 'tenant.subscription.suspended',
                tenantId: tenant._id.toString(),
                reason: 'grace_expired'
              },
              'Tenant subscription suspended after grace period expired.'
            );

            next(
              buildTenantError(
                ERROR_CODES.TENANT_SUBSCRIPTION_PAYMENT_REQUIRED,
                'Tenant subscription is suspended',
                HTTP_STATUS.FORBIDDEN
              )
            );
            return;
          }
        }

        if (!isSubscriptionActive(subscriptionStatus) && subscriptionStatus !== TENANT_SUBSCRIPTION_STATUS.GRACE) {
          next(
            buildTenantError(
              ERROR_CODES.TENANT_SUBSCRIPTION_PAYMENT_REQUIRED,
              'Tenant subscription is not active',
              HTTP_STATUS.FORBIDDEN
            )
          );
          return;
        }
      }

      const tenantContext: TenantContext = {
        tenantId: tenant._id.toString(),
        membershipId: membership._id.toString(),
        roleKey,
        authorization: resolvedAuthorization
      };

      res.locals.tenantContext = tenantContext;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const resolveTenantContextMiddleware = createResolveTenantContextMiddleware();

