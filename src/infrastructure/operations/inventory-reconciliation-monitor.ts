import { Types } from 'mongoose';

import { env } from '@/config/env';
import { TENANT_STATUS } from '@/constants/tenant';
import { logger, type AppLogger } from '@/infrastructure/logger/logger';
import {
  configureInventoryReconciliationMonitor,
  getInventoryReconciliationMonitorSnapshot,
  markInventoryReconciliationRunCompleted,
  markInventoryReconciliationRunFailed,
  markInventoryReconciliationRunStarted,
  markInventoryReconciliationTickSkipped
} from '@/infrastructure/operations/inventory-reconciliation-status';

interface ReconciliationService {
  getReconciliation: (input: { tenantId: string; sinceDays?: number }) => Promise<{
    tenantId: string;
    comparedAt: string;
    movementCount: number;
    movementIn: number;
    movementOut: number;
    balanceTotal: number;
    itemStockTotal: number;
    drift: number;
    status: 'ok' | 'drift_detected';
  }>;
}

interface MonitorConfig {
  enabled: boolean;
  intervalMinutes: number;
  sinceDays: number;
  tenantBatchSize: number;
  driftConsecutiveAlertThreshold: number;
  failureConsecutiveAlertThreshold: number;
  skippedTicksAlertThreshold: number;
}

interface MonitorDependencies {
  inventory?: ReconciliationService;
  logger?: Pick<AppLogger, 'info' | 'warn' | 'error'>;
}

interface SweepSummary {
  processedTenants: number;
  driftDetectedTenants: number;
  failedTenants: number;
}

export interface InventoryReconciliationMonitor {
  stop: () => void;
}

function createMonitorConfig(): MonitorConfig {
  return {
    enabled: env.INVENTORY_RECONCILIATION_MONITOR_ENABLED,
    intervalMinutes: env.INVENTORY_RECONCILIATION_MONITOR_INTERVAL_MINUTES,
    sinceDays: env.INVENTORY_RECONCILIATION_MONITOR_SINCE_DAYS,
    tenantBatchSize: env.INVENTORY_RECONCILIATION_MONITOR_TENANT_BATCH_SIZE,
    driftConsecutiveAlertThreshold:
      env.INVENTORY_RECONCILIATION_ALERT_DRIFT_CONSECUTIVE_THRESHOLD,
    failureConsecutiveAlertThreshold:
      env.INVENTORY_RECONCILIATION_ALERT_FAILURE_CONSECUTIVE_THRESHOLD,
    skippedTicksAlertThreshold: env.INVENTORY_RECONCILIATION_ALERT_SKIPPED_TICKS_THRESHOLD
  };
}

async function resolveInventoryService(
  dependencies: MonitorDependencies
): Promise<ReconciliationService> {
  if (dependencies.inventory) {
    return dependencies.inventory;
  }

  const { inventoryService } = await import('@/modules/inventory/services/inventory.service');
  return inventoryService;
}

export async function runInventoryReconciliationSweep(
  config: MonitorConfig,
  dependencies: MonitorDependencies = {}
): Promise<SweepSummary> {
  const inventory = await resolveInventoryService(dependencies);
  const appLogger = dependencies.logger ?? logger;
  const { InventorySettingsModel } = await import('@/modules/inventory/models/inventory-settings.model');
  const { TenantModel } = await import('@/core/tenant/models/tenant.model');

  const settings = await InventorySettingsModel.find({
    rolloutPhase: { $in: ['cohort', 'general'] }
  })
    .select({ tenantId: 1 })
    .limit(config.tenantBatchSize)
    .lean();

  const tenantIds = settings
    .map((setting) => setting.tenantId)
    .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId);

  if (tenantIds.length === 0) {
    appLogger.info(
      { scope: 'inventory.reconciliation.monitor' },
      'No tenants matched reconciliation sweep criteria.'
    );
    return {
      processedTenants: 0,
      driftDetectedTenants: 0,
      failedTenants: 0
    };
  }

  const activeTenants = await TenantModel.find({
    _id: { $in: tenantIds },
    status: TENANT_STATUS.ACTIVE,
    activeModuleKeys: 'inventory'
  })
    .select({ _id: 1 })
    .lean();

  let driftDetectedTenants = 0;
  let failedTenants = 0;

  for (const tenant of activeTenants) {
    const tenantId = tenant._id.toString();

    try {
      const report = await inventory.getReconciliation({
        tenantId,
        sinceDays: config.sinceDays
      });

      if (report.status === 'drift_detected') {
        driftDetectedTenants += 1;
        appLogger.warn(
          {
            scope: 'inventory.reconciliation.alert',
            tenantId,
            drift: report.drift,
            sinceDays: config.sinceDays,
            movementCount: report.movementCount,
            balanceTotal: report.balanceTotal,
            itemStockTotal: report.itemStockTotal
          },
          'Inventory reconciliation drift detected.'
        );
      } else {
        appLogger.info(
          {
            scope: 'inventory.reconciliation.monitor',
            tenantId,
            drift: report.drift,
            sinceDays: config.sinceDays
          },
          'Inventory reconciliation check passed.'
        );
      }
    } catch (error) {
      failedTenants += 1;
      const message = error instanceof Error ? error.message : 'Unknown reconciliation error';
      appLogger.error(
        {
          scope: 'inventory.reconciliation.monitor',
          tenantId,
          err: error instanceof Error ? error : undefined
        },
        `Inventory reconciliation check failed: ${message}`
      );
    }
  }

  return {
    processedTenants: activeTenants.length,
    driftDetectedTenants,
    failedTenants
  };
}

