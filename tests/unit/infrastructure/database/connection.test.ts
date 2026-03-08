import { EventEmitter } from 'node:events';

import {
  calculateRetryDelayMs,
  createDatabaseConnectionManager,
  mapDatabaseStatusToHealthStatus
} from '@/infrastructure/database/connection';

class FakeDatabaseConnection extends EventEmitter {
  readyState = 0;
}

describe('database connection manager', () => {
  it('retries with incremental backoff until the connection succeeds', async () => {
    const connection = new FakeDatabaseConnection();
    let attempts = 0;
    const waitCalls: number[] = [];
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];

    const manager = createDatabaseConnectionManager(
      {
        environment: 'development',
        uri: 'mongodb://localhost:27017/test',
        maxPoolSize: 10,
        connectTimeoutMs: 1000,
        maxRetries: 2,
        retryDelayMs: 50
      },
      {
        connection,
        connect: async () => {
          attempts += 1;

          if (attempts < 3) {
            throw new Error(`boom-${attempts}`);
          }

          connection.readyState = 1;
          connection.emit('connected');
        },
        disconnect: async () => {
          connection.readyState = 0;
          connection.emit('disconnected');
        }
      },
      {
        wait: async (delayMs) => {
          waitCalls.push(delayMs);
        },
        logger: {
          info: (message) => {
            infoLogs.push(message);
          },
          error: (message) => {
            errorLogs.push(message);
          }
        }
      }
    );

    await manager.connect();

    expect(attempts).toBe(3);
    expect(waitCalls).toEqual([50, 100]);
    expect(manager.getState().status).toBe('connected');
    expect(manager.getState().healthStatus).toBe('ok');
    expect(infoLogs.some((message) => message.includes('scope=db.start'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=db.retry'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=db.ready'))).toBe(true);
    expect(errorLogs.some((message) => message.includes('scope=db.retry'))).toBe(true);
  });

  it('fails after the configured maximum retries', async () => {
    const connection = new FakeDatabaseConnection();
    const waitCalls: number[] = [];
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];

    const manager = createDatabaseConnectionManager(
      {
        environment: 'test',
        uri: 'mongodb://localhost:27017/test',
        maxPoolSize: 10,
        connectTimeoutMs: 1000,
        maxRetries: 1,
        retryDelayMs: 25
      },
      {
        connection,
        connect: async () => {
          throw new Error('still down');
        },
        disconnect: async () => {
          connection.readyState = 0;
          connection.emit('disconnected');
        }
      },
      {
        wait: async (delayMs) => {
          waitCalls.push(delayMs);
        },
        logger: {
          info: (message) => {
            infoLogs.push(message);
          },
          error: (message) => {
            errorLogs.push(message);
          }
        }
      }
    );

    await expect(manager.connect()).rejects.toThrow(
      'MongoDB connection failed after 2 attempts: still down'
    );
    expect(waitCalls).toEqual([25]);
    expect(manager.getState().status).toBe('disconnected');
    expect(manager.getState().lastError).toBe('still down');
    expect(infoLogs.some((message) => message.includes('scope=db.start'))).toBe(true);
    expect(errorLogs.some((message) => message.includes('scope=db.error'))).toBe(true);
  });

  it('maps database states to health states', () => {
    expect(calculateRetryDelayMs(250, 3)).toBe(750);
    expect(mapDatabaseStatusToHealthStatus('connected')).toBe('ok');
    expect(mapDatabaseStatusToHealthStatus('connecting')).toBe('degraded');
    expect(mapDatabaseStatusToHealthStatus('disconnecting')).toBe('degraded');
    expect(mapDatabaseStatusToHealthStatus('disconnected')).toBe('down');
  });

  it('logs already-open and closed states without exposing credentials', async () => {
    const connection = new FakeDatabaseConnection();
    connection.readyState = 1;
    const infoLogs: string[] = [];

    const manager = createDatabaseConnectionManager(
      {
        environment: 'production',
        uri: 'mongodb://user:password@cluster.mongodb.net/prod?retryWrites=true',
        maxPoolSize: 20,
        connectTimeoutMs: 1000,
        maxRetries: 0,
        retryDelayMs: 250
      },
      {
        connection,
        connect: async () => undefined,
        disconnect: async () => {
          connection.readyState = 0;
          connection.emit('disconnected');
        }
      },
      {
        logger: {
          info: (message) => {
            infoLogs.push(message);
          },
          error: () => undefined
        }
      }
    );

    await manager.connect();
    await manager.disconnect();
    await manager.disconnect();

    expect(infoLogs.some((message) => message.includes('scope=db.skip'))).toBe(true);
    expect(
      infoLogs.some(
        (message) =>
          message.includes('scope=db.stop') &&
          message.includes('mongodb://cluster.mongodb.net/prod') &&
          !message.includes('user:password')
      )
    ).toBe(true);
  });

  it('logs runtime disconnects and connection errors after startup', async () => {
    const connection = new FakeDatabaseConnection();
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];

    const manager = createDatabaseConnectionManager(
      {
        environment: 'production',
        uri: 'mongodb://localhost:27017/prod',
        maxPoolSize: 10,
        connectTimeoutMs: 1000,
        maxRetries: 0,
        retryDelayMs: 25
      },
      {
        connection,
        connect: async () => {
          connection.readyState = 1;
          connection.emit('connected');
        },
        disconnect: async () => {
          connection.readyState = 0;
          connection.emit('disconnected');
        }
      },
      {
        logger: {
          info: (message) => {
            infoLogs.push(message);
          },
          error: (message) => {
            errorLogs.push(message);
          }
        }
      }
    );

    await manager.connect();
    connection.readyState = 0;
    connection.emit('error', new Error('socket hang up'));
    connection.emit('disconnected');

    expect(infoLogs.some((message) => message.includes('scope=db.ready'))).toBe(true);
    expect(
      errorLogs.some(
        (message) =>
          message.includes('scope=db.error') &&
          message.includes('MongoDB connection emitted a runtime error.') &&
          message.includes('socket hang up')
      )
    ).toBe(true);
    expect(
      errorLogs.some(
        (message) =>
          message.includes('scope=db.error') &&
          message.includes('MongoDB connection lost after startup.')
      )
    ).toBe(true);
  });
});
