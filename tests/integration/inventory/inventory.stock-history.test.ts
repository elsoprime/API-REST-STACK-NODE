import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createInventoryRouter } from '@/modules/inventory/routes/inventory.routes';

function createInventoryStockHistoryApp(service: {
  createCategory: ReturnType<typeof vi.fn>;
  listCategories: ReturnType<typeof vi.fn>;
  updateCategory: ReturnType<typeof vi.fn>;
  deleteCategory: ReturnType<typeof vi.fn>;
  createItem: ReturnType<typeof vi.fn>;
  listItems: ReturnType<typeof vi.fn>;
  getItem: ReturnType<typeof vi.fn>;
  updateItem: ReturnType<typeof vi.fn>;
  deleteItem: ReturnType<typeof vi.fn>;
  createStockMovement: ReturnType<typeof vi.fn>;
  listStockMovements: ReturnType<typeof vi.fn>;
  listLowStockAlerts: ReturnType<typeof vi.fn>;
}) {
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

function buildAccessToken(userId: string): string {
  return tokenService.signAccessToken({
    sub: userId,
    sid: userId,
    scope: ['platform:self']
  });
}

describe('inventory stock history route', () => {
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

  it('lists stock movements in paginated form and forwards the item filter', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
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
      listStockMovements: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Types.ObjectId().toString(),
            tenantId: tenantId.toString(),
            itemId: itemId.toString(),
            direction: 'out',
            quantity: 3,
            stockBefore: 20,
            stockAfter: 17,
            reason: 'sale',
            performedByUserId: userId.toString(),
            createdAt: new Date('2026-03-08T15:00:00.000Z').toISOString()
          }
        ],
        page: 1,
        limit: 20,
        total: 1
      }),
      listLowStockAlerts: vi.fn()
    };
    const app = createInventoryStockHistoryApp(service);

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
      .get('/api/v1/modules/inventory/stock-movements')
      .query({ itemId: itemId.toString() })
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listStockMovements).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        page: 1,
        limit: 20
      })
    );
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data.items[0].stockAfter).toBe(17);
  });
});
