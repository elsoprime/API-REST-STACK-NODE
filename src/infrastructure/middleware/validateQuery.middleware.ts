import { type RequestHandler } from 'express';
import { type ZodTypeAny } from 'zod';

import { HTTP_STATUS } from '@/constants/http';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

export function validateQuery<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req, _res, next) => {
    const parsedQuery = schema.safeParse(req.query);

    if (!parsedQuery.success) {
      next(
        new AppError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request query validation failed',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: mapZodIssuesToErrorDetails(parsedQuery.error.issues)
        })
      );
      return;
    }

    req.query = parsedQuery.data;
    next();
  };
}
