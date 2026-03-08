import jwt from 'jsonwebtoken';

import { env } from '@/config/env';
import { TokenService } from '@/core/platform/auth/services/token.service';

describe('TokenService', () => {
  const userId = '507f1f77bcf86cd799439010';
  const sessionId = '507f1f77bcf86cd799439011';

  it('signs and verifies access tokens', () => {
    const service = new TokenService();
    const token = service.signAccessToken({
      sub: userId,
      sid: sessionId,
      scope: ['platform:self']
    });

    expect(service.verifyAccessToken(token)).toMatchObject({
      sub: userId,
      sid: sessionId,
      scope: ['platform:self'],
      tokenType: 'access'
    });
  });

  it('rejects refresh tokens when verified as access tokens', () => {
    const service = new TokenService();
    const token = service.signRefreshToken({
      sub: userId,
      sid: sessionId
    });

    expect(() => service.verifyAccessToken(token)).toThrow('Invalid access token');
  });

  it('rejects access tokens with missing required claims', () => {
    const service = new TokenService();
    const token = jwt.sign(
      {
        sub: '507f1f77bcf86cd799439010',
        sid: sessionId,
        tokenType: 'access'
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN
      }
    );

    expect(() => service.verifyAccessToken(token)).toThrow('Invalid access token');
  });

  it('hashes refresh tokens deterministically', () => {
    const service = new TokenService();

    expect(service.hashToken('refresh-token')).toBe(service.hashToken('refresh-token'));
    expect(service.hashToken('refresh-token')).not.toBe(service.hashToken('refresh-token-2'));
  });

  it('rejects access tokens with non-ObjectId authenticated claims', () => {
    const service = new TokenService();
    const token = jwt.sign(
      {
        sub: 'user-1',
        sid: sessionId,
        scope: ['platform:self'],
        tenantId: 'tenant-1',
        tokenType: 'access'
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN
      }
    );

    expect(() => service.verifyAccessToken(token)).toThrow('Invalid access token');
  });

  it('rejects access tokens with non-ObjectId session ids', () => {
    const service = new TokenService();
    const token = jwt.sign(
      {
        sub: userId,
        sid: 'session-1',
        scope: ['platform:self'],
        tokenType: 'access'
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN
      }
    );

    expect(() => service.verifyAccessToken(token)).toThrow('Invalid access token');
  });

  it('rejects refresh tokens with non-ObjectId session ids', () => {
    const service = new TokenService();
    const token = jwt.sign(
      {
        sub: userId,
        sid: 'session-1',
        tokenType: 'refresh'
      },
      env.JWT_SECRET,
      {
        expiresIn: env.REFRESH_TOKEN_EXPIRES_IN
      }
    );

    expect(() => service.verifyRefreshToken(token)).toThrow('Invalid refresh token');
  });
});
