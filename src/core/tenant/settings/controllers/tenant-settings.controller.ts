import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import {
  type TenantSettingsServiceContract
} from '@/core/tenant/settings/types/tenant-settings.types';
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

export function createTenantSettingsController(service: TenantSettingsServiceContract) {
  return {
    getSettings: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.getSettings({
          tenantId: tenantContext.tenantId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateSettings: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.updateSettings({
          tenantId: tenantContext.tenantId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    getEffectiveSettings: async (
      _req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const result = await service.getEffectiveSettings({
          tenantId: tenantContext.tenantId,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
