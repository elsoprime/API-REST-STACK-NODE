import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext, type TenantServiceContract } from '@/core/tenant/types/tenant.types';
import { setAccessTokenCookie, setCsrfCookie } from '@/infrastructure/security/cookies';

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

function isBearerRequest(req: Request): boolean {
  return req.header('authorization')?.startsWith('Bearer ') ?? false;
}

export function createTenantController(service: TenantServiceContract) {
  return {
    createTenant: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.createTenant({
          userId: auth.userId,
          name: req.body.name,
          slug: req.body.slug,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listMyTenants: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.listMyTenants({
          userId: auth.userId,
          sessionId: auth.sessionId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    switchActiveTenant: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.switchActiveTenant({
          userId: auth.userId,
          sessionId: auth.sessionId,
          tenantId: req.body.tenantId,
          scope: auth.scope,
          context: getExecutionContext(res)
        });

        if (isBearerRequest(req)) {
          res.status(HTTP_STATUS.OK).json(
            buildSuccess(
              {
                tenant: result.tenant,
                membership: result.membership,
                accessToken: result.accessToken
              },
              getTraceId(res)
            )
          );
          return;
        }

        setAccessTokenCookie(res, result.accessToken);
        setCsrfCookie(res, tokenService.generateCsrfToken());

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              tenant: result.tenant,
              membership: result.membership
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    createInvitation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.createInvitation({
          userId: auth.userId,
          tenantId: tenantContext.tenantId,
          email: req.body.email,
          roleKey: req.body.roleKey,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.CREATED).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    acceptInvitation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.acceptInvitation({
          userId: auth.userId,
          token: req.body.token,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    revokeInvitation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.revokeInvitation({
          userId: auth.userId,
          tenantId: tenantContext.tenantId,
          invitationId: req.body.invitationId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    transferOwnership: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.transferOwnership({
          userId: auth.userId,
          tenantId: tenantContext.tenantId,
          targetUserId: req.body.targetUserId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    assignSubscription: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.assignSubscription({
          userId: auth.userId,
          tenantId: tenantContext.tenantId,
          planId: req.body.planId,
          checkoutSessionId: req.body.checkoutSessionId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    cancelSubscription: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const tenantContext = getTenantContext(res);
        const result = await service.cancelSubscription({
          userId: auth.userId,
          tenantId: tenantContext.tenantId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}

