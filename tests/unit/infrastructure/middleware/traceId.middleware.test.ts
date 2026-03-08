import { APP_CONFIG } from '@/config/app';
import { traceIdMiddleware } from '@/infrastructure/middleware/traceId.middleware';

describe('traceId middleware', () => {
  it('reuses a valid incoming UUID trace id', () => {
    const validTraceId = '9c7f2a2a-7792-48f8-8920-a9b3e31f4f88';
    const res = {
      locals: {},
      setHeader: vi.fn()
    };
    const next = vi.fn();

    traceIdMiddleware(
      {
        header: vi.fn((name: string) => (name === APP_CONFIG.TRACE_ID_HEADER ? validTraceId : undefined))
      } as never,
      res as never,
      next
    );

    expect(res.locals.traceId).toBe(validTraceId);
    expect(res.setHeader).toHaveBeenCalledWith(APP_CONFIG.TRACE_ID_HEADER, validTraceId);
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces invalid incoming trace ids with a generated UUID', () => {
    const res = {
      locals: {},
      setHeader: vi.fn()
    };

    traceIdMiddleware(
      {
        header: vi.fn((name: string) => (name === APP_CONFIG.TRACE_ID_HEADER ? 'not-a-uuid' : undefined))
      } as never,
      res as never,
      vi.fn()
    );

    expect(res.locals.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
