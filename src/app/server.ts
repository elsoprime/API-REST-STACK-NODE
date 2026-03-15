import express, { type Express, type Router } from 'express';
import cors from 'cors';

import { APP_CONFIG } from '@/config/app';
import { env } from '@/config/env';

import { rootRouter } from '@/app/router';
import { errorHandlerMiddleware } from '@/infrastructure/middleware/errorHandler.middleware';
import { notFoundMiddleware } from '@/infrastructure/middleware/notFound.middleware';
import { requestLoggerMiddleware } from '@/infrastructure/middleware/requestLogger.middleware';
import { createGlobalRateLimiter } from '@/infrastructure/middleware/rateLimiter.middleware';
import { securityHeadersMiddleware } from '@/infrastructure/middleware/securityHeaders.middleware';
import { traceIdMiddleware } from '@/infrastructure/middleware/traceId.middleware';

interface CreateServerOptions {
  configureApp?: (app: Express) => void;
  rootRouterOverride?: Router;
}

interface RawBodyCarrier {
  rawBody?: string;
}

const corsOriginList = env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
const corsOriginSet = new Set(corsOriginList);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (corsOriginSet.has(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true
};

export function createServer(options: CreateServerOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as RawBodyCarrier).rawBody = buffer.toString('utf8');
      }
    })
  );
  app.use(cors(corsOptions));
  app.use(traceIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(APP_CONFIG.API_PREFIX, createGlobalRateLimiter());

  app.use(options.rootRouterOverride ?? rootRouter);
  options.configureApp?.(app);
  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
