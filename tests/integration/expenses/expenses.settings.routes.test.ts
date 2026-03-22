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

describe('expenses settings routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns settings for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.getSettings.mockResolvedValue({
      tenantId: tenantId.toString(),
      allowedCurrencies: ['USD', 'CLP'],
      maxAmountWithoutReview: 150,
      approvalMode: 'single_step',
      bulkMaxItemsPerOperation: 200,
      exportsEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getSettings).toHaveBeenCalledWith(tenantId.toString());
    expect(response.body.success).toBe(true);
  });

  it('updates settings for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.updateSettings.mockResolvedValue({
      tenantId: tenantId.toString(),
      allowedCurrencies: ['USD', 'EUR'],
      maxAmountWithoutReview: 200,
      approvalMode: 'multi_step',
      bulkMaxItemsPerOperation: 150,
      exportsEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const payload = {
      allowedCurrencies: ['USD', 'EUR'],
      maxAmountWithoutReview: 200,
      approvalMode: 'multi_step',
      bulkMaxItemsPerOperation: 150,
      exportsEnabled: false
    };

    const response = await request(app)
      .put('/api/v1/modules/expenses/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send(payload);

    expect(response.status).toBe(200);
    expect(service.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        ...payload
      })
    );
  });

  it('denies settings read for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member',
      ownerUserId: new Types.ObjectId()
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.getSettings).not.toHaveBeenCalled();
  });

  it('denies settings update for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member',
      ownerUserId: new Types.ObjectId()
    });

    const response = await request(app)
      .put('/api/v1/modules/expenses/settings')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        bulkMaxItemsPerOperation: 99
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('lists categories for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.listCategories.mockResolvedValue({
      items: [
        {
          id: new Types.ObjectId().toString(),
          tenantId: tenantId.toString(),
          key: 'travel',
          name: 'Travel',
          requiresAttachment: true,
          isActive: true,
          monthlyLimit: 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      page: 1,
      limit: 20,
      total: 1
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/categories?page=1&limit=20&includeInactive=true')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listCategories).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 20,
      includeInactive: true
    });
    expect(response.body.pagination.total).toBe(1);
  });

  it('denies categories update for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member',
      ownerUserId: new Types.ObjectId()
    });

    const response = await request(app)
      .patch(`/api/v1/modules/expenses/categories/${categoryId.toString()}`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        isActive: false
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.updateCategory).not.toHaveBeenCalled();
  });
});
