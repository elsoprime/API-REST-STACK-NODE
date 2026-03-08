import { Router } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { createCrmRouter } from '@/modules/crm/routes/crm.routes';

function createCrmIsolationApp(service: {
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

describe('crm tenant isolation', () => {
  beforeEach(() => {
    vi.spyOn(AuthSessionModel, 'findById').mockImplementation(async (sessionId: string) => ({
      _id: sessionId,
      userId: sessionId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000),
      activeTenantId: null,
      activeMembershipId: null
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies requests when tenant-bound token does not match X-Tenant-Id', async () => {
    const userId = new Types.ObjectId();
    const tokenTenantId = new Types.ObjectId();
    const headerTenantId = new Types.ObjectId();
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
    const app = createCrmIsolationApp(service);
    const token = tokenService.signAccessToken({
      sub: userId.toString(),
      sid: userId.toString(),
      scope: ['platform:self'],
      tenantId: tokenTenantId.toString(),
      membershipId: new Types.ObjectId().toString()
    });

    const response = await request(app)
      .get('/api/v1/modules/crm/contacts')
      .set('Authorization', `Bearer ${token}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, headerTenantId.toString());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_SCOPE_MISMATCH');
    expect(service.listContacts).not.toHaveBeenCalled();
  });
});
