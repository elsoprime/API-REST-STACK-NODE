import { type Response, Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { env } from '@/config/env';
import { clearRateLimiterStore } from '@/infrastructure/middleware/rateLimiter.middleware';

function createHardeningTestApp() {
  const rootRouter = Router();
  const apiV1Router = Router();

  rootRouter.get('/health', (_req, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        ok: true
      },
      traceId: 'health-trace'
    });
  });

  apiV1Router.get('/ping', (_req, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        ok: true
      },
      traceId: 'ping-trace'
    });
  });

  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('server security hardening', () => {
  const originalGlobalRateLimit = env.RATE_LIMIT_MAX_GLOBAL;

  afterEach(() => {
    env.RATE_LIMIT_MAX_GLOBAL = originalGlobalRateLimit;
    clearRateLimiterStore();
  });

  it('adds hardening headers and disables x-powered-by', async () => {
    const app = createServer();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    );
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('adds strict-transport-security only for secure requests', async () => {
    const app = createServer();

    const insecureResponse = await request(app).get('/health');
    const secureResponse = await request(app).get('/health').set('X-Forwarded-Proto', 'https');

    expect(insecureResponse.headers['strict-transport-security']).toBeUndefined();
    expect(secureResponse.headers['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
  });

  it('applies the global rate limit only to api routes', async () => {
    env.RATE_LIMIT_MAX_GLOBAL = 1;
    clearRateLimiterStore();

    const app = createHardeningTestApp();

    const firstApiResponse = await request(app).get('/api/v1/ping');
    const secondApiResponse = await request(app).get('/api/v1/ping');
    const firstHealthResponse = await request(app).get('/health');
    const secondHealthResponse = await request(app).get('/health');

    expect(firstApiResponse.status).toBe(200);
    expect(secondApiResponse.status).toBe(429);
    expect(secondApiResponse.body).toMatchObject({
      success: false,
      error: {
        code: 'GEN_RATE_LIMITED',
        message: 'Too many requests'
      }
    });
    expect(firstHealthResponse.status).toBe(200);
    expect(secondHealthResponse.status).toBe(200);
  });
});
