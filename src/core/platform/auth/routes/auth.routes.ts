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
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshHeadlessSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema
} from '@/core/platform/auth/schemas/auth.schemas';
import { type AuthServiceContract } from '@/core/platform/auth/types/auth.types';
import {
  authEmailRateLimiter,
  authRateLimiter,
  refreshRateLimiter,
  sensitiveEmailRateLimiter,
  sensitiveRateLimiter
} from '@/infrastructure/middleware/rateLimiter.middleware';
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

  authRouter.post(
    '/register',
    authRateLimiter,
    authEmailRateLimiter,
    validateBody(registerSchema),
    controller.register
  );
  authRouter.post('/login/browser', authRateLimiter, validateBody(loginSchema), controller.loginBrowser);
  authRouter.post('/login/headless', authRateLimiter, validateBody(loginSchema), controller.loginHeadless);
  authRouter.post(
    '/resend-verification',
    sensitiveRateLimiter,
    sensitiveEmailRateLimiter,
    validateBody(resendVerificationSchema),
    controller.resendVerification
  );
  authRouter.post(
    '/forgot-password',
    sensitiveRateLimiter,
    sensitiveEmailRateLimiter,
    validateBody(forgotPasswordSchema),
    controller.forgotPassword
  );
  authRouter.post(
    '/reset-password',
    sensitiveRateLimiter,
    sensitiveEmailRateLimiter,
    validateBody(resetPasswordSchema),
    controller.resetPassword
  );
  authRouter.post(
    '/verify-email',
    sensitiveRateLimiter,
    sensitiveEmailRateLimiter,
    validateBody(verifyEmailSchema),
    controller.verifyEmail
  );
  authRouter.post('/refresh/browser', refreshRateLimiter, requireCsrfToken, controller.refreshBrowser);
  authRouter.post(
    '/refresh/headless',
    refreshRateLimiter,
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
  authRouter.post(
    '/change-password',
    authenticateMiddleware,
    requireCsrfForCookieAuth(),
    sensitiveRateLimiter,
    validateBody(changePasswordSchema),
    controller.changePassword
  );
  authRouter.post('/logout', authenticateMiddleware, requireCsrfForCookieAuth(), controller.logout);
  authRouter.post('/logout-all', authenticateMiddleware, requireCsrfForCookieAuth(), controller.logoutAll);

  return authRouter;
}

export const authRouter = createAuthRouter();
