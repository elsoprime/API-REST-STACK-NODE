import { Types } from 'mongoose';

import { AuditLogModel } from '@/core/platform/audit/models/audit-log.model';
import { AuditOutboxModel } from '@/core/platform/audit/models/audit-outbox.model';
import { AuditService } from '@/core/platform/audit/services/audit.service';

describe('audit platform scope', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists only platform-scoped audit logs for future settings flows', async () => {
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
        traceId: 'trace-platform',
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
        createdAt: new Date('2026-03-08T16:00:00.000Z')
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    const findSpy = vi.spyOn(AuditLogModel, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.listPlatform({
      page: 1,
      limit: 20
    });

    expect(findSpy).toHaveBeenCalledWith({
      scope: 'platform'
    });
    expect(result.items[0]).toMatchObject({
      scope: 'platform',
      action: 'platform.settings.bootstrap'
    });
  });
});
