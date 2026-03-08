export const RATE_LIMITER_PROFILES = {
  GLOBAL: 'global',
  AUTH: 'auth',
  SENSITIVE: 'sensitive'
} as const;

export type RateLimiterProfile =
  (typeof RATE_LIMITER_PROFILES)[keyof typeof RATE_LIMITER_PROFILES];

export const AUTH_SCOPES = {
  PLATFORM_SELF: 'platform:self',
  PLATFORM_SETTINGS_READ: 'platform:settings:read',
  PLATFORM_SETTINGS_UPDATE: 'platform:settings:update',
  PLATFORM_AUDIT_READ: 'platform:audit:read'
} as const;

export type AuthScope = (typeof AUTH_SCOPES)[keyof typeof AUTH_SCOPES];

export const AUTH_SESSION_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked'
} as const;

export type AuthSessionStatus =
  (typeof AUTH_SESSION_STATUS)[keyof typeof AUTH_SESSION_STATUS];

export const AUTH_SECURITY_POLICY = {
  EMAIL_VERIFICATION_TOKEN_TTL_MS: 86_400_000,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_WINDOW_MS: 900_000,
  TOTP_DIGITS: 6,
  TOTP_PERIOD_SECONDS: 30,
  TOTP_ALLOWED_WINDOW_STEPS: 1,
  RECOVERY_CODES_COUNT: 8
} as const;
