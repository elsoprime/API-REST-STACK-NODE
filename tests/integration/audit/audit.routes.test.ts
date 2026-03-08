import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createAuditRouter } from '@/core/platform/audit/routes/audit.routes';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function createAuditTestApp(service: {
  list: ReturnType<typeof vi.fn>;
}) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.AUDIT_BASE_PATH, createAuditRouter(service as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('audit routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists tenant-scoped audit logs with paginated success envelope', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      list: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Types.ObjectId().toString(),
            traceId: 'trace-1',
            actor: {
              kind: 'user',
              userId: userId.toString(),
              sessionId: userId.toString(),
              scope: ['platform:self']
            },
            tenant: {
              tenantId: tenantId.toString(),
              membershipId: membershipId.toString(),
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
            createdAt: '2026-03-08T12:00:00.000Z'
          }
        ],
        page: 1,
        limit: 20,
        total: 1
      })
    };
    const app = createAuditTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

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
      .get('/api/v1/audit?page=1&limit=20&action=tenant.create')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 20,
      action: 'tenant.create',
      resourceType: undefined,
      severity: undefined,
      actorKind: undefined,
      from: undefined,
      to: undefined
    });
    expect(response.body).toMatchObject({
      success: true,
      data: {
        items: [
          {
            action: 'tenant.create'
          }
        ]
      },
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      }
    });
  });

  it('denies audit access when the membership lacks the required permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      list: vi.fn()
    };
    const app = createAuditTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: userId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.list).not.toHaveBeenCalled();
  });
});
