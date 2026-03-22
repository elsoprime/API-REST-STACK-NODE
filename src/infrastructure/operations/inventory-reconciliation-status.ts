export interface InventoryReconciliationMonitorSnapshot {
  enabled: boolean;
  status: 'disabled' | 'idle' | 'running';
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunDurationMs: number | null;
  lastRunProcessedTenants: number;
  lastRunDriftDetectedTenants: number;
  lastRunFailedTenants: number;
  consecutiveDriftRuns: number;
  consecutiveFailedRuns: number;
  lastError: string | null;
  skippedTicks: number;
  thresholds: {
    driftConsecutive: number;
    failedConsecutive: number;
    skippedTicks: number;
  };
  alerts: {
    driftConsecutiveBreached: boolean;
    failedConsecutiveBreached: boolean;
    skippedTicksBreached: boolean;
  };
}

const monitorSnapshot: InventoryReconciliationMonitorSnapshot = {
  enabled: false,
  status: 'disabled',
  lastRunStartedAt: null,
  lastRunFinishedAt: null,
  lastRunDurationMs: null,
  lastRunProcessedTenants: 0,
  lastRunDriftDetectedTenants: 0,
  lastRunFailedTenants: 0,
  consecutiveDriftRuns: 0,
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
};

function refreshInventoryReconciliationAlerts(): void {
  monitorSnapshot.alerts = {
    driftConsecutiveBreached:
      monitorSnapshot.consecutiveDriftRuns >= monitorSnapshot.thresholds.driftConsecutive,
    failedConsecutiveBreached:
      monitorSnapshot.consecutiveFailedRuns >= monitorSnapshot.thresholds.failedConsecutive,
    skippedTicksBreached: monitorSnapshot.skippedTicks >= monitorSnapshot.thresholds.skippedTicks
  };
}

export function configureInventoryReconciliationMonitor(
  enabled: boolean,
  thresholds?: {
    driftConsecutive: number;
    failedConsecutive: number;
    skippedTicks: number;
  }
): void {
  monitorSnapshot.enabled = enabled;
  monitorSnapshot.status = enabled ? 'idle' : 'disabled';

  if (thresholds) {
    monitorSnapshot.thresholds = { ...thresholds };
  }

  refreshInventoryReconciliationAlerts();
}

export function markInventoryReconciliationRunStarted(startedAt: string): void {
  monitorSnapshot.status = 'running';
  monitorSnapshot.lastRunStartedAt = startedAt;
  monitorSnapshot.lastError = null;
}

export function markInventoryReconciliationRunCompleted(input: {
  finishedAt: string;
  durationMs: number;
  processedTenants: number;
  driftDetectedTenants: number;
  failedTenants: number;
}): void {
  monitorSnapshot.status = monitorSnapshot.enabled ? 'idle' : 'disabled';
  monitorSnapshot.lastRunFinishedAt = input.finishedAt;
  monitorSnapshot.lastRunDurationMs = input.durationMs;
  monitorSnapshot.lastRunProcessedTenants = input.processedTenants;
  monitorSnapshot.lastRunDriftDetectedTenants = input.driftDetectedTenants;
  monitorSnapshot.lastRunFailedTenants = input.failedTenants;
  monitorSnapshot.consecutiveDriftRuns =
    input.driftDetectedTenants > 0 ? monitorSnapshot.consecutiveDriftRuns + 1 : 0;
  monitorSnapshot.consecutiveFailedRuns =
    input.failedTenants > 0 ? monitorSnapshot.consecutiveFailedRuns + 1 : 0;
  if (input.failedTenants === 0) {
    monitorSnapshot.lastError = null;
  }
  refreshInventoryReconciliationAlerts();
}

export function markInventoryReconciliationRunFailed(input: {
  finishedAt: string;
  durationMs: number;
  message: string;
}): void {
  monitorSnapshot.status = monitorSnapshot.enabled ? 'idle' : 'disabled';
  monitorSnapshot.lastRunFinishedAt = input.finishedAt;
  monitorSnapshot.lastRunDurationMs = input.durationMs;
  monitorSnapshot.lastError = input.message;
  monitorSnapshot.consecutiveFailedRuns += 1;
  refreshInventoryReconciliationAlerts();
}

export function markInventoryReconciliationTickSkipped(): void {
  monitorSnapshot.skippedTicks += 1;
  refreshInventoryReconciliationAlerts();
}

export function getInventoryReconciliationMonitorSnapshot(): InventoryReconciliationMonitorSnapshot {
  return {
    ...monitorSnapshot,
    thresholds: { ...monitorSnapshot.thresholds },
    alerts: { ...monitorSnapshot.alerts }
  };
}

export function resetInventoryReconciliationMonitorSnapshotForTests(): void {
  monitorSnapshot.enabled = false;
  monitorSnapshot.status = 'disabled';
  monitorSnapshot.lastRunStartedAt = null;
  monitorSnapshot.lastRunFinishedAt = null;
  monitorSnapshot.lastRunDurationMs = null;
  monitorSnapshot.lastRunProcessedTenants = 0;
  monitorSnapshot.lastRunDriftDetectedTenants = 0;
  monitorSnapshot.lastRunFailedTenants = 0;
  monitorSnapshot.consecutiveDriftRuns = 0;
  monitorSnapshot.consecutiveFailedRuns = 0;
  monitorSnapshot.lastError = null;
  monitorSnapshot.skippedTicks = 0;
  monitorSnapshot.thresholds = {
    driftConsecutive: 3,
    failedConsecutive: 2,
    skippedTicks: 3
  };
  monitorSnapshot.alerts = {
    driftConsecutiveBreached: false,
    failedConsecutiveBreached: false,
    skippedTicksBreached: false
  };
}
