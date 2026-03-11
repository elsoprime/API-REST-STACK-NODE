import { Router } from 'express';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
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

function createTenantHeaderContractApp() {
  const service = {
    createTenant: vi.fn().mockResolvedValue(fakeTenantResult),
    listMyTenants: vi.fn().mockResolvedValue({
      items: []
    }),
    switchActiveTenant: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      accessToken: 'tenant-access-token'
    }),
    createInvitation: vi.fn().mockResolvedValue({
      invitation: {
        id: 'invitation-1',
        tenantId: fakeTenantResult.tenant.id,
        email: 'member@example.com',
        roleKey: 'tenant:member',
        status: 'pending' as const,
        expiresAt: '2026-03-14T00:00:00.000Z'
      }
    }),
    acceptInvitation: vi.fn().mockResolvedValue(fakeTenantResult),
    revokeInvitation: vi.fn().mockResolvedValue({
      invitation: {
        id: 'invitation-1',
        tenantId: fakeTenantResult.tenant.id,
        email: 'member@example.com',
        roleKey: 'tenant:member',
        status: 'revoked' as const,
        expiresAt: '2026-03-14T00:00:00.000Z'
      }
    }),
    transferOwnership: vi.fn(),
    assignSubscription: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      subscription: {
        planId: 'plan:growth',
        activeModuleKeys: ['inventory', 'crm', 'hr'],
        status: 'activated' as const
      }
    }),
    cancelSubscription: vi.fn().mockResolvedValue({
      ...fakeTenantResult,
      subscription: {
        planId: null,
        activeModuleKeys: [],
        status: 'canceled' as const
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

describe('tenant header enforcement contract', () => {
  const userId = '507f1f77bcf86cd799439010';

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

  it('requires X-Tenant-Id on tenant-scoped invitation creation', async () => {
    const { app, service } = createTenantHeaderContractApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: userId,
      scope: ['platform:self']
    });

    const response = await request(app)
      .post('/api/v1/tenant/invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: 'member@example.com'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.createInvitation).not.toHaveBeenCalled();
  });

  it('requires X-Tenant-Id on tenant-scoped invitation revocation', async () => {
    const { app, service } = createTenantHeaderContractApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: userId,
      scope: ['platform:self']
    });

    const response = await request(app)
      .post('/api/v1/tenant/invitations/revoke')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        invitationId: '507f1f77bcf86cd799439012'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.revokeInvitation).not.toHaveBeenCalled();
  });

  it('requires X-Tenant-Id on tenant-scoped ownership transfer', async () => {
    const { app, service } = createTenantHeaderContractApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: userId,
      scope: ['platform:self']
    });

    const response = await request(app)
      .post('/api/v1/tenant/transfer-ownership')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        targetUserId: '507f1f77bcf86cd799439013'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.transferOwnership).not.toHaveBeenCalled();
  });

  it('requires X-Tenant-Id on tenant-scoped subscription assignment', async () => {
    const { app, service } = createTenantHeaderContractApp();
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: userId,
      scope: ['platform:self']
    });

    const response = await request(app)
      .patch('/api/v1/tenant/subscription')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planId: 'plan:growth'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.assignSubscription).not.toHaveBeenCalled();
  });
});
