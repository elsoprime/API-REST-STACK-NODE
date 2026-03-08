import mongoose, { type ConnectOptions } from 'mongoose';

import { env, type AppEnvironment } from '@/config/env';
import { logger } from '@/infrastructure/logger/logger';

export type DatabaseConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting';
export type ApplicationHealthStatus = 'ok' | 'degraded' | 'down';

type MongooseReadyState = 0 | 1 | 2 | 3;
type DatabaseConnectionEvent =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'disconnecting'
  | 'error';

interface DatabaseConnectionConfig {
  readonly environment: AppEnvironment;
  readonly uri: string;
  readonly maxPoolSize: number;
  readonly connectTimeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
}

export interface DatabaseConnectionState {
  readonly status: DatabaseConnectionStatus;
  readonly healthStatus: ApplicationHealthStatus;
  readonly readyState: MongooseReadyState;
  readonly lastError: string | null;
  readonly updatedAt: string;
}

interface DatabaseConnectionLogger {
  info: (message: string) => void;
  error: (message: string) => void;
}

type DatabaseLogLevel = 'INFO' | 'ERROR';
type DatabaseLogScope =
  | 'db.start'
  | 'db.ready'
  | 'db.retry'
  | 'db.error'
  | 'db.stop'
  | 'db.skip';
type DatabaseLogValue = string | number | boolean;

type DatabaseConnectionListener = (...args: unknown[]) => void;

interface DatabaseClientConnection {
  readyState: number;
  on: (event: DatabaseConnectionEvent, listener: DatabaseConnectionListener) => unknown;
}

interface DatabaseClient {
  connect: (uri: string, options: ConnectOptions) => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  connection: DatabaseClientConnection;
}

const mongooseReadyStateToStatus = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
} as const satisfies Record<MongooseReadyState, DatabaseConnectionStatus>;

const databaseStatusToHealthStatus = {
  connected: 'ok',
  connecting: 'degraded',
  disconnected: 'down',
  disconnecting: 'degraded'
} as const satisfies Record<DatabaseConnectionStatus, ApplicationHealthStatus>;

const defaultDatabaseLogger: DatabaseConnectionLogger = {
  info: (message) => {
    logger.info({ scope: 'db.lifecycle' }, message);
  },
  error: (message) => {
    logger.error({ scope: 'db.lifecycle' }, message);
  }
};

const defaultDatabaseClient: DatabaseClient = {
  connect: mongoose.connect.bind(mongoose),
  disconnect: mongoose.disconnect.bind(mongoose),
  connection: mongoose.connection as unknown as DatabaseClientConnection
};

function normalizeMongooseReadyState(readyState: number): MongooseReadyState {
  if (readyState === 1 || readyState === 2 || readyState === 3) {
    return readyState;
  }

  return 0;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'Unknown database connection error';
}

function serializeDatabaseLogValue(value: DatabaseLogValue): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function formatDatabaseLogLine(
  level: DatabaseLogLevel,
  scope: DatabaseLogScope,
  message: string,
  context: Record<string, DatabaseLogValue>
): string {
  const serializedContext = Object.entries(context)
    .map(([key, value]) => `${key}=${serializeDatabaseLogValue(value)}`)
    .join(' ');

  const baseFields = [
    `timestamp=${serializeDatabaseLogValue(new Date().toISOString())}`,
    `level=${level}`,
    `scope=${scope}`,
    `message=${serializeDatabaseLogValue(message)}`
  ];

  return [...baseFields, serializedContext].filter(Boolean).join(' ');
}

