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

describe('expenses bulk routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('approves requests in bulk for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const requestIds = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];
    const service = buildExpensesServiceMock();
    service.bulkApproveRequests.mockResolvedValue({
      processed: 2,
      succeeded: 2,
      failed: 0,
      results: requestIds.map((id) => ({
        id,
        success: true,
        status: 'approved'
      }))
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/requests/bulk/approve')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({ requestIds });

    expect(response.status).toBe(200);
    expect(service.bulkApproveRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requestIds
      })
    );
  });

  it('validates object ids on bulk approve payload', async () => {
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
      .post('/api/v1/modules/expenses/requests/bulk/approve')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({ requestIds: ['not-an-object-id'] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.bulkApproveRequests).not.toHaveBeenCalled();
  });

  it('validates duplicate ids in bulk reject payload', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const duplicated = new Types.ObjectId().toString();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/requests/bulk/reject')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        requestIds: [duplicated, duplicated],
        reasonCode: 'invalid_docs',
        comment: 'Invalid documentation'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.bulkRejectRequests).not.toHaveBeenCalled();
  });

  it('exports selected requests for tenant admin', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const requestIds = [new Types.ObjectId().toString()];
    const service = buildExpensesServiceMock();
    service.bulkExportRequests.mockResolvedValue([
      {
        requestId: requestIds[0],
        requestNumber: 'EXP-100',
        status: 'submitted',
        amount: 500,
        currency: 'USD'
      }
    ]);
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:admin'
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/requests/bulk/export')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({ requestIds });

    expect(response.status).toBe(200);
    expect(service.bulkExportRequests).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      requestIds
    });
    expect(response.body.success).toBe(true);
  });
});
