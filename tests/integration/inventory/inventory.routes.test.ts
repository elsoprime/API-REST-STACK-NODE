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

function createInventoryTestApp(service: {
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

describe('inventory routes', () => {
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

  it('lists inventory categories with success envelope and pagination', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createCategory: vi.fn(),
      listCategories: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Types.ObjectId().toString(),
            tenantId: tenantId.toString(),
            name: 'Raw Materials',
            description: null,
            isActive: true
          }
        ],
        page: 1,
        limit: 20,
        total: 1
      }),
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
    const app = createInventoryTestApp(service);

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
      .get('/api/v1/modules/inventory/categories')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listCategories).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        page: 1,
        limit: 20
      })
    );
    expect(response.body.success).toBe(true);
    expect(response.body.pagination.total).toBe(1);
  });

  it('denies inventory access when the module is not enabled in tenant runtime', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
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
    const app = createInventoryTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:starter',
      activeModuleKeys: []
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/modules/inventory/categories')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
    expect(service.listCategories).not.toHaveBeenCalled();
  });

  it('denies category creation for tenant members without inventory create permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
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
    const app = createInventoryTestApp(service);

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
      .post('/api/v1/modules/inventory/categories')
      .set('Authorization', 'Bearer ' + buildAccessToken(userId.toString()))
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Raw Materials'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.createCategory).not.toHaveBeenCalled();
  });
  it('requires CSRF for cookie-authenticated category creation', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
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
    const app = createInventoryTestApp(service);
    const accessToken = buildAccessToken(userId.toString());

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
      .post('/api/v1/modules/inventory/categories')
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Raw Materials'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_INVALID');
    expect(service.createCategory).not.toHaveBeenCalled();
  });

  it('accepts cookie-authenticated category creation when CSRF token matches cookie', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createCategory: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
        name: 'Raw Materials',
        description: null,
        isActive: true
      }),
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
    const app = createInventoryTestApp(service);
    const accessToken = buildAccessToken(userId.toString());

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
      .post('/api/v1/modules/inventory/categories')
      .set('Cookie', [
        `${process.env.AUTH_ACCESS_COOKIE_NAME}=${accessToken}`,
        `${process.env.CSRF_COOKIE_NAME}=csrf-token`
      ])
      .set(APP_CONFIG.CSRF_HEADER, 'csrf-token')
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Raw Materials'
      });

    expect(response.status).toBe(201);
    expect(service.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        name: 'Raw Materials'
      })
    );
  });

  it('returns tenant header validation error when X-Tenant-Id is missing', async () => {
    const userId = new Types.ObjectId();
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
    const app = createInventoryTestApp(service);

    const response = await request(app)
      .get('/api/v1/modules/inventory/categories')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.listCategories).not.toHaveBeenCalled();
  });
  it('allows tenant admins to create inventory categories', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createCategory: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
        name: 'Packaging',
        description: null,
        isActive: true
      }),
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
    const app = createInventoryTestApp(service);

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
      roleKey: 'tenant:admin'
    } as never);

    const response = await request(app)
      .post('/api/v1/modules/inventory/categories')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Packaging'
      });

    expect(response.status).toBe(201);
    expect(service.createCategory).toHaveBeenCalled();
  });

  it('allows tenant admins to update inventory items', async () => {
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
      updateItem: vi.fn().mockResolvedValue({
        id: itemId.toString(),
        tenantId: tenantId.toString(),
        name: 'Widgets',
        sku: 'W-01',
        categoryId: null,
        description: null,
        isActive: true,
        stockOnHand: 0,
        lowStockThreshold: null
      }),
      deleteItem: vi.fn(),
      createStockMovement: vi.fn(),
      listStockMovements: vi.fn(),
      listLowStockAlerts: vi.fn()
    };
    const app = createInventoryTestApp(service);

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
      roleKey: 'tenant:admin'
    } as never);

    const response = await request(app)
      .patch(`/api/v1/modules/inventory/items/${itemId.toString()}`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Widgets'
      });

    expect(response.status).toBe(200);
    expect(service.updateItem).toHaveBeenCalled();
  });

  it('allows tenant admins to delete inventory categories', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const service = {
      createCategory: vi.fn(),
      listCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn().mockResolvedValue({
        id: categoryId.toString(),
        tenantId: tenantId.toString(),
        name: 'Discontinued',
        description: null,
        isActive: false
      }),
      createItem: vi.fn(),
      listItems: vi.fn(),
      getItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      createStockMovement: vi.fn(),
      listStockMovements: vi.fn(),
      listLowStockAlerts: vi.fn()
    };
    const app = createInventoryTestApp(service);

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
      roleKey: 'tenant:admin'
    } as never);

    const response = await request(app)
      .delete(`/api/v1/modules/inventory/categories/${categoryId.toString()}`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.deleteCategory).toHaveBeenCalled();
  });

  it('allows tenant admins to register stock movements', async () => {
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
      createStockMovement: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 5,
        reason: 'restock',
        createdAt: new Date().toISOString()
      }),
      listStockMovements: vi.fn(),
      listLowStockAlerts: vi.fn()
    };
    const app = createInventoryTestApp(service);

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
      roleKey: 'tenant:admin'
    } as never);

    const response = await request(app)
      .post('/api/v1/modules/inventory/stock-movements')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 5,
        reason: 'restock'
      });

    expect(response.status).toBe(201);
    expect(service.createStockMovement).toHaveBeenCalled();
  });
});



