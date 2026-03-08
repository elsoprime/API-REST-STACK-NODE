import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { type PlatformSettingsServiceContract } from '@/core/platform/settings/types/platform-settings.types';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined
  });
}

export function createPlatformSettingsController(service: PlatformSettingsServiceContract) {
  return {
    getSettings: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.getSettings({
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateSettings: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const result = await service.updateSettings({
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ settings: result }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
