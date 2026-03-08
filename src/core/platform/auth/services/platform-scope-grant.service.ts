import { env } from '@/config/env';
import { AUTH_SCOPES, type AuthScope } from '@/constants/security';

function normalizeEmails(rawValue: string): string[] {
  return [...new Set(
    rawValue
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  )];
}

export interface PlatformScopeGrantServiceContract {
  resolveScopesForEmail: (email: string) => AuthScope[];
}

export class PlatformScopeGrantService implements PlatformScopeGrantServiceContract {
  constructor(private readonly platformAdminEmails: string[] = normalizeEmails(env.PLATFORM_ADMIN_EMAILS)) {}

  resolveScopesForEmail(email: string): AuthScope[] {
    const normalizedEmail = email.trim().toLowerCase();

    if (!this.platformAdminEmails.includes(normalizedEmail)) {
      return [AUTH_SCOPES.PLATFORM_SELF];
    }

    return [
      AUTH_SCOPES.PLATFORM_SELF,
      AUTH_SCOPES.PLATFORM_SETTINGS_READ,
      AUTH_SCOPES.PLATFORM_SETTINGS_UPDATE,
      AUTH_SCOPES.PLATFORM_AUDIT_READ
    ];
  }
}

export const platformScopeGrantService = new PlatformScopeGrantService();
