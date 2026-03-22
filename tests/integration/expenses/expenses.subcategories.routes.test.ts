import { Types } from 'mongoose';
import request from 'supertest';

import { APP_CONFIG } from '@/config/app';
import {
  buildAccessToken,
  buildExpensesServiceMock,
  createExpensesTestApp,
  mockActiveSession,
  mockTenantMembership
} from './expenses.test-helpers';

describe('expenses subcategories routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates subcategory for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const subcategoryId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    service.createSubcategory.mockResolvedValue({
      id: subcategoryId.toString(),
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      key: 'travel_hotel',
      name: 'Hoteles',
      requiresAttachment: true,
      isActive: true,
      monthlyLimit: 250000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/subcategories')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        categoryId: categoryId.toString(),
        key: 'travel_hotel',
        name: 'Hoteles',
        requiresAttachment: true,
        monthlyLimit: 250000
      });

    expect(response.status).toBe(201);
    expect(service.createSubcategory).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString(),
        key: 'travel_hotel'
      })
    );
  });

  it('lists subcategories with category filter', async () => {
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const subcategoryId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    service.listSubcategories.mockResolvedValue({
      items: [
        {
          id: subcategoryId.toString(),
          tenantId: tenantId.toString(),
          categoryId: categoryId.toString(),
          key: 'travel_hotel',
          name: 'Hoteles',
          requiresAttachment: true,
          isActive: true,
          monthlyLimit: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      page: 1,
      limit: 20,
      total: 1
    });

    const response = await request(app)
      .get(`/api/v1/modules/expenses/subcategories?categoryId=${categoryId.toString()}&page=1&limit=20`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listSubcategories).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      page: 1,
      limit: 20,
      includeInactive: false
    });
  });

  it('validates list subcategories categoryId', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/subcategories?categoryId=bad-id&page=1&limit=20')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(400);
    expect(service.listSubcategories).not.toHaveBeenCalled();
  });

  it('updates subcategory for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const subcategoryId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    service.updateSubcategory.mockResolvedValue({
      id: subcategoryId.toString(),
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      key: 'travel_hotel',
      name: 'Hoteles Premium',
      requiresAttachment: true,
      isActive: true,
      monthlyLimit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const response = await request(app)
      .patch(`/api/v1/modules/expenses/subcategories/${subcategoryId.toString()}`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        name: 'Hoteles Premium'
      });

    expect(response.status).toBe(200);
    expect(service.updateSubcategory).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        subcategoryId: subcategoryId.toString(),
        patch: {
          name: 'Hoteles Premium'
        }
      })
    );
  });
});

