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

describe('expenses plan gating routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies expenses access when the module is not enabled in tenant runtime', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member',
      activeModuleKeys: ['inventory', 'crm', 'hr']
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/queue?page=1&limit=20')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
    expect(service.listQueue).not.toHaveBeenCalled();
  });

  it('allows expenses access when the module is enabled in tenant runtime', async () => {
    const tenantId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);

    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member',
      activeModuleKeys: ['inventory', 'crm', 'hr', 'expenses']
    });

    service.listQueue.mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0
    });

    const response = await request(app)
      .get('/api/v1/modules/expenses/queue?page=1&limit=20')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        page: 1,
        limit: 20
      })
    );
  });
});
