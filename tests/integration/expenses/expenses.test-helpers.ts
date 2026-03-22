import { Router } from 'express';
import { Types } from 'mongoose';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { createExpensesRouter } from '@/modules/expenses/routes/expenses.routes';

export function buildAccessToken(userId: string): string {
  return tokenService.signAccessToken({
    sub: userId,
    sid: userId,
    scope: ['platform:self']
  });
}

export function createExpensesTestApp(service: Record<string, ReturnType<typeof vi.fn>>) {
  const rootRouter = Router();
  const apiV1Router = Router();
  const modulesRouter = Router();

  modulesRouter.use('/expenses', createExpensesRouter(service as never));
  apiV1Router.use(APP_CONFIG.MODULES_BASE_PATH, modulesRouter);
  rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);

  return createServer({
    rootRouterOverride: rootRouter
  });
}

export function mockActiveSession() {
  vi.spyOn(AuthSessionModel, 'findById').mockImplementation(async (sessionId: string) => ({
    _id: sessionId,
    userId: sessionId,
    status: 'active',
    expiresAt: new Date(Date.now() + 60_000)
  }) as never);
}

export function mockTenantMembership(input: {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  roleKey: 'tenant:owner' | 'tenant:admin' | 'tenant:member';
  ownerUserId?: Types.ObjectId;
  activeModuleKeys?: string[];
}) {
  vi.spyOn(TenantModel, 'findById').mockResolvedValue({
    _id: input.tenantId,
    status: 'active',
    ownerUserId: input.ownerUserId ?? input.userId,
    planId: 'plan:growth',
    activeModuleKeys: input.activeModuleKeys ?? ['expenses']
  } as never);

  vi.spyOn(MembershipModel, 'findOne').mockResolvedValue({
    _id: new Types.ObjectId(),
    userId: input.userId,
    status: 'active',
    roleKey: input.roleKey
  } as never);
}

export function buildExpensesServiceMock() {
  return {
    createRequest: vi.fn(),
    listRequests: vi.fn(),
    getRequest: vi.fn(),
    updateRequest: vi.fn(),
    listQueue: vi.fn(),
    getCounters: vi.fn(),
    createCategory: vi.fn(),
    listCategories: vi.fn(),
    updateCategory: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    submitRequest: vi.fn(),
    reviewRequest: vi.fn(),
    approveRequest: vi.fn(),
    rejectRequest: vi.fn(),
    cancelRequest: vi.fn(),
    markRequestAsPaid: vi.fn(),
    createUploadPresign: vi.fn(),
    createAttachment: vi.fn(),
    listAttachments: vi.fn(),
    deleteAttachment: vi.fn(),
    bulkApproveRequests: vi.fn(),
    bulkRejectRequests: vi.fn(),
    bulkMarkRequestsAsPaid: vi.fn(),
    bulkExportRequests: vi.fn(),
    getDashboard: vi.fn(),
    getSummary: vi.fn(),
    exportRequestsCsv: vi.fn()
  };
}
