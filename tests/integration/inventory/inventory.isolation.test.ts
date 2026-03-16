import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createInventoryRouter } from '@/modules/inventory/routes/inventory.routes';

function createInventoryIsolationApp(service: Record<string, ReturnType<typeof vi.fn>>) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const modulesRouter = Router();

  modulesRouter.use('/inventory', createInventoryRouter(service as never));
  apiV1Router.use(APP_CONFIG.MODULES_BASE_PATH, modulesRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

describe('inventory tenant isolation', () => {
  beforeEach(() => {
    vi.spyOn(AuthSessionModel, 'findById').mockImplementation(async (sessionId: string) => ({
      _id: sessionId,
      userId: sessionId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
      activeTenantId: null,
      activeMembershipId: null
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies requests when tenant-bound token does not match X-Tenant-Id', async () => {
    const userId = new Types.ObjectId();
    const tokenTenantId = new Types.ObjectId();
    const headerTenantId = new Types.ObjectId();
    const service = {
      createCategory: vi.fn(),
      listCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      createItem: vi.fn(),
      listItems: vi.fn(),
      getItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      createStockMovement: vi.fn(),
      listStockMovements: vi.fn(),
      listLowStockAlerts: vi.fn()
    };
    const app = createInventoryIsolationApp(service);
    const token = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self'],
      tenantId: tokenTenantId.toString(),
      membershipId: new Types.ObjectId().toString()
    });

    const response = await request(app)
      .get('/api/v1/modules/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, headerTenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SCOPE_MISMATCH');
    expect(service.listItems).not.toHaveBeenCalled();
  });
});

