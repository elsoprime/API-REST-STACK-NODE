interface CrmContactDedupInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface CrmOrganizationDedupInput {
  name: string;
  domain?: string | null;
}

export interface CrmContactDedupKeys {
  normalizedFullName: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  dedupFallbackKey: string | null;
}

export interface CrmOrganizationDedupKeys {
  normalizedName: string;
  normalizedDomain: string | null;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeName(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeEmail(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeDomain(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d]/g, '');

  return digits.length > 0 ? digits : '';
}

export class CrmDedupService {
  buildContactKeys(input: CrmContactDedupInput): CrmContactDedupKeys {
    const normalizedFullName = `${normalizeName(input.firstName)} ${normalizeName(input.lastName)}`;
    const normalizedEmail =
      typeof input.email === 'string' && input.email.trim().length > 0
        ? normalizeEmail(input.email)
        : null;
    const normalizedPhone =
      typeof input.phone === 'string' && input.phone.trim().length > 0
        ? normalizePhone(input.phone)
        : null;
    const dedupFallbackKey =
      normalizedEmail === null && normalizedPhone
        ? `${normalizedFullName}|${normalizedPhone}`
        : null;

    return {
      normalizedFullName,
      normalizedEmail,
      normalizedPhone,
      dedupFallbackKey
    };
  }

  buildOrganizationKeys(input: CrmOrganizationDedupInput): CrmOrganizationDedupKeys {
    const normalizedName = normalizeName(input.name);
    const normalizedDomain =
      typeof input.domain === 'string' && input.domain.trim().length > 0
        ? normalizeDomain(input.domain)
        : null;

    return {
      normalizedName,
      normalizedDomain
    };
  }
}

export const crmDedupService = new CrmDedupService();
