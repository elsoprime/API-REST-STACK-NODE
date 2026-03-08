import { Router } from 'express';

import { authService } from '@/core/platform/auth/services/auth.service';
import { createAuthController } from '@/core/platform/auth/controllers/auth.controller';
import {
  confirmTwoFactorSchema,
  disableTwoFactorSchema,
  regenerateRecoveryCodesSchema,
  verifyEmailSchema
} from '@/core/platform/auth/schemas/auth-advanced.schemas';
import {
  loginSchema,
  refreshHeadlessSchema,
  registerSchema
} from '@/core/platform/auth/schemas/auth.schemas';
import { type AuthServiceContract } from '@/core/platform/auth/types/auth.types';
import { authRateLimiter, sensitiveRateLimiter } from '@/infrastructure/middleware/rateLimiter.middleware';
import { authenticateMiddleware } from '@/infrastructure/middleware/authenticate.middleware';
import { validateBody } from '@/infrastructure/middleware/validateBody.middleware';
import { requireCsrfToken } from '@/infrastructure/security/csrf';

function requireCsrfForCookieAuth() {
  return (req: Parameters<typeof requireCsrfToken>[0], res: Parameters<typeof requireCsrfToken>[1], next: Parameters<typeof requireCsrfToken>[2]) => {
    if (req.header('authorization')?.startsWith('Bearer ')) {
      next();
      return;
    }

    requireCsrfToken(req, res, next);
  };
}

export function createAuthRouter(service: AuthServiceContract = authService): Router {
  const authRouter = Router();
  const controller = createAuthController(service);

  authRouter.post('/register', authRateLimiter, validateBody(registerSchema), controller.register);
  authRouter.post('/login/browser', authRateLimiter, validateBody(loginSchema), controller.loginBrowser);
  authRouter.post('/login/headless', authRateLimiter, validateBody(loginSchema), controller.loginHeadless);
  authRouter.post('/verify-email', sensitiveRateLimiter, validateBody(verifyEmailSchema), controller.verifyEmail);
  authRouter.post('/refresh/browser', sensitiveRateLimiter, requireCsrfToken, controller.refreshBrowser);
  authRouter.post(
    '/refresh/headless',
    sensitiveRateLimiter,
    validateBody(refreshHeadlessSchema),
    controller.refreshHeadless
  );
  authRouter.post('/2fa/setup', authenticateMiddleware, requireCsrfForCookieAuth(), controller.setupTwoFactor);
  authRouter.post(
    '/2fa/confirm',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    validateBody(confirmTwoFactorSchema),
    controller.confirmTwoFactor
  );
  authRouter.post(
    '/2fa/disable',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    validateBody(disableTwoFactorSchema),
    controller.disableTwoFactor
  );
  authRouter.post(
    '/recovery-codes/regenerate',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    validateBody(regenerateRecoveryCodesSchema),
    controller.regenerateRecoveryCodes
  );
  authRouter.post('/logout', authenticateMiddleware, requireCsrfForCookieAuth(), controller.logout);
  authRouter.post('/logout-all', authenticateMiddleware, requireCsrfForCookieAuth(), controller.logoutAll);

  return authRouter;
}

export const authRouter = createAuthRouter();
