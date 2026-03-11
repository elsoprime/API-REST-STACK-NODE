import { Types } from 'mongoose';

import { AuditLogModel } from '@/core/platform/audit/models/audit-log.model';
import { AuditOutboxModel } from '@/core/platform/audit/models/audit-outbox.model';
import { AuditService } from '@/core/platform/audit/services/audit.service';

describe('audit delivery semantics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes directly to audit_logs when a transaction session is provided', async () => {
    const service = new AuditService();
    const auditId = new Types.ObjectId();
    const createAuditLog = vi.spyOn(AuditLogModel, 'create').mockResolvedValue([
      {
        toObject: () => ({
          _id: auditId,
          scope: 'platform',
          traceId: 'trace-atomic',
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
          createdAt: new Date('2026-03-08T14:00:00.000Z')
        })
      }
    ] as never);
    const outboxCreate = vi.spyOn(AuditOutboxModel, 'create');

    await service.record(
      {
        scope: 'platform',
        traceId: 'trace-atomic',
        actor: {
          kind: 'system',
          systemId: 'bootstrap',
          label: 'Bootstrap Seeder'
        },
        action: 'platform.settings.bootstrap',
        resource: {
          type: 'platform_settings',
          id: 'singleton'
        },
        severity: 'info'
      },
      {
        session: {} as never
      }
    );

    expect(createAuditLog).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith(
      [
        expect.not.objectContaining({
          sourceOutboxId: expect.anything()
        })
      ],
      {
        session: expect.any(Object)
      }
    );
    expect(outboxCreate).not.toHaveBeenCalled();
  });

  it('falls back to durable outbox when direct delivery cannot materialize the audit log immediately', async () => {
    const service = new AuditService();
    const outboxId = new Types.ObjectId();
    const outboxSave = vi.fn().mockResolvedValue(undefined);
    const outboxEntry = {
      _id: outboxId,
      createdAt: new Date('2026-03-08T15:00:00.000Z'),
      scope: 'platform' as const,
      traceId: 'trace-outbox',
      actor: {
        kind: 'system' as const,
        systemId: 'bootstrap',
        label: 'Bootstrap Seeder'
      },
      tenant: null,
      action: 'platform.settings.bootstrap',
      resource: {
        type: 'platform_settings',
        id: 'singleton',
        label: null
      },
      severity: 'warning' as const,
      changes: null,
      metadata: null,
      delivery: {
        status: 'pending' as const,
        attempts: 0,
        auditLogId: null,
        deliveredAt: null,
        lastError: null
      },
      save: outboxSave
    };

    vi.spyOn(AuditOutboxModel, 'create').mockResolvedValue([outboxEntry] as never);
    vi.spyOn(AuditOutboxModel, 'findById').mockResolvedValue(outboxEntry as never);
    vi.spyOn(AuditLogModel, 'create').mockRejectedValue(new Error('temporary audit write failure'));
    vi.spyOn(AuditLogModel, 'findOne').mockResolvedValue(null as never);

    const result = await service.record({
      scope: 'platform',
      traceId: 'trace-outbox',
      actor: {
        kind: 'system',
        systemId: 'bootstrap',
        label: 'Bootstrap Seeder'
      },
      action: 'platform.settings.bootstrap',
      resource: {
        type: 'platform_settings',
        id: 'singleton'
      },
      severity: 'warning'
    });

    expect(result).toMatchObject({
      id: outboxId.toString(),
      scope: 'platform',
      action: 'platform.settings.bootstrap'
    });
    expect(AuditLogModel.create).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceOutboxId: outboxId
      })
    ]);
    expect(outboxSave).toHaveBeenCalled();
  });
});
