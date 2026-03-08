import { type RequestHandler } from 'express';
import { Types } from 'mongoose';

import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http';
import { AUTH_SESSION_STATUS } from '@/constants/security';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService, type TokenService } from '@/core/platform/auth/services/token.service';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { getCookieValue } from '@/infrastructure/security/cookies';

function toAuthContext(claims: {
  sub: string;
  sid: string;
  scope: AuthContext['scope'];
  tenantId?: string;
  membershipId?: string;
}): AuthContext {
  return {
    userId: claims.sub,
    sessionId: claims.sid,
    scope: claims.scope,
    tenantId: claims.tenantId,
    membershipId: claims.membershipId
  };
}

function hasValidAuthenticatedIds(claims: {
  sub: string;
  sid: string;
  tenantId?: string;
  membershipId?: string;
}): boolean {
  return (
    Types.ObjectId.isValid(claims.sub) &&
    Types.ObjectId.isValid(claims.sid) &&
    (!claims.tenantId || Types.ObjectId.isValid(claims.tenantId)) &&
    (!claims.membershipId || Types.ObjectId.isValid(claims.membershipId))
  );
}

function resolveBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  return authorizationHeader.slice('Bearer '.length).trim();
}

interface SessionLookupResult {
  userId: {
    toString: () => string;
  } | string;
  status: string;
  expiresAt: Date;
}

interface SessionStore {
  findById: (sessionId: string) => Promise<SessionLookupResult | null>;
}

function buildAuthenticationError(cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.AUTH_UNAUTHENTICATED,
    message: 'Authentication required',
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    cause
  });
}

function isSessionActive(session: SessionLookupResult, userId: string): boolean {
  return (
    session.status === AUTH_SESSION_STATUS.ACTIVE &&
    session.userId.toString() === userId &&
    session.expiresAt.getTime() > Date.now()
  );
}

export function createAuthenticateMiddleware(
  tokens: TokenService = tokenService,
  sessionStore: SessionStore = AuthSessionModel
): RequestHandler {
  return async (req, res, next) => {
    const bearerToken = resolveBearerToken(req.header('authorization'));
    const accessCookieToken = getCookieValue(req, env.AUTH_ACCESS_COOKIE_NAME);
    const accessToken = bearerToken ?? accessCookieToken;

    if (!accessToken) {
      next(buildAuthenticationError());
      return;
    }

    try {
      const claims = tokens.verifyAccessToken(accessToken);

      if (!hasValidAuthenticatedIds(claims)) {
        throw buildAuthenticationError();
      }

      const session = await sessionStore.findById(claims.sid);

      if (!session || !isSessionActive(session, claims.sub)) {
        throw buildAuthenticationError();
      }

      res.locals.auth = toAuthContext(claims);
      next();
    } catch (error) {
      next(error instanceof AppError ? error : buildAuthenticationError(error));
    }
  };
}

export const authenticateMiddleware = createAuthenticateMiddleware();
