import mongoose, { Types } from 'mongoose';

import { InventoryCategoryModel } from '@/modules/inventory/models/inventory-category.model';
import { InventoryItemModel } from '@/modules/inventory/models/inventory-item.model';
import { InventoryStockMovementModel } from '@/modules/inventory/models/inventory-stock-movement.model';
import { InventoryService } from '@/modules/inventory/services/inventory.service';

describe('InventoryService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps duplicate category creation to a stable conflict code', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);

    vi.spyOn(InventoryCategoryModel, 'create').mockRejectedValue({
      code: 11000
    });

    await expect(
      service.createCategory({
        tenantId: new Types.ObjectId().toString(),
        name: 'Raw Materials'
      })
    ).rejects.toMatchObject({
      code: 'INV_CATEGORY_ALREADY_EXISTS',
      statusCode: 409
    });
  });

  it('rejects stock movement when outgoing quantity would make stock negative', async () => {
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(InventoryItemModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: itemId,
        tenantId,
        currentStock: 2,
        minStock: 1,
        isActive: true
      })
    } as never);

    await expect(
      service.createStockMovement({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'out',
        quantity: 3,
        reason: 'sale'
      })
    ).rejects.toMatchObject({
      code: 'INV_STOCK_UNDERFLOW',
      statusCode: 409
    });
  });

  it('records stock movement in a transaction and emits a tenant-scoped audit event', async () => {
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const audit = {
      record: vi.fn().mockResolvedValue({
        id: new Types.ObjectId().toString()
      })
    };
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(InventoryItemModel, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue({
        _id: itemId,
        tenantId,
        currentStock: 10,
        minStock: 3,
        isActive: true
      })
    } as never);
    vi.spyOn(InventoryItemModel, 'findOneAndUpdate').mockResolvedValue({
      _id: itemId,
      tenantId,
      currentStock: 8,
      minStock: 3
    } as never);
    vi.spyOn(InventoryStockMovementModel, 'create').mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        tenantId,
        itemId,
        direction: 'out',
        quantity: 2,
        stockBefore: 10,
        stockAfter: 8,
        reason: 'sale order',
        performedByUserId: userId,
        createdAt: new Date('2026-03-08T12:00:00.000Z'),
        toObject() {
          return {
            _id: this._id,
            tenantId: this.tenantId,
            itemId: this.itemId,
            direction: this.direction,
            quantity: this.quantity,
            stockBefore: this.stockBefore,
            stockAfter: this.stockAfter,
            reason: this.reason,
            performedByUserId: this.performedByUserId,
            createdAt: this.createdAt
          };
        }
      }
    ] as never);

    const result = await service.createStockMovement({
      tenantId: tenantId.toString(),
      itemId: itemId.toString(),
      direction: 'out',
      quantity: 2,
      reason: 'sale order',
      context: {
        traceId: 'trace-inventory-move',
        actor: {
          kind: 'user',
          userId: userId.toString(),
          sessionId: new Types.ObjectId().toString(),
          scope: ['platform:self']
        },
        tenant: {
          tenantId: tenantId.toString(),
          membershipId: new Types.ObjectId().toString(),
          roleKey: 'tenant:owner',
          isOwner: true,
          effectiveRoleKeys: ['tenant:owner']
        }
      }
    });

    expect(result.stockBefore).toBe(10);
    expect(result.stockAfter).toBe(8);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tenant',
        action: 'inventory.stock.move',
        resource: {
          type: 'inventory_item',
          id: itemId.toString()
        }
      }),
      {
        session: sessionMock
      }
    );
  });
});
