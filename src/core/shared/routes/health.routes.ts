import { Router, type Request, type Response } from 'express';

import { env } from '@/config/env';
import { buildSuccess } from '@/core/shared/utils/build-success.util';
import { getDatabaseConnectionState } from '@/infrastructure/database/connection';
import { buildGoLiveReadinessSnapshot } from '@/infrastructure/operations/go-live-readiness';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const databaseState = getDatabaseConnectionState();
  const readiness = buildGoLiveReadinessSnapshot(databaseState.healthStatus === 'ok', env);

  res.status(200).json(
    buildSuccess(
      {
        status: databaseState.healthStatus,
        timestamp: new Date().toISOString(),
        version: env.APP_VERSION,
        db: databaseState.status,
        ready: readiness.ready,
        checks: readiness.checks
      },
      res.locals.traceId as string
    )
  );
});
