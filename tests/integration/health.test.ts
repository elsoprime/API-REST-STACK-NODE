import { vi } from 'vitest';
import request from 'supertest';

import { createServer } from '@/app/server';
import * as databaseConnection from '@/infrastructure/database/connection';

describe('GET /health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with a degraded payload while the database is still connecting', async () => {
    vi.spyOn(databaseConnection, 'getDatabaseConnectionState').mockReturnValue({
      status: 'connecting',
      healthStatus: 'degraded',
      readyState: 2,
      lastError: null,
      updatedAt: new Date().toISOString()
    });

    const app = createServer();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'degraded',
        version: '3.0.0',
        db: 'connecting',
        ready: false,
        checks: {
          database: false,
          productionDeliveryAdapters: true
        }
      }
    });
    expect(response.body.traceId).toBeDefined();
  });

  it('returns down when the database is disconnected and still sets the trace header', async () => {
    vi.spyOn(databaseConnection, 'getDatabaseConnectionState').mockReturnValue({
      status: 'disconnected',
      healthStatus: 'down',
      readyState: 0,
      lastError: 'db unavailable',
      updatedAt: new Date().toISOString()
    });

    const app = createServer();
    const response = await request(app).get('/health');

    expect(response.body.data.status).toBe('down');
    expect(response.body.data.db).toBe('disconnected');
    expect(response.body.data.ready).toBe(false);
    expect(response.body.data.checks).toMatchObject({
      database: false,
      productionDeliveryAdapters: true
    });
    expect(response.headers['x-trace-id']).toBeDefined();
  });
});
