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

describe('expenses reporting routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists queue for tenant admin with pagination', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.listQueue.mockResolvedValue({
      items: [
        {
          id: new Types.ObjectId().toString(),
          tenantId: tenantId.toString(),
          requestNumber: 'EXP-001',
          status: 'submitted',
          title: 'Hotel',
          requesterUserId: new Types.ObjectId().toString(),
          amount: 300,
          currency: 'USD',
          expenseDate: new Date().toISOString(),
          submittedAt: new Date().toISOString()
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
      .get('/api/v1/modules/expenses/queue?page=1&limit=20')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listQueue).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 20
    });
    expect(response.body.pagination.total).toBe(1);
  });

  it('returns counters for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.getCounters.mockResolvedValue({
      total: 10,
      draft: 1,
      submitted: 3,
      returned: 1,
      approved: 2,
      rejected: 1,
      paid: 2,
      canceled: 0
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/counters')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getCounters).toHaveBeenCalledWith(tenantId.toString());
  });

  it('returns summary for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.getSummary.mockResolvedValue({
      totalAmount: 1200,
      approvedAmount: 700,
      paidAmount: 600,
      pendingCount: 2,
      currency: 'USD'
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/reports/summary')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.getSummary).toHaveBeenCalledWith(tenantId.toString());
    expect(response.body.success).toBe(true);
  });

  it('exports requests csv for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.exportRequestsCsv.mockResolvedValue({
      filename: 'expenses-2026-03-21.csv',
      contentType: 'text/csv; charset=utf-8',
      csv: 'requestNumber,status,amount\nEXP-001,approved,100'
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/exports/requests.csv')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.exportRequestsCsv).toHaveBeenCalledWith(tenantId.toString());
    expect(response.header['content-disposition']).toContain('attachment; filename="expenses-2026-03-21.csv"');
    expect(response.text).toContain('requestNumber,status,amount');
  });

  it('validates queue query parameters', async () => {
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
      .get('/api/v1/modules/expenses/queue?page=1&limit=9999')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.listQueue).not.toHaveBeenCalled();
  });
});
