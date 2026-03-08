import pino, { type Logger, type LoggerOptions } from 'pino';

import { env } from '@/config/env';

export type AppLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'child'>;

export const LOGGER_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
  'req.body.refreshToken',
  'req.body.recoveryCode',
  'req.body.csrfToken',
  'error.details.password',
  'error.details.token',
  'error.details.secret',
  'error.details.refreshToken',
  'error.details.recoveryCode',
  'error.details.csrfToken',
  'error.details.otpauthUrl',
  'changes.before.password',
  'changes.after.password',
  'changes.before.token',
  'changes.after.token',
  'changes.before.secret',
  'changes.after.secret',
  'changes.before.refreshToken',
  'changes.after.refreshToken',
  'changes.before.accessToken',
  'changes.after.accessToken',
  'changes.before.csrfToken',
  'changes.after.csrfToken',
  'changes.before.recoveryCode',
  'changes.after.recoveryCode',
  'changes.before.otpauthUrl',
  'changes.after.otpauthUrl'
] as const;

function buildLoggerOptions(): LoggerOptions {
  return {
    enabled: env.NODE_ENV !== 'test',
    level: env.LOG_LEVEL,
    base: {
      app: env.APP_NAME,
      environment: env.NODE_ENV,
      version: env.APP_VERSION
    },
    redact: {
      paths: [...LOGGER_REDACT_PATHS],
      censor: '[Redacted]'
    }
  };
}

function buildLoggerTransport() {
  if (!env.LOG_PRETTY || env.NODE_ENV === 'test') {
    return undefined;
  }

  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  });
}

export const logger: AppLogger = pino(buildLoggerOptions(), buildLoggerTransport());
