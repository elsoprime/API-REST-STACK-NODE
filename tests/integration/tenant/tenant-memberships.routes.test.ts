import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createTenantMembershipsRouter } from '@/core/tenant/memberships/routes/tenant-memberships.routes';

function createTenantMembershipsTestApp(service: {
  listMemberships: ReturnType<typeof vi.fn>;
  updateMembership: ReturnType<typeof vi.fn>;
  deleteMembership: ReturnType<typeof vi.fn>;
}) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(`${APP_CONFIG.TENANT_BASE_PATH}/memberships`, createTenantMembershipsRouter(service as never));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant memberships routes', () => {
  beforeEach(() => {
    vi.spyOn(AuthSessionModel, 'findById').mockImplementation(async (sessionId: string) => ({
      _id: sessionId,
      userId: sessionId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists memberships through the success envelope', async () => {
    const userId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const service = {
      listMemberships: vi.fn().mockResolvedValue({
        items: [
          {
            membershipId: new Types.ObjectId().toString(),
            userId: new Types.ObjectId().toString(),
            fullName: 'John Doe',
            email: 'john@example.com',
            roleKey: 'tenant:member',
            status: 'active',
            joinedAt: '2026-03-01T00:00:00.000Z',
            createdAt: '2026-03-01T00:00:00.000Z',
            isEffectiveOwner: false
          }
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      }),
      updateMembership: vi.fn(),
      deleteMembership: vi.fn()
    };
    const app = createTenantMembershipsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: 'tenant:admin'
    } as never);

    const response = await request(app)
      .get('/api/v1/tenant/memberships?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listMemberships).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        page: 1,
        limit: 10
      })
    );
    expect(response.body.data.total).toBe(1);
  });

  it('updates memberships through PATCH with bearer auth', async () => {
    const userId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const service = {
      listMemberships: vi.fn(),
      updateMembership: vi.fn().mockResolvedValue({
        membershipId: membershipId.toString(),
        userId: new Types.ObjectId().toString(),
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        roleKey: 'tenant:admin',
        status: 'active',
        joinedAt: '2026-03-01T00:00:00.000Z',
        createdAt: '2026-03-01T00:00:00.000Z',
        isEffectiveOwner: false
      }),
      deleteMembership: vi.fn()
    };
    const app = createTenantMembershipsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: userId,
      planId: 'plan:growth',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .patch(`/api/v1/tenant/memberships/${membershipId.toString()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        roleKey: 'tenant:admin'
      });

    expect(response.status).toBe(200);
    expect(service.updateMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        membershipId: membershipId.toString(),
        patch: {
          roleKey: 'tenant:admin'
        }
      })
    );
  });

  it('requires CSRF for cookie-authenticated membership deletion', async () => {
    const userId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const service = {
      listMemberships: vi.fn(),
      updateMembership: vi.fn(),
      deleteMembership: vi.fn()
    };
    const app = createTenantMembershipsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    const response = await request(app)
      .delete(`/api/v1/tenant/memberships/${membershipId.toString()}`)
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
    expect(service.deleteMembership).not.toHaveBeenCalled();
  });

  it('denies membership deletion when the actor only has tenant member permissions', async () => {
    const userId = new Types.ObjectId();
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const service = {
      listMemberships: vi.fn(),
      updateMembership: vi.fn(),
      deleteMembership: vi.fn()
    };
    const app = createTenantMembershipsTestApp(service);
    const accessToken = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .delete(`/api/v1/tenant/memberships/${membershipId.toString()}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.deleteMembership).not.toHaveBeenCalled();
  });
});
