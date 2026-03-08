import {
  redactAuditChanges,
  redactAuditMetadata
} from '@/core/platform/audit/policies/audit-redaction.policy';

describe('audit redaction policy', () => {
  it('redacts sensitive keys recursively in before and after payloads', () => {
    expect(
      redactAuditChanges({
        before: {
          password: 'plain',
          nested: {
            refreshToken: 'token-1'
          }
        },
        after: {
          profile: {
            recoveryCode: 'code-1'
          },
          ok: true
        },
        fields: ['password', 'profile']
      })
    ).toEqual({
      before: {
        password: '[Redacted]',
        nested: {
          refreshToken: '[Redacted]'
        }
      },
      after: {
        profile: {
          recoveryCode: '[Redacted]'
        },
        ok: true
      },
      fields: ['password', 'profile']
    });
  });

  it('redacts metadata with the same policy', () => {
    expect(
      redactAuditMetadata({
        otpauthUrl: 'otpauth://secret',
        nested: {
          secret: 'value'
        }
      })
    ).toEqual({
      otpauthUrl: '[Redacted]',
      nested: {
        secret: '[Redacted]'
      }
    });
  });
});
