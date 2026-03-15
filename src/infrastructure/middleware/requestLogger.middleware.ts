import { type RequestHandler } from 'express';

import { type AppLogger, logger } from '@/infrastructure/logger/logger';

function resolveRequestLogger(locals: Record<string, unknown>): AppLogger {
  const localLogger = locals.logger;

  if (localLogger && typeof localLogger === 'object') {
    return localLogger as AppLogger;
  }

  const traceId = typeof locals.traceId === 'string' ? locals.traceId : 'unknown';
  return logger.child({ traceId });
}

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestLogger = resolveRequestLogger(res.locals as Record<string, unknown>);

  requestLogger.info(
    {
      scope: 'http.request.start',
      method: req.method,
      path: req.originalUrl
    },
    'HTTP request started.'
  );

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    requestLogger.info(
      {
        scope: 'http.request.complete',
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      },
      'HTTP request completed.'
    );

    if ([401, 403, 429].includes(res.statusCode)) {
      requestLogger.warn(
        {
          scope: 'http.security.alert',
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode
        },
        'Security-relevant HTTP status detected.'
      );
    }

    if (res.statusCode >= 500) {
      requestLogger.error(
        {
          scope: 'http.server.error',
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode
        },
        'Server error response emitted.'
      );
    }
  });

  next();
};

