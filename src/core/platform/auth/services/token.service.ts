import { createHash, randomBytes } from 'node:crypto';

import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { env } from '@/config/env';
import { type AccessTokenClaims, type RefreshTokenClaims } from '@/core/platform/auth/types/auth.types';

type VerifiedTokenPayload = {
  tokenType: 'access' | 'refresh';
  sub?: unknown;
  sid?: unknown;
  scope?: unknown;
  tenantId?: unknown;
  membershipId?: unknown;
};

function toSignOptions(expiresIn: string): SignOptions {
  return {
    expiresIn: expiresIn as SignOptions['expiresIn']
  };
}

export class TokenService {
  signAccessToken(claims: Omit<AccessTokenClaims, 'tokenType'>): string {
    return jwt.sign(
      {
        ...claims,
        tokenType: 'access'
      },
      env.JWT_SECRET,
      toSignOptions(env.JWT_EXPIRES_IN)
    );
  }

  signRefreshToken(claims: Omit<RefreshTokenClaims, 'tokenType'>): string {
    return jwt.sign(
      {
        ...claims,
        tokenType: 'refresh'
      },
      env.JWT_SECRET,
      toSignOptions(env.REFRESH_TOKEN_EXPIRES_IN)
    );
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return this.assertAccessTokenClaims(this.verifyTokenPayload(token, 'access'));
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    return this.assertRefreshTokenClaims(this.verifyTokenPayload(token, 'refresh'));
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  private verifyTokenPayload(
    token: string,
    tokenType: 'access' | 'refresh'
  ): VerifiedTokenPayload {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (typeof payload !== 'object' || payload === null || payload.tokenType !== tokenType) {
      throw new Error(`Invalid ${tokenType} token`);
    }

    return payload as VerifiedTokenPayload;
  }

  private assertAccessTokenClaims(payload: VerifiedTokenPayload): AccessTokenClaims {
    if (
      !this.isObjectIdString(payload.sub) ||
      !this.isObjectIdString(payload.sid) ||
      !this.isScopeList(payload.scope) ||
      !this.isOptionalObjectIdString(payload.tenantId) ||
      !this.isOptionalObjectIdString(payload.membershipId)
    ) {
      throw new Error('Invalid access token');
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      scope: payload.scope,
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      tokenType: 'access'
    };
  }

  private assertRefreshTokenClaims(payload: VerifiedTokenPayload): RefreshTokenClaims {
    if (!this.isObjectIdString(payload.sub) || !this.isObjectIdString(payload.sid)) {
      throw new Error('Invalid refresh token');
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      tokenType: 'refresh'
    };
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isObjectIdString(value: unknown): value is string {
    return this.isNonEmptyString(value) && Types.ObjectId.isValid(value);
  }

  private isOptionalObjectIdString(value: unknown): value is string | undefined {
    return typeof value === 'undefined' || this.isObjectIdString(value);
  }

  private isScopeList(value: unknown): value is AccessTokenClaims['scope'] {
    return Array.isArray(value) && value.every((scope) => this.isNonEmptyString(scope));
  }
}

export const tokenService = new TokenService();
