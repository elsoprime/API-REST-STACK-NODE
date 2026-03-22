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

describe('expenses dashboard reporting routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dashboard report for tenant admin with filters', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.getDashboard.mockResolvedValue({
      filters: {
        dateWindowDays: 30,
        status: 'approved',
        categoryKey: 'travel'
      },
      primaryCurrency: 'CLP',
      hasMixedCurrencies: false,
      totalsByCurrency: [
        {
          currency: 'CLP',
          requestCount: 2,
          totalAmount: 500000,
          pendingAmount: 0,
          approvedAmount: 500000,
          paidAmount: 0
        }
      ],
      availableCategories: [
        {
          key: 'travel',
          name: 'Viajes'
        }
      ],
      kpis: {
        totalRequests: 2,
        pendingRequests: 0,
        approvedRequests: 2,
        rejectedRequests: 0,
        totalAmount: 500000,
        pendingAmount: 0
      },
      trends: [
        {
          day: '22/03',
          requested: 2,
          approved: 2,
          rejected: 0
        }
      ],
      categories: [
        {
          categoryKey: 'travel',
          label: 'Viajes',
          totalAmount: 500000,
          requests: 2
        }
      ],
      alerts: [
        {
          id: 'healthy',
          severity: 'info',
          title: 'Operacion estable',
          description: 'No se detectaron alertas operativas para el rango seleccionado.'
        }
      ]
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/reports/dashboard?dateWindowDays=30&status=approved&categoryKey=travel')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getDashboard).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      dateWindowDays: 30,
      status: 'approved',
      categoryKey: 'travel'
    });
    expect(response.body.success).toBe(true);
    expect(response.body.data.dashboard.primaryCurrency).toBe('CLP');
  });

  it('validates dashboard query parameters', async () => {
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
      .get('/api/v1/modules/expenses/reports/dashboard?dateWindowDays=12')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.getDashboard).not.toHaveBeenCalled();
  });

  it('rejects dashboard access for tenant member without report permission', async () => {
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
      .get('/api/v1/modules/expenses/reports/dashboard')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(service.getDashboard).not.toHaveBeenCalled();
  });
});
