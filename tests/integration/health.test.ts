import { vi } from 'vitest';
import request from 'supertest';

import { createServer } from '@/app/server';
import * as databaseConnection from '@/infrastructure/database/connection';
import * as inventoryMonitorStatus from '@/infrastructure/operations/inventory-reconciliation-status';

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

    vi.spyOn(
      inventoryMonitorStatus,
      'getInventoryReconciliationMonitorSnapshot'
    ).mockReturnValue({
      enabled: true,
      status: 'idle',
      lastRunStartedAt: '2026-03-16T00:00:00.000Z',
      lastRunFinishedAt: '2026-03-16T00:01:00.000Z',
      lastRunDurationMs: 120,
      lastRunProcessedTenants: 10,
      lastRunDriftDetectedTenants: 1,
      lastRunFailedTenants: 0,
      consecutiveDriftRuns: 1,
      consecutiveFailedRuns: 0,
      lastError: null,
      skippedTicks: 0,
      thresholds: {
        driftConsecutive: 3,
        failedConsecutive: 2,
        skippedTicks: 3
      },
      alerts: {
        driftConsecutiveBreached: false,
        failedConsecutiveBreached: false,
        skippedTicksBreached: false
      }
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
        },
        inventoryReconciliationMonitor: {
          enabled: true,
          status: 'idle',
          lastRunProcessedTenants: 10,
          lastRunDriftDetectedTenants: 1,
          lastRunFailedTenants: 0,
          thresholds: {
            driftConsecutive: 3,
            failedConsecutive: 2,
            skippedTicks: 3
          }
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
    expect(response.body.data.inventoryReconciliationMonitor).toBeDefined();
    expect(response.headers['x-trace-id']).toBeDefined();
  });
});
