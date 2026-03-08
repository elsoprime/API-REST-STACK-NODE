import { type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthScope } from '@/constants/security';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function getAuthContext(locals: Record<string, unknown>): AuthContext {
  const auth = locals.auth as AuthContext | undefined;

  if (!auth) {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Authenticated platform context is not available',
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
    });
  }

  return auth;
}

export function createRequirePlatformPermissionMiddleware(permissionKey: AuthScope): RequestHandler {
  return (_req, res, next) => {
    try {
      const auth = getAuthContext(res.locals as Record<string, unknown>);

      if (!auth.scope.includes(permissionKey)) {
        throw new AppError({
          code: ERROR_CODES.RBAC_PERMISSION_DENIED,
          message: 'Platform permission requirements are not satisfied',
          statusCode: HTTP_STATUS.FORBIDDEN
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requirePlatformPermission = createRequirePlatformPermissionMiddleware;
