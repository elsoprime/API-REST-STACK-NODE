import {
  authRateLimiter,
  clearRateLimiterStore,
  createRateLimiter,
  sensitiveRateLimiter
} from '@/infrastructure/middleware/rateLimiter.middleware';
import { RATE_LIMITER_PROFILES } from '@/constants/security';

describe('rate limiter middleware', () => {
  afterEach(() => {
    clearRateLimiterStore();
  });

  it('allows requests while they stay within the configured window budget', () => {
    const middleware = createRateLimiter({
      max: 2,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.GLOBAL
    });
    const next = vi.fn();
    const req = { ip: '127.0.0.1' };

    middleware(req as never, {} as never, next);
    middleware(req as never, {} as never, next);

    expect(next).toHaveBeenNthCalledWith(1);
    expect(next).toHaveBeenNthCalledWith(2);
  });

  it('forwards a rate limit error once the budget is exhausted', () => {
    const middleware = createRateLimiter({
      max: 1,
      windowMs: 1000,
      profile: RATE_LIMITER_PROFILES.AUTH
    });
    const req = { ip: '127.0.0.1' };
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    middleware(req as never, {} as never, firstNext);
    middleware(req as never, {} as never, secondNext);

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
