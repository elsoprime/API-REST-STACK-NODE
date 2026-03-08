import { type RequestHandler } from 'express';
import { type ZodTypeAny } from 'zod';

import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { HTTP_STATUS } from '@/constants/http';
import { mapZodIssuesToErrorDetails } from '@/core/shared/utils/zod-error.util';

export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req, _res, next) => {
    const parsedBody = schema.safeParse(req.body);

    if (!parsedBody.success) {
      next(
        new AppError({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request body validation failed',
          statusCode: HTTP_STATUS.BAD_REQUEST,
          details: mapZodIssuesToErrorDetails(parsedBody.error.issues)
        })
      );
      return;
    }

    req.body = parsedBody.data;
    next();
  };
}
