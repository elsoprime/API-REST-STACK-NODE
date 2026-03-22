import {
  configureInventoryReconciliationMonitor,
  getInventoryReconciliationMonitorSnapshot,
  markInventoryReconciliationRunCompleted,
  markInventoryReconciliationRunFailed,
  markInventoryReconciliationRunStarted,
  markInventoryReconciliationTickSkipped,
  resetInventoryReconciliationMonitorSnapshotForTests
} from '@/infrastructure/operations/inventory-reconciliation-status';

describe('inventory reconciliation monitor status', () => {
  beforeEach(() => {
    resetInventoryReconciliationMonitorSnapshotForTests();
  });

  it('tracks lifecycle and summary metadata for successful runs', () => {
    configureInventoryReconciliationMonitor(true, {
      driftConsecutive: 2,
      failedConsecutive: 2,
      skippedTicks: 2
    });

    markInventoryReconciliationRunStarted('2026-03-16T00:00:00.000Z');
    markInventoryReconciliationRunCompleted({
      finishedAt: '2026-03-16T00:00:02.000Z',
      durationMs: 2000,
      processedTenants: 12,
      driftDetectedTenants: 2,
      failedTenants: 0
    });

    const snapshot = getInventoryReconciliationMonitorSnapshot();

    expect(snapshot).toMatchObject({
      enabled: true,
      status: 'idle',
      lastRunStartedAt: '2026-03-16T00:00:00.000Z',
      lastRunFinishedAt: '2026-03-16T00:00:02.000Z',
      lastRunDurationMs: 2000,
      lastRunProcessedTenants: 12,
      lastRunDriftDetectedTenants: 2,
      lastRunFailedTenants: 0,
      consecutiveDriftRuns: 1,
      consecutiveFailedRuns: 0,
      lastError: null,
      skippedTicks: 0,
      thresholds: {
        driftConsecutive: 2,
        failedConsecutive: 2,
        skippedTicks: 2
      },
      alerts: {
        driftConsecutiveBreached: false,
        failedConsecutiveBreached: false,
        skippedTicksBreached: false
      }
    });
  });

  it('breaches and recovers threshold-based alerts', () => {
    configureInventoryReconciliationMonitor(true, {
      driftConsecutive: 2,
      failedConsecutive: 2,
      skippedTicks: 1
    });

    markInventoryReconciliationTickSkipped();
    markInventoryReconciliationRunCompleted({
      finishedAt: '2026-03-16T00:10:00.000Z',
      durationMs: 1000,
      processedTenants: 5,
      driftDetectedTenants: 1,
      failedTenants: 1
    });
    markInventoryReconciliationRunCompleted({
      finishedAt: '2026-03-16T00:11:00.000Z',
      durationMs: 1000,
      processedTenants: 5,
      driftDetectedTenants: 1,
      failedTenants: 1
    });

    let snapshot = getInventoryReconciliationMonitorSnapshot();

    expect(snapshot.alerts).toMatchObject({
      driftConsecutiveBreached: true,
      failedConsecutiveBreached: true,
      skippedTicksBreached: true
    });

    markInventoryReconciliationRunStarted('2026-03-16T00:12:00.000Z');
    markInventoryReconciliationRunFailed({
      finishedAt: '2026-03-16T00:12:01.000Z',
      durationMs: 1000,
      message: 'connection timeout'
    });

    snapshot = getInventoryReconciliationMonitorSnapshot();
    expect(snapshot.consecutiveFailedRuns).toBe(3);
    expect(snapshot.lastError).toBe('connection timeout');

    markInventoryReconciliationRunCompleted({
      finishedAt: '2026-03-16T00:13:00.000Z',
      durationMs: 1000,
      processedTenants: 3,
      driftDetectedTenants: 0,
      failedTenants: 0
    });

    snapshot = getInventoryReconciliationMonitorSnapshot();
    expect(snapshot.consecutiveDriftRuns).toBe(0);
    expect(snapshot.consecutiveFailedRuns).toBe(0);
    expect(snapshot.alerts.driftConsecutiveBreached).toBe(false);
    expect(snapshot.alerts.failedConsecutiveBreached).toBe(false);
    expect(snapshot.alerts.skippedTicksBreached).toBe(true);
  });
});
