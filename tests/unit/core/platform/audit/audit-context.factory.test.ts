import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';

describe('audit context factory', () => {
  it('builds an audit context from execution context and explicit action metadata', () => {
    expect(
      auditContextFactory.create({
        executionContext: {
          traceId: 'trace-1',
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
            effectiveRoleKeys: ['tenant:owner']
          }
        },
        action: 'tenant.create',
        resource: {
          type: 'tenant',
          id: '507f1f77bcf86cd799439012'
        },
        severity: 'info',
        changes: {
          after: {
            slug: 'acme'
          }
        }
      })
    ).toEqual({
      scope: 'tenant',
      traceId: 'trace-1',
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
        effectiveRoleKeys: ['tenant:owner']
      },
      action: 'tenant.create',
      resource: {
        type: 'tenant',
        id: '507f1f77bcf86cd799439012'
      },
      severity: 'info',
      changes: {
        after: {
          slug: 'acme'
        }
      }
    });
  });

  it('falls back to a controlled unknown actor when execution context is absent', () => {
    expect(
      auditContextFactory.create({
        action: 'auth.refresh',
        resource: {
          type: 'auth_session',
          id: '507f1f77bcf86cd799439011'
        }
      })
    ).toEqual({
      scope: 'platform',
      traceId: 'unknown',
      actor: {
        kind: 'unknown',
        reason: 'internal_unresolved'
      },
      action: 'auth.refresh',
      resource: {
        type: 'auth_session',
        id: '507f1f77bcf86cd799439011'
      },
      severity: 'info'
    });
  });
});
