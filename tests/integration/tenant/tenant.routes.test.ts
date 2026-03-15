import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';

const fakeTenantResult = {
  tenant: {
    id: 'tenant-1',
    name: 'Acme',
    slug: 'acme',
    status: 'active' as const,
    ownerUserId: '507f1f77bcf86cd799439010',
    planId: null,
    activeModuleKeys: [],
    memberLimit: null
  },
  membership: {
    id: 'membership-1',
    tenantId: 'tenant-1',
    userId: '507f1f77bcf86cd799439010',
    roleKey: 'tenant:owner',
    status: 'active' as const
  }
};

function createTenantTestApp() {
  const service = {
    createTenant: vi.fn().mockResolvedValue(fakeTenantResult),
    listMyTenants: vi.fn().mockResolvedValue({
      items: [
        {
          ...fakeTenantResult,
          isActive: false
        }
      ]
    }),
    switchActiveTenant: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      accessToken: 'tenant-access-token'
    }),
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    transferOwnership: vi.fn().mockResolvedValue(fakeTenantResult),
    assignSubscription: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      subscription: {
        planId: 'plan:growth',
        activeModuleKeys: ['inventory', 'crm', 'hr'],
        status: 'activated' as const,
        lifecycleStatus: 'active' as const
      }
    }),
    cancelSubscription: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      subscription: {
        planId: null,
        activeModuleKeys: [],
        status: 'canceled' as const,
        lifecycleStatus: 'canceled' as const
      }
    })
  };
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, createTenantRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return {
    app: createServer({
      rootRouterOverride: rootRouter
    }),
    service
  };
}

describe('tenant routes', () => {
  const authenticatedUserId = '507f1f77bcf86cd799439010';
  const authenticatedSessionId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: authenticatedSessionId,
      userId: authenticatedUserId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a tenant using the success envelope', async () => {
    const { app, service } = createTenantTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/tenant')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Acme'
      });

    expect(response.status).toBe(201);
    expect(service.createTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        name: 'Acme',
        slug: undefined
      })
    );
    expect(response.body.data.tenant).toMatchObject({
      slug: 'acme'
    });
  });

  it('lists the tenants available to the authenticated user', async () => {
    const { app, service } = createTenantTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .get('/api/v1/tenant/mine')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(service.listMyTenants).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        sessionId: authenticatedSessionId
      })
    );
    expect(response.body.data.items).toHaveLength(1);
  });

  it('returns an updated access token in the body for headless tenant switch', async () => {
    const { app, service } = createTenantTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/tenant/switch')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        tenantId: '507f1f77bcf86cd799439011'
      });

    expect(response.status).toBe(200);
    expect(service.switchActiveTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        sessionId: authenticatedSessionId,
        tenantId: '507f1f77bcf86cd799439011',
        scope: ['platform:self']
      })
    );
    expect(response.body.data.accessToken).toBe('tenant-access-token');
  });

  it('sets the updated access token as cookie for browser tenant switch', async () => {
    const { app } = createTenantTestApp();
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/tenant/switch')
      .set(
        'Cookie',
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}; ${process.env.CSRF_COOKIE_NAME}=csrf-token`
      )
      .set(APP_CONFIG.CSRF_HEADER, 'csrf-token')
      .send({
        tenantId: '507f1f77bcf86cd799439011'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeUndefined();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${process.env.AUTH_ACCESS_COOKIE_NAME}=tenant-access-token`)
      ])
    );
  });

  it('transfers tenant ownership inside the tenant context', async () => {
    const { app, service } = createTenantTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const accessToken = tokenService.signAccessToken({
      sub: '507f1f77bcf86cd799439010',
      sid: '507f1f77bcf86cd799439011',
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId('507f1f77bcf86cd799439010')
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId('507f1f77bcf86cd799439010'),
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/transfer-ownership')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString())
      .send({
        targetUserId: '507f1f77bcf86cd799439012'
      });

    expect(response.status).toBe(200);
    expect(service.transferOwnership).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '507f1f77bcf86cd799439010',
        tenantId: fakeTenantId.toString(),
        targetUserId: '507f1f77bcf86cd799439012'
      })
    );
  });

  it('assigns tenant subscription plan inside tenant context', async () => {
    const { app, service } = createTenantTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId(authenticatedUserId),
      planId: null,
      activeModuleKeys: []
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(authenticatedUserId),
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .patch('/api/v1/tenant/subscription')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString())
      .send({
        planId: 'plan:growth',
        checkoutSessionId: '507f1f77bcf86cd799439091'
      });

    expect(response.status).toBe(200);
    expect(service.assignSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        tenantId: fakeTenantId.toString(),
        planId: 'plan:growth',
        checkoutSessionId: '507f1f77bcf86cd799439091'
      })
    );
    expect(response.body.data.subscription.status).toBe('activated');
  });

  it('cancels tenant subscription plan inside tenant context', async () => {
    const { app, service } = createTenantTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const accessToken = tokenService.signAccessToken({
      sub: authenticatedUserId,
      sid: authenticatedSessionId,
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      subscriptionStatus: 'active',
      ownerUserId: new Types.ObjectId(authenticatedUserId),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm', 'hr']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(authenticatedUserId),
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .delete('/api/v1/tenant/subscription')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString());

    expect(response.status).toBe(200);
    expect(service.cancelSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authenticatedUserId,
        tenantId: fakeTenantId.toString()
      })
    );
    expect(response.body.data.subscription.status).toBe('canceled');
  });
});



