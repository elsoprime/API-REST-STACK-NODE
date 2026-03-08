import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { AuditLogModel } from '@/core/platform/audit/models/audit-log.model';
import { AuditOutboxModel } from '@/core/platform/audit/models/audit-outbox.model';
import { createAuditRouter } from '@/core/platform/audit/routes/audit.routes';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function createAuditIsolationApp() {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.AUDIT_BASE_PATH, createAuditRouter());
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('audit tenant isolation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('queries audit logs only for the tenant resolved from context', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const app = createAuditIsolationApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        traceId: 'trace-1',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: userId.toString(),
          scope: ['platform:self']
        },
        tenant: {
          tenantId,
          membershipId,
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
    vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValue(1 as never);
    vi.spyOn(AuditOutboxModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([])
        })
      })
    } as never);
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: userId,
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(findSpy).toHaveBeenCalledWith({
      scope: 'tenant',
      'tenant.tenantId': new Types.ObjectId(tenantId.toString())
    });
    expect(response.body.data.items[0].tenant.tenantId).toBe(tenantId.toString());
  });
});
