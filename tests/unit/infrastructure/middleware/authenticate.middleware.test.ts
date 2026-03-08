import { createAuthenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';

describe('authenticate middleware', () => {
  const userId = '507f1f77bcf86cd799439010';
  const sessionId = '507f1f77bcf86cd799439011';

  it('prefers the bearer token over the access cookie', async () => {
    const verifyAccessToken = vi
      .fn()
      .mockReturnValue({ sub: userId, sid: sessionId, scope: ['platform:self'], tokenType: 'access' });
    const middleware = createAuthenticateMiddleware({
      verifyAccessToken
    } as never, {
      findById: vi.fn().mockResolvedValue({
        userId,
        status: 'active',
        expiresAt: new Date(Date.now() + 60_000)
      })
    });
    const req = {
      header: vi.fn((name: string) => {
        if (name === 'authorization') {
          return 'Bearer bearer-token';
        }

        return undefined;
      }),
      headers: {
        cookie: `${process.env.AUTH_ACCESS_COOKIE_NAME}=cookie-token`
      }
    };
    const res = {
      locals: {}
    };
    const next = vi.fn();

    await middleware(req as never, res as never, next);

    expect(verifyAccessToken).toHaveBeenCalledWith('bearer-token');
    expect(res.locals).toMatchObject({
      auth: {
        userId,
        sessionId,
        scope: ['platform:self']
      }
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('returns AUTH_UNAUTHENTICATED when no access token is present', async () => {
    const middleware = createAuthenticateMiddleware({
      verifyAccessToken: vi.fn()
    } as never);
    const next = vi.fn();

    await middleware(
      {
        header: vi.fn(),
        headers: {}
      } as never,
      { locals: {} } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_UNAUTHENTICATED',
        statusCode: 401
      })
    );
  });

  it('rejects revoked persisted sessions', async () => {
    const middleware = createAuthenticateMiddleware(
      {
        verifyAccessToken: vi.fn().mockReturnValue({
          sub: userId,
          sid: sessionId,
          scope: ['platform:self'],
          tokenType: 'access'
        })
      } as never,
      {
        findById: vi.fn().mockResolvedValue({
          userId: '507f1f77bcf86cd799439010',
          status: 'revoked',
          expiresAt: new Date(Date.now() + 60_000)
        })
      }
    );
    const next = vi.fn();

    await middleware(
      {
        header: vi.fn((name: string) => (name === 'authorization' ? 'Bearer bearer-token' : undefined)),
        headers: {}
      } as never,
      { locals: {} } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_UNAUTHENTICATED',
        statusCode: 401
      })
    );
  });

  it('rejects access tokens whose authenticated ids are not valid ObjectIds', async () => {
    const middleware = createAuthenticateMiddleware({
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: 'user-1',
        sid: sessionId,
        scope: ['platform:self'],
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        tokenType: 'access'
      })
    } as never);
    const next = vi.fn();

    await middleware(
      {
        header: vi.fn((name: string) => (name === 'authorization' ? 'Bearer bearer-token' : undefined)),
        headers: {}
      } as never,
      { locals: {} } as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_UNAUTHENTICATED',
        statusCode: 401
      })
    );
  });

  it('rejects access tokens with non-ObjectId session ids before touching the session store', async () => {
    const sessionStore = {
      findById: vi.fn()
    };
    const middleware = createAuthenticateMiddleware({
      verifyAccessToken: vi.fn().mockReturnValue({
        sub: userId,
        sid: 'session-1',
        scope: ['platform:self'],
        tokenType: 'access'
      })
    } as never, sessionStore);
    const next = vi.fn();

    await middleware(
      {
        header: vi.fn((name: string) => (name === 'authorization' ? 'Bearer bearer-token' : undefined)),
        headers: {}
      } as never,
      { locals: {} } as never,
      next
    );

    expect(sessionStore.findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AUTH_UNAUTHENTICATED',
        statusCode: 401
      })
    );
  });
});
