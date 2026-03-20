import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import {
  type TenantMembershipsServiceContract
} from '@/core/tenant/memberships/types/tenant-memberships.types';
import { type TenantContext } from '@/core/tenant/types/tenant.types';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined,
    tenant: res.locals.tenantContext as TenantContext | undefined
  });
}

function getTenantContext(res: Response): TenantContext {
  return (res.locals.tenantContext ?? {}) as TenantContext;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function createTenantMembershipsController(service: TenantMembershipsServiceContract) {
  return {
    listMemberships: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.listMemberships({
          tenantId: tenantContext.tenantId,
          page: Number(req.query.page),
          limit: Number(req.query.limit),
          search: getOptionalString(req.query.search),
          roleKey: getOptionalString(req.query.roleKey),
          status: getOptionalString(req.query.status) as 'active' | 'suspended' | undefined,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateMembership: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const membership = await service.updateMembership({
          tenantId: tenantContext.tenantId,
          membershipId: String(req.params.membershipId),
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ membership }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteMembership: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const membership = await service.deleteMembership({
          tenantId: tenantContext.tenantId,
          membershipId: String(req.params.membershipId),
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ membership }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
