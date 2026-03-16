import { type Server } from 'node:http';

import { type Express } from 'express';

import { createServer } from '@/app/server';
import { env } from '@/config/env';
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDatabaseConnectionState
} from '@/infrastructure/database/connection';
import { logger } from '@/infrastructure/logger/logger';
import { buildGoLiveConfigurationReadiness } from '@/infrastructure/operations/go-live-readiness';
import {
  startInventoryReconciliationMonitor,
  type InventoryReconciliationMonitor
} from '@/infrastructure/operations/inventory-reconciliation-monitor';

type ShutdownTrigger = 'manual' | 'SIGTERM';
type RuntimeLogLevel = 'INFO' | 'ERROR';
type RuntimeLogScope =
  | 'app.start'
  | 'app.dependencies'
  | 'app.readiness'
  | 'app.ready'
  | 'app.shutdown'
  | 'app.error';
type RuntimeLogValue = string | number | boolean;

interface RuntimeLogger {
  info: (message: string) => void;
  error: (message: string) => void;
}

interface SignalProcessLike {
  once: (signal: NodeJS.Signals, listener: () => void) => unknown;
  removeListener: (signal: NodeJS.Signals, listener: () => void) => unknown;
  exitCode?: number;
}

interface ServerLike {
  close: (callback: (error?: Error | null) => void) => void;
}

export interface StartedApplication {
  readonly app: Express;
  readonly server: ServerLike;
  shutdown: (trigger?: ShutdownTrigger) => Promise<void>;
}

interface RuntimeDependencies {
  createApp?: () => Express;
  connectToDatabase?: () => Promise<void>;
  disconnectFromDatabase?: () => Promise<void>;
  bootstrapPlatformSettings?: () => Promise<void>;
  startInventoryReconciliationMonitor?: () => InventoryReconciliationMonitor;
  listen?: (app: Express, port: number) => Promise<ServerLike>;
  closeServer?: (server: ServerLike) => Promise<void>;
  signalProcess?: SignalProcessLike;
  signals?: readonly NodeJS.Signals[];
  logger?: RuntimeLogger;
}

const defaultRuntimeLogger: RuntimeLogger = {
  info: (message) => {
    logger.info({ scope: 'app.lifecycle' }, message);
  },
  error: (message) => {
    logger.error({ scope: 'app.lifecycle' }, message);
  }
};

function serializeRuntimeLogValue(value: RuntimeLogValue): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function formatRuntimeLogLine(
  level: RuntimeLogLevel,
  scope: RuntimeLogScope,
  message: string,
  context: Record<string, RuntimeLogValue>
): string {
  const serializedContext = Object.entries(context)
    .map(([key, value]) => `${key}=${serializeRuntimeLogValue(value)}`)
    .join(' ');

  const baseFields = [
    `timestamp=${serializeRuntimeLogValue(new Date().toISOString())}`,
    `level=${level}`,
    `scope=${scope}`,
    `message=${serializeRuntimeLogValue(message)}`
  ];

  return [...baseFields, serializedContext].filter(Boolean).join(' ');
}

async function listenHttpServer(app: Express, port: number): Promise<ServerLike> {
  return await new Promise<Server>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };

    const server = app.listen(port, () => {
      server.removeListener('error', onError);
      resolve(server);
    });

    server.once('error', onError);
  });
}

async function closeHttpServer(server: ServerLike): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function defaultBootstrapPlatformSettings(): Promise<void> {
  const { platformSettingsService } = await import(
    '@/core/platform/settings/services/platform-settings.service'
  );

  await platformSettingsService.getSettings();
}

