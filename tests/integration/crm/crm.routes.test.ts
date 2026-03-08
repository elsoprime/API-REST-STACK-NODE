import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createCrmRouter } from '@/modules/crm/routes/crm.routes';

function createCrmTestApp(service: {
  createContact: ReturnType<typeof vi.fn>;
  listContacts: ReturnType<typeof vi.fn>;
  getContact: ReturnType<typeof vi.fn>;
  updateContact: ReturnType<typeof vi.fn>;
  deleteContact: ReturnType<typeof vi.fn>;
  createOrganization: ReturnType<typeof vi.fn>;
  listOrganizations: ReturnType<typeof vi.fn>;
  getOrganization: ReturnType<typeof vi.fn>;
  updateOrganization: ReturnType<typeof vi.fn>;
  deleteOrganization: ReturnType<typeof vi.fn>;
  createOpportunity: ReturnType<typeof vi.fn>;
  listOpportunities: ReturnType<typeof vi.fn>;
  getOpportunity: ReturnType<typeof vi.fn>;
  updateOpportunity: ReturnType<typeof vi.fn>;
  deleteOpportunity: ReturnType<typeof vi.fn>;
  changeOpportunityStage: ReturnType<typeof vi.fn>;
  createActivity: ReturnType<typeof vi.fn>;
  listActivities: ReturnType<typeof vi.fn>;
  getCounters: ReturnType<typeof vi.fn>;
}) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const modulesRouter = Router();

  modulesRouter.use('/crm', createCrmRouter(service as never));
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

describe('crm routes', () => {
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

  it('lists CRM contacts with success envelope and pagination', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createContact: vi.fn(),
      listContacts: vi.fn().mockResolvedValue({
        items: [
          {
            id: new Types.ObjectId().toString(),
            tenantId: tenantId.toString(),
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            phone: null,
            organizationId: null,
            isActive: true
          }
        ],
        page: 1,
        limit: 20,
        total: 1
      }),
      getContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      createOpportunity: vi.fn(),
      listOpportunities: vi.fn(),
      getOpportunity: vi.fn(),
      updateOpportunity: vi.fn(),
      deleteOpportunity: vi.fn(),
      changeOpportunityStage: vi.fn(),
      createActivity: vi.fn(),
      listActivities: vi.fn(),
      getCounters: vi.fn()
    };
    const app = createCrmTestApp(service);

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
      .get('/api/v1/modules/crm/contacts')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        page: 1,
        limit: 20
      })
    );
    expect(response.body.success).toBe(true);
    expect(response.body.pagination.total).toBe(1);
  });

  it('denies CRM access when the module is not enabled in tenant runtime', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createContact: vi.fn(),
      listContacts: vi.fn(),
      getContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      createOpportunity: vi.fn(),
      listOpportunities: vi.fn(),
      getOpportunity: vi.fn(),
      updateOpportunity: vi.fn(),
      deleteOpportunity: vi.fn(),
      changeOpportunityStage: vi.fn(),
      createActivity: vi.fn(),
      listActivities: vi.fn(),
      getCounters: vi.fn()
    };
    const app = createCrmTestApp(service);

    vi.spyOn(TenantModel, 'findById').mockResolvedValue({
      _id: tenantId,
      status: 'active',
      ownerUserId: new Types.ObjectId(),
      planId: 'plan:growth',
      activeModuleKeys: ['inventory']
    } as never);
    vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
      _id: membershipId,
      userId,
      status: 'active',
      roleKey: 'tenant:member'
    } as never);

    const response = await request(app)
      .get('/api/v1/modules/crm/contacts')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_MODULE_DENIED');
    expect(service.listContacts).not.toHaveBeenCalled();
  });

  it('returns tenant header validation error when X-Tenant-Id is missing', async () => {
    const userId = new Types.ObjectId();
    const service = {
      createContact: vi.fn(),
      listContacts: vi.fn(),
      getContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      createOpportunity: vi.fn(),
      listOpportunities: vi.fn(),
      getOpportunity: vi.fn(),
      updateOpportunity: vi.fn(),
      deleteOpportunity: vi.fn(),
      changeOpportunityStage: vi.fn(),
      createActivity: vi.fn(),
      listActivities: vi.fn(),
      getCounters: vi.fn()
    };
    const app = createCrmTestApp(service);

    const response = await request(app)
      .get('/api/v1/modules/crm/contacts')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('TENANT_HEADER_REQUIRED');
    expect(service.listContacts).not.toHaveBeenCalled();
  });

  it('denies CRM write operations for tenant member without write permission', async () => {
    const tenantId = new Types.ObjectId();
    const membershipId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = {
      createContact: vi.fn(),
      listContacts: vi.fn(),
      getContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      createOpportunity: vi.fn(),
      listOpportunities: vi.fn(),
      getOpportunity: vi.fn(),
      updateOpportunity: vi.fn(),
      deleteOpportunity: vi.fn(),
      changeOpportunityStage: vi.fn(),
      createActivity: vi.fn(),
      listActivities: vi.fn(),
      getCounters: vi.fn()
    };
    const app = createCrmTestApp(service);

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
      .post('/api/v1/modules/crm/contacts')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        firstName: 'Ada',
        lastName: 'Lovelace'
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('RBAC_PERMISSION_DENIED');
    expect(service.createContact).not.toHaveBeenCalled();
  });
});
