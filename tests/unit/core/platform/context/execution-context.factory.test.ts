import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';

describe('execution context factory', () => {
  it('builds a controlled unknown actor context when no auth is available', () => {
    expect(
      createExecutionContext({
        traceId: 'trace-1'
      })
    ).toEqual({
      traceId: 'trace-1',
      actor: {
        kind: 'unknown',
        reason: 'http_unauthenticated'
      }
    });
  });

  it('builds a user actor with tenant scope when auth and tenant data are available', () => {
    expect(
      createExecutionContext({
        traceId: 'trace-2',
        auth: {
          userId: '507f1f77bcf86cd799439010',
          sessionId: '507f1f77bcf86cd799439011',
          scope: ['platform:self'],
          tenantId: '507f1f77bcf86cd799439012',
          membershipId: '507f1f77bcf86cd799439013'
        },
        tenant: {
          tenantId: '507f1f77bcf86cd799439012',
          membershipId: '507f1f77bcf86cd799439013',
          roleKey: 'tenant:owner',
          authorization: {
            isOwner: true,
            effectiveRoleKeys: ['tenant:owner', 'tenant:auditor']
          }
        }
      })
    ).toEqual({
      traceId: 'trace-2',
      actor: {
        kind: 'user',
        userId: '507f1f77bcf86cd799439010',
        sessionId: '507f1f77bcf86cd799439011',
        scope: ['platform:self']
      },
      tenant: {
        tenantId: '507f1f77bcf86cd799439012',
        membershipId: '507f1f77bcf86cd799439013',
        roleKey: 'tenant:owner',
        isOwner: true,
        effectiveRoleKeys: ['tenant:owner', 'tenant:auditor']
      }
    });
  });
});