export function startInventoryReconciliationMonitor(
  dependencies: MonitorDependencies = {}
): InventoryReconciliationMonitor {
  const config = createMonitorConfig();
  const appLogger = dependencies.logger ?? logger;

  configureInventoryReconciliationMonitor(config.enabled, {
    driftConsecutive: config.driftConsecutiveAlertThreshold,
    failedConsecutive: config.failureConsecutiveAlertThreshold,
    skippedTicks: config.skippedTicksAlertThreshold
  });

  if (!config.enabled) {
    return {
      stop: () => undefined
    };
  }

  let runningSweep: Promise<void> | null = null;
  let previousAlerts = getInventoryReconciliationMonitorSnapshot().alerts;

  const emitSloTransitions = () => {
    const snapshot = getInventoryReconciliationMonitorSnapshot();
    const { alerts } = snapshot;

    if (!previousAlerts.driftConsecutiveBreached && alerts.driftConsecutiveBreached) {
      appLogger.warn(
        {
          scope: 'inventory.reconciliation.slo',
          metric: 'drift_consecutive_runs',
          threshold: snapshot.thresholds.driftConsecutive,
          current: snapshot.consecutiveDriftRuns
        },
        'Inventory reconciliation SLO breached: consecutive drift runs exceeded threshold.'
      );
    }

    if (previousAlerts.driftConsecutiveBreached && !alerts.driftConsecutiveBreached) {
      appLogger.info(
        {
          scope: 'inventory.reconciliation.slo',
          metric: 'drift_consecutive_runs',
          threshold: snapshot.thresholds.driftConsecutive,
          current: snapshot.consecutiveDriftRuns
        },
        'Inventory reconciliation SLO recovered: consecutive drift runs are below threshold.'
      );
    }

    if (!previousAlerts.failedConsecutiveBreached && alerts.failedConsecutiveBreached) {
      appLogger.error(
        {
          scope: 'inventory.reconciliation.slo',
          metric: 'failed_consecutive_runs',
          threshold: snapshot.thresholds.failedConsecutive,
          current: snapshot.consecutiveFailedRuns,
          lastError: snapshot.lastError
        },
        'Inventory reconciliation SLO breached: consecutive monitor failures exceeded threshold.'
      );
    }

    if (previousAlerts.failedConsecutiveBreached && !alerts.failedConsecutiveBreached) {
      appLogger.info(
        {
          scope: 'inventory.reconciliation.slo',
          metric: 'failed_consecutive_runs',
          threshold: snapshot.thresholds.failedConsecutive,
          current: snapshot.consecutiveFailedRuns
        },
        'Inventory reconciliation SLO recovered: consecutive monitor failures are below threshold.'
      );
    }

    if (!previousAlerts.skippedTicksBreached && alerts.skippedTicksBreached) {
      appLogger.warn(
        {
          scope: 'inventory.reconciliation.slo',
          metric: 'skipped_ticks',
          threshold: snapshot.thresholds.skippedTicks,
          current: snapshot.skippedTicks
        },
        'Inventory reconciliation SLO breached: skipped scheduler ticks exceeded threshold.'
      );
    }

    previousAlerts = alerts;
  };

  const executeSweep = () => {
    if (runningSweep) {
      markInventoryReconciliationTickSkipped();
      appLogger.warn(
        { scope: 'inventory.reconciliation.monitor' },
        'Inventory reconciliation sweep skipped because a previous execution is still running.'
      );
      emitSloTransitions();
      return;
    }

    runningSweep = (async () => {
      const startedAt = new Date();
      markInventoryReconciliationRunStarted(startedAt.toISOString());

      try {
        const summary = await runInventoryReconciliationSweep(config, dependencies);

        markInventoryReconciliationRunCompleted({
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          processedTenants: summary.processedTenants,
          driftDetectedTenants: summary.driftDetectedTenants,
          failedTenants: summary.failedTenants
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown reconciliation sweep error';

        markInventoryReconciliationRunFailed({
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          message
        });

        appLogger.error(
          {
            scope: 'inventory.reconciliation.monitor',
            err: error instanceof Error ? error : undefined
          },
          `Inventory reconciliation sweep failed: ${message}`
        );
      } finally {
        emitSloTransitions();
        runningSweep = null;
      }
    })();
  };

  const intervalMs = config.intervalMinutes * 60_000;
  const timer = setInterval(executeSweep, intervalMs);

  timer.unref();

  appLogger.info(
    {
      scope: 'inventory.reconciliation.monitor',
      intervalMinutes: config.intervalMinutes,
      sinceDays: config.sinceDays,
      tenantBatchSize: config.tenantBatchSize,
      thresholds: {
        driftConsecutive: config.driftConsecutiveAlertThreshold,
        failedConsecutive: config.failureConsecutiveAlertThreshold,
        skippedTicks: config.skippedTicksAlertThreshold
      }
    },
    'Inventory reconciliation monitor started.'
  );

  executeSweep();

  return {
    stop: () => {
      clearInterval(timer);
      appLogger.info(
        { scope: 'inventory.reconciliation.monitor' },
        'Inventory reconciliation monitor stopped.'
      );
    }
  };
}
