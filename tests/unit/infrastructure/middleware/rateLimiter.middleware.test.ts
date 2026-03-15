import * as redisClient from '@/infrastructure/redis/redis.client';
import {
  authRateLimiter,
  clearRateLimiterStore,
  createRateLimiter,
  sensitiveRateLimiter
} from '@/infrastructure/middleware/rateLimiter.middleware';
import { RATE_LIMITER_PROFILES } from '@/constants/security';

describe('rate limiter middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRateLimiterStore();
  });

  it('allows requests while they stay within the configured window budget', async () => {
    const middleware = createRateLimiter({
      max: 2,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.GLOBAL
    });
    const next = vi.fn();
    const req = { ip: '127.0.0.1' };

    await middleware(req as never, {} as never, next);
    await middleware(req as never, {} as never, next);

    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('forwards a rate limit error once the budget is exhausted', async () => {
    const middleware = createRateLimiter({
      max: 1,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.AUTH
    });
    const req = { ip: '127.0.0.1' };
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    await middleware(req as never, {} as never, firstNext);
    await middleware(req as never, {} as never, secondNext);

    expect(firstNext).toHaveBeenCalledWith();
    expect(secondNext).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'GEN_RATE_LIMITED',
        statusCode: 429
      })
    );
  });

  it('uses the redis backend when it is available', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      pexpire: vi.fn().mockResolvedValue(1),
      pttl: vi.fn().mockResolvedValue(1000)
    };
    const middleware = createRateLimiter({
      max: 2,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.GLOBAL
    });
    const next = vi.fn();

    vi.spyOn(redisClient, 'isRedisEnabled').mockReturnValue(true);
    vi.spyOn(redisClient, 'getRedisClient').mockReturnValue(redis as never);

    await middleware({ ip: '127.0.0.1' } as never, {} as never, next);

    expect(redis.incr).toHaveBeenCalledTimes(1);
    expect(redis.pexpire).toHaveBeenCalledTimes(1);
    expect(redis.pttl).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to the in-memory store when redis fails', async () => {
    const redis = {
      incr: vi.fn().mockRejectedValue(new Error('redis unavailable'))
    };
    const middleware = createRateLimiter({
      max: 1,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.SENSITIVE
    });
    const req = { ip: '127.0.0.1' };
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    vi.spyOn(redisClient, 'isRedisEnabled').mockReturnValue(true);
    vi.spyOn(redisClient, 'hasRedisInitializationAttempted').mockReturnValue(true);
    vi.spyOn(redisClient, 'getRedisClient').mockReturnValue(redis as never);

    await middleware(req as never, {} as never, firstNext);
    await middleware(req as never, {} as never, secondNext);

    expect(firstNext).toHaveBeenCalledWith();
    expect(secondNext).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'GEN_RATE_LIMITED',
        statusCode: 429
      })
    );
  });

  it('exports auth and sensitive middlewares bound to the current env config', () => {
    expect(authRateLimiter).toBeTypeOf('function');
    expect(sensitiveRateLimiter).toBeTypeOf('function');
  });
});
