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

describe('expenses workflow routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits request for tenant member with own permission', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.submitRequest.mockResolvedValue({
      id: requestId.toString(),
      tenantId: tenantId.toString(),
      requestNumber: 'EXP-001',
      requesterUserId: userId.toString(),
      title: 'Taxi',
      description: null,
      categoryKey: 'transport',
      amount: 100,
      currency: 'USD',
      expenseDate: new Date().toISOString(),
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      paidAt: null,
      canceledAt: null,
      rejectionReasonCode: null,
      paymentReference: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post(`/api/v1/modules/expenses/requests/${requestId.toString()}/submit`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.submitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requestId: requestId.toString(),
        actorUserId: userId.toString()
      })
    );
  });

  it('approves request for tenant member according to current role matrix', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.approveRequest.mockResolvedValue({
      id: requestId.toString(),
      tenantId: tenantId.toString(),
      requestNumber: 'EXP-003',
      requesterUserId: new Types.ObjectId().toString(),
      title: 'Parking',
      description: null,
      categoryKey: 'transport',
      amount: 80,
      currency: 'USD',
      expenseDate: new Date().toISOString(),
      status: 'approved',
      submittedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      paidAt: null,
      canceledAt: null,
      rejectionReasonCode: null,
      paymentReference: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post(`/api/v1/modules/expenses/requests/${requestId.toString()}/approve`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.approveRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requestId: requestId.toString()
      })
    );
  });

  it('rejects request for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.rejectRequest.mockResolvedValue({
      id: requestId.toString(),
      tenantId: tenantId.toString(),
      requestNumber: 'EXP-002',
      requesterUserId: new Types.ObjectId().toString(),
      title: 'Laptop',
      description: null,
      categoryKey: 'equipment',
      amount: 999,
      currency: 'USD',
      expenseDate: new Date().toISOString(),
      status: 'rejected',
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      paidAt: null,
      canceledAt: null,
      rejectionReasonCode: 'invalid_docs',
      paymentReference: null,
      metadata: {},
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
      .post(`/api/v1/modules/expenses/requests/${requestId.toString()}/reject`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        reasonCode: 'invalid_docs',
        comment: 'Missing invoice'
      });

    expect(response.status).toBe(200);
    expect(service.rejectRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: requestId.toString(),
        reasonCode: 'invalid_docs'
      })
    );
  });

  it('validates workflow request params', async () => {
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
      .post('/api/v1/modules/expenses/requests/not-an-object-id/review')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({ comment: 'needs changes' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.reviewRequest).not.toHaveBeenCalled();
  });
});
