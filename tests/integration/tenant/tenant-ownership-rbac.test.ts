import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { RoleModel } from '@/core/platform/rbac/models/role.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createTenantRouter } from '@/core/tenant/routes/tenant.routes';
import { TenantService } from '@/core/tenant/services/tenant.service';

function createTenantOwnershipApp(service = new TenantService()) {
  const rootRouter = Router();
  const apiV1Router = Router();

  apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, createTenantRouter(service));
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant ownership under RBAC', () => {
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

  it('keeps ownership transfer restricted to the current owner even if the actor has a high custom role', async () => {
    const app = createTenantOwnershipApp();
    const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const actorUserId = new Types.ObjectId('507f1f77bcf86cd799439010');
    const actualOwnerUserId = new Types.ObjectId('507f1f77bcf86cd799439015');
    const targetUserId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const accessToken = tokenService.signAccessToken({
      sub: actorUserId.toString(),
      sid: actorUserId.toString(),
      scope: ['platform:self']
    });

    vi.spyOn(RoleModel, 'findOne').mockImplementation((query: { key?: string }) => {
      return {
        lean: vi.fn().mockResolvedValue(
          query.key === 'tenant:admin'
            ? {
                key: 'tenant:admin',
                name: 'Tenant Admin',
                description: 'Administrative custom role',
                scope: 'tenant',
                tenantId,
                isSystem: false,
                hierarchyLevel: 250,
                permissions: ['tenant:ownership:transfer', 'tenant:invitations:create']
              }
            : null
        )
      } as never;
    });
    vi.spyOn(TenantModel, 'findById')
      .mockResolvedValueOnce({
        _id: tenantId,
        status: 'active',
        planId: 'plan:growth',
        activeModuleKeys: ['inventory'],
        ownerUserId: actualOwnerUserId
      } as never)
      .mockResolvedValueOnce({
        _id: tenantId,
        status: 'active',
        ownerUserId: actualOwnerUserId
      } as never);
    vi.spyOn(MembershipModel, 'findOne')
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId,
        userId: actorUserId,
        status: 'active',
        roleKey: 'tenant:admin'
      } as never)
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId,
        userId: actorUserId,
        status: 'active',
        roleKey: 'tenant:admin'
      } as never)
      .mockResolvedValueOnce({
        _id: new Types.ObjectId(),
        tenantId,
        userId: targetUserId,
        status: 'active',
        roleKey: 'tenant:member'
      } as never);

    const response = await request(app)
      .post('/api/v1/tenant/transfer-ownership')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        targetUserId: targetUserId.toString()
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_OWNER_REQUIRED');
  });
});
