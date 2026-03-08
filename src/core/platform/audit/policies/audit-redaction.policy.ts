import {
  type AuditChanges,
  type AuditJsonObject,
  type AuditJsonValue
} from '@/core/platform/audit/types/audit.types';

const REDACTED_VALUE = '[Redacted]';

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'clientSecret',
  'webhookSecret',
  'accessToken',
  'accessKey',
  'refreshToken',
  'csrfToken',
  'recoveryCode',
  'apiKey',
  'taxId',
  'documentNumber',
  'nationalId',
  'ssn',
  'privateKey',
  'smtpPassword',
  'otpauthUrl',
  'cookie',
  'authorization',
  'salaryAmount',
  'baseSalary',
  'grossSalary',
  'netSalary',
  'compensation',
  'bankAccount',
  'iban',
  'swift',
  'personalEmail',
  'phone'
]);

const SENSITIVE_FIELD_PATTERNS = [
  /secret/i,
  /token/i,
  /password/i,
  /hash/i,
  /taxid/i,
  /salary/i,
  /compensation/i,
  /document/i,
  /ssn/i,
  /bank/i,
  /iban/i,
  /swift/i,
  /accesskey/i,
  /apikey/i,
  /privatekey/i
];

function isAuditJsonObject(value: AuditJsonValue | undefined | null): value is AuditJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(key) || SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

function redactAuditValue(value: AuditJsonValue): AuditJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }

  if (!isAuditJsonObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<AuditJsonObject>((accumulator, [key, currentValue]) => {
    if (shouldRedactKey(key)) {
      accumulator[key] = REDACTED_VALUE;
      return accumulator;
    }

    accumulator[key] = redactAuditValue(currentValue);
    return accumulator;
  }, {});
}

function redactAuditObject(value: AuditJsonObject | null | undefined): AuditJsonObject | null | undefined {
  if (!value) {
    return value;
  }

  return redactAuditValue(value) as AuditJsonObject;
}

export function redactAuditChanges(changes?: AuditChanges): AuditChanges | undefined {
  if (!changes) {
    return undefined;
  }

  const redactedChanges: AuditChanges = {};

  if (typeof changes.before !== 'undefined') {
    redactedChanges.before = redactAuditObject(changes.before);
  }

  if (typeof changes.after !== 'undefined') {
    redactedChanges.after = redactAuditObject(changes.after);
  }

  if (changes.fields) {
    redactedChanges.fields = [...changes.fields];
  }

  return redactedChanges;
}

export function redactAuditMetadata(metadata?: AuditJsonObject): AuditJsonObject | undefined {
  return redactAuditObject(metadata) ?? undefined;
}
