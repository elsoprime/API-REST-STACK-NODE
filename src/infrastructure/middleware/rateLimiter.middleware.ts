import { type Request, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { RATE_LIMITER_PROFILES, type RateLimiterProfile } from '@/constants/security';
import { env } from '@/config/env';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

interface RateLimitBucket {
  count: number;
  expiresAt: number;
}

interface CreateRateLimiterOptions {
  max: number;
  windowMs: number;
  profile: RateLimiterProfile;
  keyResolver?: (req: Request) => string;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

function buildRateLimitKey(profile: RateLimiterProfile, clientId: string): string {
  return `${profile}:${clientId}`;
}

function resolveClientId(ip: string | undefined): string {
  return ip && ip.length > 0 ? ip : 'unknown';
}

function normalizeEmailForRateLimit(value: unknown): string {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  const normalizedEmail = value.trim().toLowerCase();

  return normalizedEmail.length > 0 ? normalizedEmail : 'unknown';
}

export function clearRateLimiterStore(): void {
  rateLimitStore.clear();
}

export function createRateLimiter(options: CreateRateLimiterOptions): RequestHandler {
  return (req, _res, next) => {
    const now = Date.now();
    const rateLimitKey = options.keyResolver?.(req) ?? resolveClientId(req.ip);
    const key = buildRateLimitKey(options.profile, rateLimitKey);
    const existingBucket = rateLimitStore.get(key);

    if (!existingBucket || existingBucket.expiresAt <= now) {
      rateLimitStore.set(key, {
        count: 1,
        expiresAt: now + options.windowMs
      });
      next();
      return;
    }

    existingBucket.count += 1;
    rateLimitStore.set(key, existingBucket);

    if (existingBucket.count > options.max) {
      next(
        new AppError({
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests',
          statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
          details: {
            rateLimit: [
              `Profile ${options.profile} exceeded ${options.max} requests in ${options.windowMs}ms`
            ]
          }
        })
      );
      return;
    }

    next();
  };
}

export function createEmailAddressRateLimiter(options: Omit<CreateRateLimiterOptions, 'keyResolver'>): RequestHandler {
  return createRateLimiter({
    ...options,
    keyResolver: (req) => {
      const requestBody = req.body as {
        email?: string;
      } | undefined;

      return `email:${normalizeEmailForRateLimit(requestBody?.email)}`;
    }
  });
}

export const globalRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_MAX_GLOBAL,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.GLOBAL
});

export const authRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_MAX_AUTH,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.AUTH
});

export const authEmailRateLimiter = createEmailAddressRateLimiter({
  max: env.RATE_LIMIT_MAX_AUTH,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.AUTH
});

export const sensitiveRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_MAX_SENSITIVE,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.SENSITIVE
});

export const sensitiveEmailRateLimiter = createEmailAddressRateLimiter({
  max: env.RATE_LIMIT_MAX_SENSITIVE,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.SENSITIVE
});
