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

describe('expenses request routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects create request payload with date-only expenseDate', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/requests')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        title: 'Hotel cliente',
        categoryKey: 'travel',
        amount: 120000,
        currency: 'CLP',
        expenseDate: '2026-03-22'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.createRequest).not.toHaveBeenCalled();
  });

  it('creates request when expenseDate is ISO datetime', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    service.createRequest.mockResolvedValue({
      id: requestId.toString(),
      tenantId: tenantId.toString(),
      requestNumber: 'EXP-901',
      requesterUserId: userId.toString(),
      title: 'Hotel cliente',
      description: null,
      categoryKey: 'travel',
      amount: 120000,
      currency: 'CLP',
      expenseDate: '2026-03-22T00:00:00.000Z',
      status: 'draft',
      submittedAt: null,
      approvedAt: null,
      paidAt: null,
      canceledAt: null,
      rejectionReasonCode: null,
      paymentReference: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/requests')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        title: 'Hotel cliente',
        categoryKey: 'travel',
        amount: 120000,
        currency: 'CLP',
        expenseDate: '2026-03-22T00:00:00.000Z'
      });

    expect(response.status).toBe(201);
    expect(service.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requesterUserId: userId.toString(),
        expenseDate: '2026-03-22T00:00:00.000Z'
      })
    );
  });
});

