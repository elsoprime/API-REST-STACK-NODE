import { redactAuditChanges } from '@/core/platform/audit/policies/audit-redaction.policy';

describe('hr privacy redaction', () => {
  it('redacts salaryAmount in audit changes payloads', () => {
    expect(
      redactAuditChanges({
        before: {
          salaryAmount: 90000,
          currency: 'USD',
          nested: {
            salaryAmount: 80000
          }
        },
        after: {
          salaryAmount: 110000,
          currency: 'USD',
          nested: {
            salaryAmount: 100000
          }
        },
        fields: ['salaryAmount', 'currency']
      })
    ).toEqual({
      before: {
        salaryAmount: '[Redacted]',
        currency: 'USD',
        nested: {
          salaryAmount: '[Redacted]'
        }
      },
      after: {
        salaryAmount: '[Redacted]',
        currency: 'USD',
        nested: {
          salaryAmount: '[Redacted]'
        }
      },
      fields: ['salaryAmount', 'currency']
    });
  });
});
