import { startApplication } from '@/app/runtime';
import { logger } from '@/infrastructure/logger/logger';

void startApplication().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  logger.error({ scope: 'app.bootstrap', err: error instanceof Error ? error : undefined }, message);
  process.exitCode = 1;
});