function redactMongoTarget(uri: string): string {
  const protocolMatch = uri.match(/^mongodb(?:\+srv)?:\/\//);
  const protocol = protocolMatch?.[0] ?? '';
  const withoutProtocol = uri.slice(protocol.length);
  const targetWithoutCredentials = withoutProtocol.includes('@')
    ? withoutProtocol.slice(withoutProtocol.indexOf('@') + 1)
    : withoutProtocol;
  const slashIndex = targetWithoutCredentials.indexOf('/');

  if (slashIndex === -1) {
    return `${protocol}${targetWithoutCredentials}`;
  }

  const hostSegment = targetWithoutCredentials.slice(0, slashIndex);
  const databaseSegment = targetWithoutCredentials.slice(slashIndex + 1).split('?')[0];

  return `${protocol}${hostSegment}/${databaseSegment}`;
}

function buildDatabaseConnectionState(
  readyState: MongooseReadyState,
  lastError: string | null
): DatabaseConnectionState {
  const status = mongooseReadyStateToStatus[readyState];

  return {
    status,
    healthStatus: databaseStatusToHealthStatus[status],
    readyState,
    lastError,
    updatedAt: new Date().toISOString()
  };
}

function buildMongooseConnectOptions(config: DatabaseConnectionConfig): ConnectOptions {
  return {
    maxPoolSize: config.maxPoolSize,
    serverSelectionTimeoutMS: config.connectTimeoutMs
  };
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export function calculateRetryDelayMs(baseDelayMs: number, attempt: number): number {
  return baseDelayMs * attempt;
}

export function createDatabaseConnectionConfig(
  appEnv: typeof env
): DatabaseConnectionConfig {
  const environmentUris = {
    development: appEnv.MONGODB_URI,
    test: appEnv.MONGODB_URI_TEST,
    production: appEnv.MONGODB_URI
  } as const satisfies Record<AppEnvironment, string>;

  return {
    environment: appEnv.NODE_ENV,
    uri: environmentUris[appEnv.NODE_ENV],
    maxPoolSize: appEnv.MONGODB_MAX_POOL_SIZE,
    connectTimeoutMs: appEnv.MONGODB_CONNECT_TIMEOUT_MS,
    maxRetries: appEnv.DB_CONNECT_MAX_RETRIES,
    retryDelayMs: appEnv.DB_CONNECT_RETRY_DELAY_MS
  };
}

export function mapDatabaseStatusToHealthStatus(
  status: DatabaseConnectionStatus
): ApplicationHealthStatus {
  return databaseStatusToHealthStatus[status];
}

export function createDatabaseConnectionManager(
  config: DatabaseConnectionConfig,
  client: DatabaseClient = defaultDatabaseClient,
  dependencies: {
    wait?: (delayMs: number) => Promise<void>;
    logger?: DatabaseConnectionLogger;
  } = {}
) {
  const wait = dependencies.wait ?? waitForRetry;
  const logger = dependencies.logger ?? defaultDatabaseLogger;

  let currentState = buildDatabaseConnectionState(
    normalizeMongooseReadyState(client.connection.readyState),
    null
  );
  let eventListenersAttached = false;
  let disconnectRequestedByManager = false;

  const updateState = (readyState: number, lastError: string | null = currentState.lastError) => {
    currentState = buildDatabaseConnectionState(normalizeMongooseReadyState(readyState), lastError);
  };

  const attachEventListeners = () => {
    if (eventListenersAttached) {
      return;
    }

    client.connection.on('connected', () => {
      updateState(client.connection.readyState, null);
    });
    client.connection.on('connecting', () => {
      updateState(client.connection.readyState, currentState.lastError);
    });
    client.connection.on('disconnecting', () => {
      updateState(client.connection.readyState, currentState.lastError);
    });
    client.connection.on('disconnected', () => {
      updateState(client.connection.readyState, currentState.lastError);

      if (disconnectRequestedByManager) {
        return;
      }

      logger.error(
        formatDatabaseLogLine('ERROR', 'db.error', 'MongoDB connection lost after startup.', {
          environment: config.environment,
          status: currentState.status
        })
      );
    });
    client.connection.on('error', (error) => {
      const errorMessage = toErrorMessage(error);
      updateState(client.connection.readyState, errorMessage);
      logger.error(
        formatDatabaseLogLine('ERROR', 'db.error', 'MongoDB connection emitted a runtime error.', {
          environment: config.environment,
          status: currentState.status,
          error: errorMessage
        })
      );
    });

    eventListenersAttached = true;
  };

  return {
    async connect(): Promise<void> {
      attachEventListeners();
      const totalAttempts = config.maxRetries + 1;
      const target = redactMongoTarget(config.uri);

      if (normalizeMongooseReadyState(client.connection.readyState) === 1) {
        updateState(client.connection.readyState, null);
        logger.info(
          formatDatabaseLogLine('INFO', 'db.skip', 'MongoDB connection already active.', {
            environment: config.environment,
            status: currentState.status,
            target
          })
        );
        return;
      }

      logger.info(
        formatDatabaseLogLine('INFO', 'db.start', 'Starting MongoDB connection bootstrap.', {
          environment: config.environment,
          target,
          totalAttempts,
          connectTimeoutMs: config.connectTimeoutMs,
          maxPoolSize: config.maxPoolSize
        })
      );

      for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        updateState(2, currentState.lastError);

        try {
          await client.connect(config.uri, buildMongooseConnectOptions(config));
          updateState(client.connection.readyState, null);
          logger.info(
            formatDatabaseLogLine('INFO', 'db.ready', 'MongoDB connection established.', {
              environment: config.environment,
              target,
              attempt,
              totalAttempts,
              status: currentState.status
            })
          );
          return;
        } catch (error) {
          const errorMessage = toErrorMessage(error);
          updateState(0, errorMessage);
          const isFinalAttempt = attempt === totalAttempts;

          logger.error(
            formatDatabaseLogLine(
              'ERROR',
              isFinalAttempt ? 'db.error' : 'db.retry',
              isFinalAttempt
                ? 'MongoDB connection failed after exhausting startup retries.'
                : 'MongoDB connection attempt failed.',
              {
                environment: config.environment,
                target,
                attempt,
                totalAttempts,
                error: errorMessage
              }
            )
          );

          if (isFinalAttempt) {
            throw new Error(`MongoDB connection failed after ${totalAttempts} attempts: ${errorMessage}`);
          }

          const delayMs = calculateRetryDelayMs(config.retryDelayMs, attempt);
          logger.info(
            formatDatabaseLogLine('INFO', 'db.retry', 'Retrying MongoDB connection.', {
              environment: config.environment,
              target,
              nextAttempt: attempt + 1,
              totalAttempts,
              retryDelayMs: delayMs
            })
          );
          await wait(delayMs);
        }
      }
    },

    async disconnect(): Promise<void> {
      attachEventListeners();
      const target = redactMongoTarget(config.uri);

      if (normalizeMongooseReadyState(client.connection.readyState) === 0) {
        updateState(0, currentState.lastError);
        logger.info(
          formatDatabaseLogLine('INFO', 'db.skip', 'MongoDB connection already closed.', {
            environment: config.environment,
            status: currentState.status,
            target
          })
        );
        return;
      }

      updateState(3, currentState.lastError);
      disconnectRequestedByManager = true;

      try {
        await client.disconnect();
        updateState(client.connection.readyState, null);
        logger.info(
          formatDatabaseLogLine('INFO', 'db.stop', 'MongoDB connection closed cleanly.', {
            environment: config.environment,
            target,
            status: currentState.status
          })
        );
      } catch (error) {
        const errorMessage = toErrorMessage(error);
        updateState(client.connection.readyState, errorMessage);
        throw new Error(`MongoDB disconnection failed: ${errorMessage}`);
      } finally {
        disconnectRequestedByManager = false;
      }
    },

    getState(): DatabaseConnectionState {
      return currentState;
    }
  };
}

const databaseConnectionManager = createDatabaseConnectionManager(createDatabaseConnectionConfig(env));

export async function connectToDatabase(): Promise<void> {
  await databaseConnectionManager.connect();
}

export async function disconnectFromDatabase(): Promise<void> {
  await databaseConnectionManager.disconnect();
}

export function getDatabaseConnectionState(): DatabaseConnectionState {
  return databaseConnectionManager.getState();
}
