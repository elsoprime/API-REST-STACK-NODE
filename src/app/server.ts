import express, { type Express, type Router } from 'express';

import { rootRouter } from '@/app/router';
import { errorHandlerMiddleware } from '@/infrastructure/middleware/errorHandler.middleware';
import { notFoundMiddleware } from '@/infrastructure/middleware/notFound.middleware';
import { requestLoggerMiddleware } from '@/infrastructure/middleware/requestLogger.middleware';
import { traceIdMiddleware } from '@/infrastructure/middleware/traceId.middleware';

interface CreateServerOptions {
  configureApp?: (app: Express) => void;
  rootRouterOverride?: Router;
}

export function createServer(options: CreateServerOptions = {}): Express {
  const app = express();

  app.use(express.json());
  app.use(traceIdMiddleware);
  app.use(requestLoggerMiddleware);

  app.use(options.rootRouterOverride ?? rootRouter);
  options.configureApp?.(app);
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
