import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createHrRouter } from '@/modules/hr/routes/hr.routes';

type MockFn = ReturnType<typeof vi.fn>;

interface HrServiceDouble extends Record<string, MockFn> {
  createEmployee: MockFn;
  listEmployees: MockFn;
  getEmployee: MockFn;
  updateEmployee: MockFn;
  deleteEmployee: MockFn;
  getCompensation: MockFn;
  updateCompensation: MockFn;
}

function createHrServiceDouble(): {
  service: HrServiceDouble;
} {
  const service: HrServiceDouble = {
    createEmployee: vi.fn(),
    listEmployees: vi.fn(),
    getEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    deleteEmployee: vi.fn(),
    getCompensation: vi.fn(),
    updateCompensation: vi.fn()
  };

  return {
    service
  };
}

function createHrTestApp(service: HrServiceDouble) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const modulesRouter = Router();

  modulesRouter.use('/hr', createHrRouter(service as never));
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

describe('hr routes', () => {
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

  it('lists HR employees with success envelope and pagination', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const { service } = createHrServiceDouble();
    const listResult = {
      items: [
        {
          id: new Types.ObjectId().toString(),
          tenantId: tenantId.toString(),
          employeeCode: 'HR-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          workEmail: 'ada@example.com',
          jobTitle: 'Engineer',
          department: 'R&D',
          managerId: null,
          employmentType: 'full_time',
          status: 'active',
          startDate: new Date('2026-01-12T00:00:00.000Z').toISOString(),
          endDate: null,
          birthDate: null,
          isActive: true
        }
      ],
      page: 1,
      limit: 20,
      total: 1
    };

    service.listEmployees.mockResolvedValue(listResult);

    const app = createHrTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm', 'hr']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/modules/hr/employees')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        page: 1,
        limit: 20
      })
    );
    expect(response.body.success).toBe(true);
    expect(response.body.pagination.total).toBe(1);
  });

  it('denies HR access when the module is not enabled in tenant runtime', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const { service } = createHrServiceDouble();
    const app = createHrTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/modules/hr/employees')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
    expect(service.listEmployees).not.toHaveBeenCalled();
  });

  it('returns tenant header validation error when X-Tenant-Id is missing', async () => {
    const userId = new Types.ObjectId();
    const { service } = createHrServiceDouble();
    const app = createHrTestApp(service);

    const response = await request(app)
      .get('/api/v1/modules/hr/employees')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.listEmployees).not.toHaveBeenCalled();
  });

  it('denies HR compensation read operations for tenant member without sensitive permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    const { service } = createHrServiceDouble();
    const app = createHrTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm', 'hr']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get(`/api/v1/modules/hr/employees/${employeeId.toString()}/compensation`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.getCompensation).not.toHaveBeenCalled();
  });

  it('denies HR compensation update operations for tenant member without sensitive permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    const { service } = createHrServiceDouble();
    const app = createHrTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory', 'crm', 'hr']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .patch(`/api/v1/modules/hr/employees/${employeeId.toString()}/compensation`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        salaryAmount: 100000,
        currency: 'USD',
        payFrequency: 'monthly',
        effectiveFrom: '2026-03-01T00:00:00.000Z'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.updateCompensation).not.toHaveBeenCalled();
  });
});
