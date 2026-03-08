import { EventEmitter } from 'node:events';

import express from 'express';

import { startApplication } from '@/app/runtime';

class FakeSignalProcess extends EventEmitter {
  exitCode: number | undefined;
}

describe('application runtime', () => {
  it('performs graceful shutdown on SIGTERM exactly once', async () => {
    const signalProcess = new FakeSignalProcess();
    const events: string[] = [];
    const infoLogs: string[] = [];

    const runtime = await startApplication({
      createApp: () => express(),
      connectToDatabase: async () => {
        events.push('connect');
      },
      disconnectFromDatabase: async () => {
        events.push('disconnect');
      },
      listen: async () => {
        events.push('listen');

        return {
          close: (callback) => {
            events.push('close');
            callback();
          }
        };
      },
      closeServer: async (server) => {
        server.close(() => undefined);
      },
      signalProcess,
      logger: {
        info: (message) => {
          infoLogs.push(message);
        },
        error: () => undefined
      }
    });

    signalProcess.emit('SIGTERM');
    signalProcess.emit('SIGTERM');

    await runtime.shutdown('SIGTERM');

    expect(events).toEqual(['connect', 'listen', 'close', 'disconnect']);
    expect(signalProcess.exitCode).toBe(0);
    expect(signalProcess.listenerCount('SIGTERM')).toBe(0);
    expect(infoLogs.some((message) => message.includes('scope=app.start'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=app.readiness'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=app.dependencies'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=app.ready'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('scope=app.shutdown'))).toBe(true);
    expect(infoLogs.some((message) => message.includes('environment="test"'))).toBe(true);
  });

  it('disconnects from the database if server startup fails after connecting', async () => {
    const events: string[] = [];
    const errorLogs: string[] = [];

    await expect(
      startApplication({
        createApp: () => express(),
        connectToDatabase: async () => {
          events.push('connect');
        },
        disconnectFromDatabase: async () => {
          events.push('disconnect');
        },
        listen: async () => {
          throw new Error('port busy');
        },
        logger: {
          info: () => undefined,
          error: (message) => {
            errorLogs.push(message);
          }
        }
      })
    ).rejects.toThrow('port busy');

    expect(events).toEqual(['connect', 'disconnect']);
    expect(errorLogs.some((message) => message.includes('scope=app.error'))).toBe(true);
    expect(errorLogs.some((message) => message.includes('port busy'))).toBe(true);
  });
});
