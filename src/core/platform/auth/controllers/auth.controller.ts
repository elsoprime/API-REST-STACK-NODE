import { type NextFunction, type Request, type Response } from 'express';

import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { type AuthServiceContract, type AuthContext } from '@/core/platform/auth/types/auth.types';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import {
  clearAuthCookies,
  getCookieValue,
  setAccessTokenCookie,
  setCsrfCookie,
  setRefreshTokenCookie
} from '@/infrastructure/security/cookies';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getAuthContext(res: Response): AuthContext {
  return (res.locals.auth ?? {}) as AuthContext;
}

function getTenantContext(res: Response): TenantContext | undefined {
  return res.locals.tenantContext as TenantContext | undefined;
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined,
    tenant: getTenantContext(res)
  });
}

function getRequestMetadata(req: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.ip,
    userAgent: req.header('user-agent') ?? undefined
  };
}

export function createAuthController(service: AuthServiceContract) {
  return {
    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.register({
          ...req.body,
          context: getExecutionContext(res)
        });
        res.status(HTTP_STATUS.ACCEPTED).json(
          buildSuccess(
            {
              accepted: result.accepted
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    resendVerification: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.resendVerification({
          ...req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.ACCEPTED).json(
          buildSuccess(
            {
              accepted: result.accepted
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    forgotPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.forgotPassword({
          ...req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.ACCEPTED).json(
          buildSuccess(
            {
              accepted: result.accepted
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    resetPassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.resetPassword({
          ...req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    loginBrowser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.login({
          ...req.body,
          ...getRequestMetadata(req),
          context: getExecutionContext(res)
        });

        setAccessTokenCookie(res, result.tokens.accessToken);
        setRefreshTokenCookie(res, result.tokens.refreshToken);
        setCsrfCookie(res, result.tokens.csrfToken);

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              user: result.user,
              session: result.session
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    loginHeadless: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.login({
          ...req.body,
          ...getRequestMetadata(req),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              user: result.user,
              session: result.session,
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    refreshBrowser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const refreshToken = getCookieValue(req, env.REFRESH_TOKEN_COOKIE_NAME);
        const result = await service.refresh({
          refreshToken: refreshToken ?? '',
          context: getExecutionContext(res)
        });

        setAccessTokenCookie(res, result.tokens.accessToken);
        setRefreshTokenCookie(res, result.tokens.refreshToken);
        setCsrfCookie(res, result.tokens.csrfToken);

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              user: result.user,
              session: result.session
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    refreshHeadless: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.refresh({
          ...req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              user: result.user,
              session: result.session,
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    verifyEmail: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.verifyEmail({
          ...req.body,
          context: getExecutionContext(res)
        });
        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    setupTwoFactor: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.setupTwoFactor({
          userId: auth.userId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              pending: result.pending
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    confirmTwoFactor: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.confirmTwoFactor({
          userId: auth.userId,
          code: req.body.code,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              enabled: result.enabled
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    disableTwoFactor: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.disableTwoFactor({
          userId: auth.userId,
          code: req.body.code,
          recoveryCode: req.body.recoveryCode,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    regenerateRecoveryCodes: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.regenerateRecoveryCodes({
          userId: auth.userId,
          code: req.body.code,
          recoveryCode: req.body.recoveryCode,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(
          buildSuccess(
            {
              regenerated: result.regenerated
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    logout: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.logout({
          sessionId: auth.sessionId,
          context: getExecutionContext(res)
        });

        clearAuthCookies(res);
        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    changePassword: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.changePassword({
          userId: auth.userId,
          sessionId: auth.sessionId,
          ...req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    logoutAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const auth = getAuthContext(res);
        const result = await service.logoutAll({
          userId: auth.userId,
          context: getExecutionContext(res)
        });

        clearAuthCookies(res);
        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
