import { createRequirePlatformPermissionMiddleware } from '@/infrastructure/middleware/requirePlatformPermission.middleware';

describe('requirePlatformPermission middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls next when the authenticated scope contains the required platform permission', () => {
    const middleware = createRequirePlatformPermissionMiddleware('platform:settings:read');
    const next = vi.fn();
    const res = {
      locals: {
        auth: {
          userId: '507f1f77bcf86cd799439011',
          sessionId: '507f1f77bcf86cd799439012',
          scope: ['platform:self', 'platform:settings:read']
        }
      }
    };

    middleware({} as never, res as never, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a forbidden error when the scope lacks the required platform permission', () => {
    const middleware = createRequirePlatformPermissionMiddleware('platform:settings:update');
    const next = vi.fn();
    const res = {
      locals: {
        auth: {
          userId: '507f1f77bcf86cd799439011',
          sessionId: '507f1f77bcf86cd799439012',
          scope: ['platform:self']
        }
      }
    };

    middleware({} as never, res as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RBAC_PERMISSION_DENIED',
        statusCode: 403
      })
    );
  });
});
