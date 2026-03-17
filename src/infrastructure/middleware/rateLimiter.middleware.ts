import { type Request, type RequestHandler } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { RATE_LIMITER_PROFILES, type RateLimiterProfile } from '@/constants/security';
import { env } from '@/config/env';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { logger } from '@/infrastructure/logger/logger';
import { getRedisClient, hasRedisInitializationAttempted, isRedisEnabled } from '@/infrastructure/redis/redis.client';

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
let redisFallbackLogged = false;

function buildRateLimitKey(profile: RateLimiterProfile, clientId: string): string {
  return `${env.RATE_LIMIT_REDIS_PREFIX}:${profile}:${clientId}`;
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

async function incrementRedisBucket(
  key: string,
  windowMs: number
): Promise<RateLimitBucket | null> {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  const now = Date.now();

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    const expiresAt = ttl > 0 ? now + ttl : now + windowMs;

    return {
      count,
      expiresAt
    };
  } catch (error) {
    logger.warn(
      {
        scope: 'rate_limiter.redis.error',
        key,
        errorMessage: error instanceof Error ? error.message : 'Unknown redis error'
      },
      'Rate limiter redis backend failed; falling back to in-memory store.'
    );

    return null;
  }
}

function incrementInMemoryBucket(key: string, windowMs: number): RateLimitBucket {
  const now = Date.now();
  const existingBucket = rateLimitStore.get(key);

  if (!existingBucket || existingBucket.expiresAt <= now) {
    const bucket = {
      count: 1,
      expiresAt: now + windowMs
    };
    rateLimitStore.set(key, bucket);
    return bucket;
  }

  existingBucket.count += 1;
  rateLimitStore.set(key, existingBucket);
  return existingBucket;
}

export function clearRateLimiterStore(): void {
  rateLimitStore.clear();
  redisFallbackLogged = false;
}

export function createRateLimiter(options: CreateRateLimiterOptions): RequestHandler {
  return async (req, _res, next) => {
    const rateLimitKey = options.keyResolver?.(req) ?? resolveClientId(req.ip);
    const key = buildRateLimitKey(options.profile, rateLimitKey);

    let bucket: RateLimitBucket | null = null;

    if (isRedisEnabled()) {
      bucket = await incrementRedisBucket(key, options.windowMs);
    }

    if (!bucket) {
      if (!redisFallbackLogged && isRedisEnabled() && hasRedisInitializationAttempted()) {
        logger.warn({ scope: 'rate_limiter.redis.fallback' }, 'Redis rate limiter unavailable; using in-memory store.');
        redisFallbackLogged = true;
      }

      bucket = incrementInMemoryBucket(key, options.windowMs);
    }

    if (bucket.count > options.max) {
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

export function createGlobalRateLimiter(): RequestHandler {
  return createRateLimiter({
    max: env.RATE_LIMIT_MAX_GLOBAL,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    profile: RATE_LIMITER_PROFILES.GLOBAL
  });
}

export const globalRateLimiter = createGlobalRateLimiter();

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

export const refreshRateLimiter = createRateLimiter({
  max: env.RATE_LIMIT_MAX_REFRESH,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  profile: RATE_LIMITER_PROFILES.SENSITIVE
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