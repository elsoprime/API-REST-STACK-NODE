import { type ErrorRequestHandler, type Response } from 'express';

import { AppError, type ErrorDetails } from '@/infrastructure/errors/app-error';
import { ERROR_CODES, type ErrorCode } from '@/infrastructure/errors/error-codes';
import { type AppLogger, logger } from '@/infrastructure/logger/logger';

interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
  };
  traceId: string;
}

interface ErrorResponse {
  statusCode: number;
  body: ErrorEnvelope;
}

interface SafeErrorLog {
  errorName: string;
  errorMessage: string;
}

function resolveErrorLogger(res: Response): AppLogger {
  const localLogger = (res.locals as Record<string, unknown>).logger;

  if (localLogger && typeof localLogger === 'object') {
    return localLogger as AppLogger;
  }

  const traceId = typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
  return logger.child({ traceId });
}

export function toErrorResponse(error: unknown, traceId: string): ErrorResponse {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {})
        },
        traceId
      }
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error'
      },
      traceId
    }
  };
}

export function toSafeErrorLog(error: unknown): SafeErrorLog {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message
    };
  }

  return {
    errorName: 'NonErrorThrow',
    errorMessage: 'A non-error value was thrown'
  };
}

export const errorHandlerMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;

  const traceId = typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
  const errorResponse = toErrorResponse(error, traceId);
  const requestLogger = resolveErrorLogger(res);

  if (errorResponse.statusCode >= 500) {
    requestLogger.error(
      {
        scope: 'http.request.error',
        method: req.method,
        path: req.originalUrl,
        statusCode: errorResponse.statusCode,
        errorCode: errorResponse.body.error.code,
        ...toSafeErrorLog(error)
      },
      'Request failed with an unexpected error.'
    );
  } else {
    requestLogger.warn(
      {
        scope: 'http.request.error',
        method: req.method,
        path: req.originalUrl,
        statusCode: errorResponse.statusCode,
        errorCode: errorResponse.body.error.code
      },
      'Request failed with a handled error.'
    );
  }

  res.status(errorResponse.statusCode).json(errorResponse.body);
};
