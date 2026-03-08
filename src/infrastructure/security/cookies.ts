import { type Request, type Response, type CookieOptions } from 'express';

import { env } from '@/config/env';

function buildCookieOptions(maxAgeMs: number, httpOnly: boolean): CookieOptions {
  return {
    domain: env.COOKIE_DOMAIN,
    httpOnly,
    maxAge: maxAgeMs,
    path: '/',
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE
  };
}

function toMilliseconds(tokenDuration: string): number {
  const match = tokenDuration.match(/^(\d+)([smhd])$/);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const multipliers = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  } as const;
  const unit = match[2] as keyof typeof multipliers;

  return amount * multipliers[unit];
}

export function parseCookieHeader(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return headerValue
    .split(';')
    .map((cookieChunk) => cookieChunk.trim())
    .filter((cookieChunk) => cookieChunk.length > 0)
    .reduce<Record<string, string>>((cookies, cookieChunk) => {
      const separatorIndex = cookieChunk.indexOf('=');

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = cookieChunk.slice(0, separatorIndex).trim();
      const value = cookieChunk.slice(separatorIndex + 1).trim();

      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export function getCookieValue(req: Pick<Request, 'headers'>, cookieName: string): string | undefined {
  return parseCookieHeader(req.headers.cookie)[cookieName];
}

export function setAccessTokenCookie(res: Response, accessToken: string): void {
  res.cookie(
    env.AUTH_ACCESS_COOKIE_NAME,
    accessToken,
    buildCookieOptions(toMilliseconds(env.JWT_EXPIRES_IN), true)
  );
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(
    env.REFRESH_TOKEN_COOKIE_NAME,
    refreshToken,
    buildCookieOptions(toMilliseconds(env.REFRESH_TOKEN_EXPIRES_IN), true)
  );
}

export function setCsrfCookie(res: Response, csrfToken: string): void {
  res.cookie(env.CSRF_COOKIE_NAME, csrfToken, buildCookieOptions(toMilliseconds(env.REFRESH_TOKEN_EXPIRES_IN), false));
}

export function clearAuthCookies(res: Response): void {
  const clearOptions = {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    path: '/',
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE
  } as const;

  res.clearCookie(env.AUTH_ACCESS_COOKIE_NAME, clearOptions);
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, clearOptions);
  res.clearCookie(env.CSRF_COOKIE_NAME, {
    ...clearOptions,
    httpOnly: false
  });
}
