import { z } from 'zod';

import { validateQuery } from '@/infrastructure/middleware/validateQuery.middleware';

describe('validateQuery middleware', () => {
  it('parses a valid request query and forwards the request', () => {
    const middleware = validateQuery(
      z.object({
        page: z.coerce.number().int().positive()
      })
    );
    const req = { query: { page: '2' } };
    const next = vi.fn();

    middleware(req as never, {} as never, next);

    expect(req.query).toEqual({ page: 2 });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a validation error when the query is invalid', () => {
    const middleware = validateQuery(
      z.object({
        page: z.coerce.number().int().positive()
      })
    );
    const next = vi.fn();

    middleware({ query: { page: '0' } } as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'GEN_VALIDATION_ERROR',
        statusCode: 400,
        details: {
          page: ['Number must be greater than 0']
        }
      })
    );
  });
});
