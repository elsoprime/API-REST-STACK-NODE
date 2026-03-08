import { redactAuditMetadata } from '@/core/platform/audit/policies/audit-redaction.policy';

describe('audit redaction extended policy', () => {
  it('redacts settings and operational secrets by exact key and by pattern', () => {
    expect(
      redactAuditMetadata({
        apiKey: 'api-key-value',
        smtpPassword: 'smtp-password',
        taxId: '76.123.456-7',
        nested: {
          webhookSecret: 'webhook-secret',
          tokenHash: 'hash-value',
          clientSecret: 'client-secret',
          privateKey: 'private-key',
          passwordHash: 'password-hash',
          billingAccessKey: 'billing-key'
        }
      })
    ).toEqual({
      apiKey: '[Redacted]',
      smtpPassword: '[Redacted]',
      taxId: '[Redacted]',
      nested: {
        webhookSecret: '[Redacted]',
        tokenHash: '[Redacted]',
        clientSecret: '[Redacted]',
        privateKey: '[Redacted]',
        passwordHash: '[Redacted]',
        billingAccessKey: '[Redacted]'
      }
    });
  });
});
