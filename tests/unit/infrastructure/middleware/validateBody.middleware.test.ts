import { z } from 'zod';

import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';

describe('validateBody middleware', () => {
  it('parses a valid request body and forwards the request', () => {
    const middleware = validateBody(
      z.object({
        email: z.string().email()
      })
    );
    const req = { body: { email: 'demo@example.com' } };
    const next = vi.fn();

    middleware(req as never, {} as never, next);

    expect(req.body).toEqual({ email: 'demo@example.com' });
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a validation error when the body is invalid', () => {
    const middleware = validateBody(
      z.object({
        email: z.string().email()
      })
    );
    const next = vi.fn();

    middleware({ body: { email: 'invalid-email' } } as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'GEN_VALIDATION_ERROR',
        statusCode: 400,
        details: {
          email: ['Invalid email']
        }
      })
    );
  });
});
