import { randomUUID } from 'node:crypto';

import { type RequestHandler } from 'express';

import { APP_CONFIG } from '@/config/app';
import { logger } from '@/infrastructure/logger/logger';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveTraceId(incomingTraceId: string | undefined): string {
  const normalizedTraceId = incomingTraceId?.trim();

  return normalizedTraceId && UUID_PATTERN.test(normalizedTraceId) ? normalizedTraceId : randomUUID();
}

export const traceIdMiddleware: RequestHandler = (req, res, next) => {
  const traceId = resolveTraceId(req.header(APP_CONFIG.TRACE_ID_HEADER));

  res.locals.traceId = traceId;
  res.locals.logger = logger.child({ traceId });
  res.setHeader(APP_CONFIG.TRACE_ID_HEADER, traceId);

  next();
};
