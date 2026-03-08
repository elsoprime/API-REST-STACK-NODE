import { type RequestHandler } from 'express';

import { APP_CONFIG } from '@/config/app';
import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { getCookieValue } from '@/infrastructure/security/cookies';

export function assertValidCsrf(
  headerValue: string | undefined,
  cookieValue: string | undefined
): void {
  if (!headerValue || !cookieValue || headerValue !== cookieValue) {
    throw new AppError({
      code: ERROR_CODES.AUTH_CSRF_INVALID,
      message: 'Invalid CSRF token',
      statusCode: HTTP_STATUS.FORBIDDEN
    });
  }
}

export const requireCsrfToken: RequestHandler = (req, _res, next) => {
  try {
    assertValidCsrf(req.header(APP_CONFIG.CSRF_HEADER), getCookieValue(req, env.CSRF_COOKIE_NAME));
    next();
  } catch (error) {
    next(error);
  }
};
