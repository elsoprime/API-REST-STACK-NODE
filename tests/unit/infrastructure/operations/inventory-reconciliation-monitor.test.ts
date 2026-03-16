import { Types } from 'mongoose';

import { TENANT_STATUS } from '@/constants/tenant';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { InventorySettingsModel } from '@/modules/inventory/models/inventory-settings.model';
import { runInventoryReconciliationSweep } from '@/infrastructure/operations/inventory-reconciliation-monitor';

describe('inventory reconciliation monitor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits warning alerts when drift is detected for active inventory tenants', async () => {
    const tenantId = new Types.ObjectId();
    const warn = vi.fn();
    const info = vi.fn();
    const error = vi.fn();

    vi.spyOn(InventorySettingsModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ tenantId }])
        })
      })
    } as never);

    vi.spyOn(TenantModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: tenantId,
            status: TENANT_STATUS.ACTIVE,
            activeModuleKeys: ['inventory']
          }
        ])
      })
    } as never);

    const inventory = {
      getReconciliation: vi.fn().mockResolvedValue({
        tenantId: tenantId.toString(),
        comparedAt: new Date().toISOString(),
        movementCount: 5,
        movementIn: 25,
        movementOut: 22,
        balanceTotal: 100,
        itemStockTotal: 104,
        drift: 4,
        status: 'drift_detected'
      })
    };

    await runInventoryReconciliationSweep(
      {
        enabled: true,
        intervalMinutes: 60,
        sinceDays: 1,
        tenantBatchSize: 100,
        driftConsecutiveAlertThreshold: 3,
        failureConsecutiveAlertThreshold: 2,
        skippedTicksAlertThreshold: 3
      },
      {
        inventory: inventory as never,
        logger: { info, warn, error }
      }
    );

    expect(inventory.getReconciliation).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      sinceDays: 1
    });
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('logs monitor errors and continues when reconciliation fails for a tenant', async () => {
    const tenantId = new Types.ObjectId();
    const warn = vi.fn();
    const info = vi.fn();
    const error = vi.fn();

    vi.spyOn(InventorySettingsModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([{ tenantId }])
        })
      })
    } as never);

    vi.spyOn(TenantModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: tenantId,
            status: TENANT_STATUS.ACTIVE,
            activeModuleKeys: ['inventory']
          }
        ])
      })
    } as never);

    const inventory = {
      getReconciliation: vi.fn().mockRejectedValue(new Error('reconciliation unavailable'))
    };

    await runInventoryReconciliationSweep(
      {
        enabled: true,
        intervalMinutes: 60,
        sinceDays: 1,
        tenantBatchSize: 100,
        driftConsecutiveAlertThreshold: 3,
        failureConsecutiveAlertThreshold: 2,
        skippedTicksAlertThreshold: 3
      },
      {
        inventory: inventory as never,
        logger: { info, warn, error }
      }
    );

    expect(error).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
