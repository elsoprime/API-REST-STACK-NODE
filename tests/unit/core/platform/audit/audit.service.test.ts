import { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { AuditLogModel } from '@/core/platform/audit/models/audit-log.model';
import { AuditOutboxModel } from '@/core/platform/audit/models/audit-outbox.model';
import { AuditService } from '@/core/platform/audit/services/audit.service';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

describe('AuditService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records immutable audit logs with redacted sensitive fields', async () => {
    const service = new AuditService();
    const auditId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();

    const createSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue([
      {
        toObject: () => ({
          _id: auditId,
          scope: 'tenant',
          traceId: 'trace-1',
          actor: {
            kind: 'user',
            userId: '507f1f77bcf86cd799439010',
            sessionId: '507f1f77bcf86cd799439011',
            scope: ['platform:self']
          },
          tenant: {
            tenantId,
            membershipId,
            roleKey: 'tenant:owner',
            isOwner: true,
            effectiveRoleKeys: ['tenant:owner']
          },
          action: 'tenant.ownership.transfer',
          resource: {
            type: 'tenant',
            id: tenantId.toString()
          },
          severity: 'critical',
          changes: {
            before: {
              password: '[Redacted]'
            },
            after: {
              refreshToken: '[Redacted]'
            },
            fields: ['ownerUserId']
          },
          metadata: {
            secret: '[Redacted]'
          },
          createdAt: new Date('2026-03-08T12:00:00.000Z')
        })
      }
    ] as never);

    const result = await service.record({
      traceId: 'trace-1',
      scope: 'tenant',
      actor: {
        kind: 'user',
        userId: '507f1f77bcf86cd799439010',
        sessionId: '507f1f77bcf86cd799439011',
        scope: ['platform:self']
      },
      tenant: {
        tenantId: tenantId.toString(),
        membershipId: membershipId.toString(),
        roleKey: 'tenant:owner',
        isOwner: true,
        effectiveRoleKeys: ['tenant:owner']
      },
      action: 'tenant.ownership.transfer',
      resource: {
        type: 'tenant',
        id: tenantId.toString()
      },
      severity: 'critical',
      changes: {
        before: {
          password: 'plain'
        },
        after: {
          refreshToken: 'token-1'
        },
        fields: ['ownerUserId']
      },
      metadata: {
        secret: 'value'
      }
    }, {
      session: {} as never
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          changes: {
            before: {
              password: '[Redacted]'
            },
            after: {
              refreshToken: '[Redacted]'
            },
            fields: ['ownerUserId']
          },
          metadata: {
            secret: '[Redacted]'
          }
        })
      ]),
      {
        session: expect.anything()
      }
    );
    expect(result).toMatchObject({
      id: auditId.toString(),
      scope: 'tenant',
      action: 'tenant.ownership.transfer',
      severity: 'critical'
    });
  });

  it('serializes complex payloads before redaction and persistence', async () => {
    const service = new AuditService();
    const auditId = new Types.ObjectId();
    const modelId = new Types.ObjectId();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const createSpy = vi.spyOn(AuditLogModel, 'create').mockResolvedValue([
      {
        toObject: () => ({
          _id: auditId,
          scope: 'platform',
          traceId: 'trace-serialization',
          actor: {
            kind: 'system',
            systemId: 'audit-worker',
            label: 'Audit Worker'
          },
          action: 'platform.settings.rotate_secret',
          resource: {
            type: 'platform_settings',
            id: 'singleton'
          },
          severity: 'warning',
          createdAt: new Date('2026-03-10T14:00:00.000Z')
        })
      }
    ] as never);

    await service.record(
      {
        traceId: ' trace-serialization ',
        scope: 'platform',
        actor: {
          kind: 'system',
          systemId: 'audit-worker',
          label: 'Audit Worker'
        },
        action: ' platform.settings.rotate_secret ',
        resource: {
          type: ' platform_settings ',
          id: ' singleton '
        },
        severity: 'warning',
        changes: {
          before: {
            token: 'raw-token',
            batchId: modelId as never,
            seenAt: new Date('2026-03-10T13:59:59.000Z') as never
          },
          fields: ['token', 'token', ' seenAt ', '']
        } as never,
        metadata: {
          modelId: modelId as never,
          generatedAt: new Date('2026-03-10T14:00:00.000Z') as never,
          maxRetries: BigInt(3) as never,
          apiKey: 'super-secret',
          cycle: cycle as never
        } as never
      },
      {
        session: {} as never
      }
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          traceId: 'trace-serialization',
          action: 'platform.settings.rotate_secret',
          resource: {
            type: 'platform_settings',
            id: 'singleton',
            label: null
          },
          changes: {
            before: {
              token: '[Redacted]',
              batchId: modelId.toString(),
              seenAt: '2026-03-10T13:59:59.000Z'
            },
            after: null,
            fields: ['token', 'seenAt']
          },
          metadata: {
            modelId: modelId.toString(),
            generatedAt: '2026-03-10T14:00:00.000Z',
            maxRetries: '3',
            apiKey: '[Redacted]',
            cycle: {
              self: '[Circular]'
            }
          }
        })
      ]),
      {
        session: expect.anything()
      }
    );
  });

  it('fails closed when audit scope and tenant context are inconsistent', async () => {
    const service = new AuditService();

    await expect(
      service.record({
        traceId: 'trace-scope-tenant',
        scope: 'tenant',
        actor: {
          kind: 'system',
          systemId: 'audit-worker',
          label: 'Audit Worker'
        },
        action: 'tenant.settings.update',
        resource: {
          type: 'tenant_settings',
          id: 'singleton'
        },
        severity: 'warning'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.record({
        traceId: 'trace-scope-platform',
        scope: 'platform',
        actor: {
          kind: 'system',
          systemId: 'audit-worker',
          label: 'Audit Worker'
        },
        tenant: {
          tenantId: new Types.ObjectId().toString()
        },
        action: 'platform.settings.update',
        resource: {
          type: 'platform_settings',
          id: 'singleton'
        },
        severity: 'warning'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });
  });

  it('lists audit logs filtered by tenant and pagination', async () => {
    const service = new AuditService();
    const tenantId = new Types.ObjectId();
    vi.spyOn(AuditOutboxModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })
    } as never);
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        scope: 'tenant',
        traceId: 'trace-2',
        actor: {
          kind: 'user',
          userId: '507f1f77bcf86cd799439010',
          sessionId: '507f1f77bcf86cd799439011',
          scope: ['platform:self']
        },
        tenant: {
          tenantId,
          membershipId: new Types.ObjectId(),
          roleKey: 'tenant:owner',
          isOwner: true,
          effectiveRoleKeys: ['tenant:owner']
        },
        action: 'tenant.create',
        resource: {
          type: 'tenant',
          id: tenantId.toString()
        },
        severity: 'info',
        createdAt: new Date('2026-03-08T12:00:00.000Z')
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    const findSpy = vi.spyOn(AuditLogModel, 'find').mockReturnValue({ sort } as never);
    const countSpy = vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.list({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 20,
      action: 'tenant.create'
    });

    expect(findSpy).toHaveBeenCalledWith({
      scope: 'tenant',
      'tenant.tenantId': new Types.ObjectId(tenantId.toString()),
      action: 'tenant.create'
    });
    expect(countSpy).toHaveBeenCalledWith({
      scope: 'tenant',
      'tenant.tenantId': new Types.ObjectId(tenantId.toString()),
      action: 'tenant.create'
    });
    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      total: 1
    });
    expect(result.items).toHaveLength(1);
  });

  it('lists platform-scoped audit logs without assuming tenant scope', async () => {
    const service = new AuditService();
    vi.spyOn(AuditOutboxModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })
    } as never);
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        scope: 'platform',
        traceId: 'trace-3',
        actor: {
          kind: 'system',
          systemId: 'bootstrap',
          label: 'Bootstrap Seeder'
        },
        tenant: null,
        action: 'platform.settings.bootstrap',
        resource: {
          type: 'platform_settings',
          id: 'singleton'
        },
        severity: 'info',
        createdAt: new Date('2026-03-08T13:00:00.000Z')
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    const findSpy = vi.spyOn(AuditLogModel, 'find').mockReturnValue({ sort } as never);
    const countSpy = vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.listPlatform({
      page: 1,
      limit: 20,
      action: 'platform.settings.bootstrap'
    });

    expect(findSpy).toHaveBeenCalledWith({
      scope: 'platform',
      action: 'platform.settings.bootstrap'
    });
    expect(countSpy).toHaveBeenCalledWith({
      scope: 'platform',
      action: 'platform.settings.bootstrap'
    });
    expect(result.items[0]).toMatchObject({
      scope: 'platform',
      action: 'platform.settings.bootstrap'
    });
  });
});
