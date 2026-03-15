import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { resolveTenantContextMiddleware } from '@/infrastructure/middleware/resolveTenantContext.middleware';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';

function createLifecycleTestApp(userId: string) {
  const rootRouter = Router();

  rootRouter.use((req, res, next) => {
    res.locals.auth = {
      userId,
      tenantId: null,
      membershipId: null
    };
    next();
  });

  rootRouter.get('/test', resolveTenantContextMiddleware, (_req, res) => {
    res.status(200).json({ success: true });
  });

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('tenant subscription lifecycle enforcement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks tenant access when subscription is pending', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId().toString();
    const app = createLifecycleTestApp(userId);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: null,
      activeModuleKeys: [],
      subscriptionStatus: 'pending',
      subscriptionGraceEndsAt: null
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      tenantId,
      userId: new Types.ObjectId(userId),
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/test')
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SUBSCRIPTION_PAYMENT_REQUIRED');
  });

  it('allows tenant access during grace window', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId().toString();
    const app = createLifecycleTestApp(userId);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory'],
      subscriptionStatus: 'grace',
      subscriptionGraceEndsAt: new Date(Date.now() + 60_000)
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      tenantId,
      userId: new Types.ObjectId(userId),
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/test')
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
  });

  it('suspends tenant when grace window expired', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId().toString();
    const app = createLifecycleTestApp(userId);
    const tenantSave = vi.fn();

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: ['inventory'],
      subscriptionStatus: 'grace',
      subscriptionGraceEndsAt: new Date(Date.now() - 60_000),
      save: tenantSave
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: new Types.ObjectId(),
      tenantId,
      userId: new Types.ObjectId(userId),
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/test')
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SUBSCRIPTION_PAYMENT_REQUIRED');
    expect(tenantSave).toHaveBeenCalled();
  });
});