export async function startApplication(
  dependencies: RuntimeDependencies = {}
): Promise<StartedApplication> {
  const createApp = dependencies.createApp ?? createServer;
  const connect = dependencies.connectToDatabase ?? connectToDatabase;
  const disconnect = dependencies.disconnectFromDatabase ?? disconnectFromDatabase;
  const bootstrapPlatformSettings =
    dependencies.bootstrapPlatformSettings ?? defaultBootstrapPlatformSettings;
  const startReconciliationMonitor =
    dependencies.startInventoryReconciliationMonitor ?? startInventoryReconciliationMonitor;
  const listen = dependencies.listen ?? listenHttpServer;
  const closeServer = dependencies.closeServer ?? closeHttpServer;
  const signalProcess = dependencies.signalProcess ?? process;
  const signals = dependencies.signals ?? ['SIGTERM'];
  const logger = dependencies.logger ?? defaultRuntimeLogger;
  const registeredSignals = signals.join(',');

  const app = createApp();

  logger.info(
    formatRuntimeLogLine('INFO', 'app.start', 'Starting application bootstrap.', {
      appName: env.APP_NAME,
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      port: env.PORT,
      appUrl: env.APP_URL,
      signals: registeredSignals
    })
  );

  const goLiveConfigurationReadiness = buildGoLiveConfigurationReadiness(env);

  logger.info(
    formatRuntimeLogLine('INFO', 'app.readiness', 'Go-live configuration preflight executed.', {
      environment: env.NODE_ENV,
      productionDeliveryAdapters: goLiveConfigurationReadiness.checks.productionDeliveryAdapters
    })
  );

  if (!goLiveConfigurationReadiness.ready) {
    const missingKeys = goLiveConfigurationReadiness.missingProductionDeliveryConfigKeys.join(', ');
    const errorMessage =
      `Go-live readiness preflight failed: missing production delivery configuration keys (${missingKeys}).`;

    logger.error(
      formatRuntimeLogLine('ERROR', 'app.error', errorMessage, {
        environment: env.NODE_ENV,
        productionDeliveryAdapters: goLiveConfigurationReadiness.checks.productionDeliveryAdapters,
        missingKeys
      })
    );

    throw new Error(errorMessage);
  }

  await connect();
  const databaseState = getDatabaseConnectionState();

  logger.info(
    formatRuntimeLogLine('INFO', 'app.dependencies', 'Critical dependencies are ready.', {
      environment: env.NODE_ENV,
      databaseStatus: databaseState.status,
      healthStatus: databaseState.healthStatus
    })
  );

  try {
    await bootstrapPlatformSettings();
  } catch (error) {
    await disconnect().catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Unknown platform bootstrap error';
    logger.error(
      formatRuntimeLogLine(
        'ERROR',
        'app.error',
        'Platform settings bootstrap failed during startup.',
        {
          environment: env.NODE_ENV,
          error: message
        }
      )
    );
    throw error;
  }

  logger.info(
    formatRuntimeLogLine('INFO', 'app.dependencies', 'Platform settings singleton is ready.', {
      environment: env.NODE_ENV
    })
  );

  let server: ServerLike;

  try {
    server = await listen(app, env.PORT);
  } catch (error) {
    await disconnect().catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    logger.error(
      formatRuntimeLogLine('ERROR', 'app.error', 'HTTP server failed during bootstrap.', {
        environment: env.NODE_ENV,
        port: env.PORT,
        error: message
      })
    );
    throw error;
  }

  logger.info(
    formatRuntimeLogLine('INFO', 'app.ready', 'Application is ready to receive traffic.', {
      appName: env.APP_NAME,
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      mode: env.NODE_ENV,
      port: env.PORT,
      appUrl: env.APP_URL
    })
  );

  const inventoryReconciliationMonitor = startReconciliationMonitor();

  let shutdownPromise: Promise<void> | null = null;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  const disposeSignalHandlers = () => {
    for (const [signal, handler] of signalHandlers) {
      signalProcess.removeListener(signal, handler);
    }

    signalHandlers.clear();
  };

  const shutdown = async (trigger: ShutdownTrigger = 'manual'): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      logger.info(
        formatRuntimeLogLine('INFO', 'app.shutdown', 'Graceful shutdown started.', {
          environment: env.NODE_ENV,
          trigger,
          port: env.PORT
        })
      );

      try {
        inventoryReconciliationMonitor.stop();
        await closeServer(server);
        await disconnect();

        if (trigger !== 'manual') {
          signalProcess.exitCode = 0;
        }

        logger.info(
          formatRuntimeLogLine('INFO', 'app.shutdown', 'Application shutdown completed cleanly.', {
            environment: env.NODE_ENV,
            trigger,
            exitCode: trigger !== 'manual' ? 0 : 'n/a'
          })
        );
      } catch (error) {
        if (trigger !== 'manual') {
          signalProcess.exitCode = 1;
        }

        const message = error instanceof Error ? error.message : 'Unknown shutdown error';
        logger.error(
          formatRuntimeLogLine('ERROR', 'app.error', 'Graceful shutdown failed.', {
            environment: env.NODE_ENV,
            trigger,
            error: message
          })
        );
        throw error;
      } finally {
        disposeSignalHandlers();
      }
    })();

    return shutdownPromise;
  };

  for (const signal of signals) {
    const handler = () => {
      void shutdown(signal === 'SIGTERM' ? 'SIGTERM' : 'manual').catch(() => undefined);
    };

    signalHandlers.set(signal, handler);
    signalProcess.once(signal, handler);
  }

  return {
    app,
    server,
    shutdown
  };
}
