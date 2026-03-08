import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

const fakeInvitationResult = {
  invitation: {
    id: 'invitation-1',
    tenantId: '507f1f77bcf86cd799439011',
    email: 'member@example.com',
    roleKey: 'tenant:member',
    status: 'pending' as const,
    expiresAt: '2026-03-14T00:00:00.000Z'
  }
};

const fakeAcceptanceResult = {
  tenant: {
    id: '507f1f77bcf86cd799439011',
    name: 'Acme',
    slug: 'acme',
    status: 'active' as const,
    ownerUserId: '507f1f77bcf86cd799439010',
    planId: null,
    activeModuleKeys: [],
    memberLimit: null
  },
  membership: {
    id: 'membership-2',
    tenantId: '507f1f77bcf86cd799439011',
    userId: 'user-2',
    roleKey: 'tenant:member',
    status: 'active' as const
  }
};

function createInvitationTestApp() {
  const service = {
    createTenant: vi.fn(),
    listMyTenants: vi.fn(),
    switchActiveTenant: vi.fn(),
    createInvitation: vi.fn().mockResolvedValue(fakeInvitationResult),
    acceptInvitation: vi.fn().mockResolvedValue(fakeAcceptanceResult),
    revokeInvitation: vi.fn().mockResolvedValue(fakeInvitationResult),
    transferOwnership: vi.fn()
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

describe('tenant invitation routes', () => {
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

  it('creates tenant invitations without exposing their token in HTTP responses', async () => {
    const { app, service } = createInvitationTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString())
      .send({
        email: 'member@example.com'
      });

    expect(response.status).toBe(201);
    expect(service.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: fakeUserId.toString(),
        tenantId: fakeTenantId.toString(),
        email: 'member@example.com',
        roleKey: undefined
      })
    );
    expect(response.body.data.invitation.token).toBeUndefined();
  });

  it('accepts tenant invitations from the secure delivery token', async () => {
    const { app, service } = createInvitationTestApp();
    const fakeUserId = '507f1f77bcf86cd799439012';
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId,
      sid: fakeUserId,
      scope: ['platform:self']
    });
    const response = await request(app)
      .post('/api/v1/tenant/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: 'secure-invitation-token'
      });

    expect(response.status).toBe(200);
    expect(service.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: fakeUserId,
        token: 'secure-invitation-token'
      })
    );
    expect(response.body.data.membership).toMatchObject({
      roleKey: 'tenant:member'
    });
  });

  it('rejects invitation creation when the requested role key is invalid', async () => {
    const { app } = createInvitationTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/invitations')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString())
      .send({
        email: 'member@example.com',
        roleKey: 'tenant:ghost'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
  });

  it('revokes pending invitations inside the tenant context', async () => {
    const { app, service } = createInvitationTestApp();
    const fakeTenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const fakeUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const accessToken = tokenService.signAccessToken({
      sub: fakeUserId.toString(),
      sid: fakeUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: fakeTenantId,
      status: 'active',
      ownerUserId: fakeUserId
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      userId: fakeUserId,
      status: 'active',
      roleKey: 'tenant:owner'
    } as never);

    const response = await request(app)
      .post('/api/v1/tenant/invitations/revoke')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, fakeTenantId.toString())
      .send({
        invitationId: '507f1f77bcf86cd799439012'
      });

    expect(response.status).toBe(200);
    expect(service.revokeInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: fakeUserId.toString(),
        tenantId: fakeTenantId.toString(),
        invitationId: '507f1f77bcf86cd799439012'
      })
    );
  });
});
