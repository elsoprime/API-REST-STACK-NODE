import mongoose, { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { InventoryCategoryModel } from '@/modules/inventory/models/inventory-category.model';
import { InventoryWarehouseModel } from '@/modules/inventory/models/inventory-warehouse.model';
import { InventoryItemModel } from '@/modules/inventory/models/inventory-item.model';
import { InventoryBalanceModel } from '@/modules/inventory/models/inventory-balance.model';
import { InventorySettingsModel } from '@/modules/inventory/models/inventory-settings.model';
import { InventoryStockMovementModel } from '@/modules/inventory/models/inventory-stock-movement.model';
import { InventoryService } from '@/modules/inventory/services/inventory.service';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: new Types.ObjectId().toString()
    })
  };
}

function createSessionMock() {
  return {
    withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
    endSession: vi.fn().mockResolvedValue(undefined)
  };
}

function createSessionBoundResult<T>(value: T) {
  return {
    session: vi.fn().mockResolvedValue(value)
  };
}

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

  it('creates categories and records a tenant-scoped audit event', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryCategoryModel, 'create').mockResolvedValue({
      _id: categoryId,
      tenantId,
      name: ' Raw Materials ',
      description: null,
      isActive: true,
      toObject() {
        return {
          _id: categoryId,
          tenantId,
          name: ' Raw Materials ',
          description: null,
          isActive: true
        };
      }
    } as never);

    const result = await service.createCategory({
      tenantId: tenantId.toString(),
      name: ' Raw Materials '
    });

    expect(result.id).toBe(categoryId.toString());
    expect(result.tenantId).toBe(tenantId.toString());
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'tenant',
        action: 'inventory.category.create',
        resource: {
          type: 'inventory_category',
          id: categoryId.toString()
        }
      }),
      {}
    );
  });

  it('lists categories applying search filters and pagination', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        tenantId,
        name: 'Raw.* Materials',
        description: 'Filtered',
        isActive: true
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });
    vi.spyOn(InventoryCategoryModel, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(InventoryCategoryModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.listCategories({
      tenantId: tenantId.toString(),
      page: 2,
      limit: 10,
      search: 'Raw.*'
    });

    expect(InventoryCategoryModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        isActive: true,
        name: {
          $regex: 'Raw\\.\\*',
          $options: 'i'
        }
      })
    );
    expect(skip).toHaveBeenCalledWith(10);
    expect(result.page).toBe(2);
    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Raw.* Materials');
  });

  it('updates categories and maps duplicate conflicts', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    const updateSpy = vi.spyOn(InventoryCategoryModel, 'findOneAndUpdate');
    updateSpy.mockResolvedValueOnce({
      _id: categoryId,
      tenantId,
      name: 'Packaging',
      description: 'Updated',
      isActive: true,
      toObject() {
        return {
          _id: categoryId,
          tenantId,
          name: 'Packaging',
          description: 'Updated',
          isActive: true
        };
      }
    } as never);

    const result = await service.updateCategory({
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      patch: {
        name: ' Packaging ',
        description: 'Updated'
      }
    });

    expect(result.name).toBe('Packaging');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: categoryId,
        tenantId,
        isActive: true
      }),
      {
        $set: {
          name: 'Packaging',
          normalizedName: 'packaging',
          description: 'Updated'
        }
      },
      {
        new: true
      }
    );
    expect(audit.record).toHaveBeenCalled();

    updateSpy.mockRejectedValueOnce({ code: 11000 } as never);

    await expect(
      service.updateCategory({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString(),
        patch: {
          name: 'Packaging'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_ALREADY_EXISTS,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });

  it('rejects update and delete when category cannot be resolved', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryCategoryModel, 'findOneAndUpdate').mockResolvedValue(null as never);
    vi.spyOn(InventoryItemModel, 'countDocuments').mockResolvedValue(0 as never);

    await expect(
      service.updateCategory({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString(),
        patch: {
          name: 'Missing'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });

    await expect(
      service.deleteCategory({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString()
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
  });

  it('blocks category deletion while active items exist', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryItemModel, 'countDocuments').mockResolvedValue(2 as never);

    await expect(
      service.deleteCategory({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString()
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_IN_USE,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });

  it('soft deletes categories and records audit trail', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryItemModel, 'countDocuments').mockResolvedValue(0 as never);
    vi.spyOn(InventoryCategoryModel, 'findOneAndUpdate').mockResolvedValue({
      _id: categoryId,
      tenantId,
      name: 'Deprecated',
      description: null,
      isActive: false,
      toObject() {
        return {
          _id: categoryId,
          tenantId,
          name: 'Deprecated',
          description: null,
          isActive: false
        };
      }
    } as never);

    const result = await service.deleteCategory({
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString()
    });

    expect(result.isActive).toBe(false);
    expect(audit.record).toHaveBeenCalled();
  });


  it('creates warehouses and records audit trail', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const warehouseId = new Types.ObjectId();

    vi.spyOn(InventoryWarehouseModel, 'create').mockResolvedValue({
      _id: warehouseId,
      tenantId,
      name: 'Main',
      description: null,
      isActive: true,
      toObject() {
        return {
          _id: warehouseId,
          tenantId,
          name: 'Main',
          description: null,
          isActive: true
        };
      }
    } as never);

    const result = await service.createWarehouse({
      tenantId: tenantId.toString(),
      name: ' Main '
    });

    expect(result.id).toBe(warehouseId.toString());
    expect(result.name).toBe('Main');
    expect(audit.record).toHaveBeenCalled();
  });

  it('lists warehouses with search and pagination', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        tenantId,
        name: 'Main',
        description: null,
        isActive: true
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });

    vi.spyOn(InventoryWarehouseModel, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(InventoryWarehouseModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.listWarehouses({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 20,
      search: 'Ma'
    });

    expect(InventoryWarehouseModel.find).toHaveBeenCalled();
    expect(result.items[0].name).toBe('Main');
    expect(result.total).toBe(1);
  });

  it('updates warehouses and maps not found/duplicate errors', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const warehouseId = new Types.ObjectId();

    const updateSpy = vi.spyOn(InventoryWarehouseModel, 'findOneAndUpdate');
    updateSpy.mockResolvedValueOnce({
      _id: warehouseId,
      tenantId,
      name: 'Main-2',
      description: null,
      isActive: true,
      toObject() {
        return {
          _id: warehouseId,
          tenantId,
          name: 'Main-2',
          description: null,
          isActive: true
        };
      }
    } as never);

    const result = await service.updateWarehouse({
      tenantId: tenantId.toString(),
      warehouseId: warehouseId.toString(),
      patch: {
        name: 'Main-2'
      }
    });

    expect(result.name).toBe('Main-2');

    updateSpy.mockResolvedValueOnce(null as never);
    await expect(
      service.updateWarehouse({
        tenantId: tenantId.toString(),
        warehouseId: warehouseId.toString(),
        patch: {
          name: 'Missing'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_WAREHOUSE_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });

    updateSpy.mockRejectedValueOnce({ code: 11000 } as never);
    await expect(
      service.updateWarehouse({
        tenantId: tenantId.toString(),
        warehouseId: warehouseId.toString(),
        patch: {
          name: 'Dup'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_WAREHOUSE_ALREADY_EXISTS,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });
  it('rejects item creation when category cannot be resolved', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);

    vi.spyOn(InventoryCategoryModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(
      service.createItem({
        tenantId: new Types.ObjectId().toString(),
        categoryId: new Types.ObjectId().toString(),
        sku: 'SKU-1',
        name: 'Widget',
        initialStock: 5,
        minStock: 2
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
  });

  it('creates items, normalizes sku and maps duplicate conflicts', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    vi.spyOn(InventoryCategoryModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: categoryId })
    } as never);
    const createSpy = vi.spyOn(InventoryItemModel, 'create');
    createSpy.mockResolvedValueOnce({
      _id: itemId,
      tenantId,
      categoryId,
      sku: 'sku-1',
      name: 'Widget',
      description: null,
      currentStock: 5,
      minStock: 2,
      isActive: true,
      toObject() {
        return {
          _id: itemId,
          tenantId,
          categoryId,
          sku: 'sku-1',
          name: 'Widget',
          description: null,
          currentStock: 5,
          minStock: 2,
          isActive: true
        };
      }
    } as never);

    const result = await service.createItem({
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      sku: ' sku-1 ',
      name: ' Widget ',
      initialStock: 5,
      minStock: 2
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        categoryId,
        sku: 'sku-1',
        normalizedSku: 'SKU-1',
        name: 'Widget',
        currentStock: 5,
        minStock: 2,
        isActive: true
      })
    );
    expect(result.isLowStock).toBe(false);
    expect(audit.record).toHaveBeenCalled();

    createSpy.mockRejectedValueOnce({ code: 11000 } as never);

    await expect(
      service.createItem({
        tenantId: tenantId.toString(),
        categoryId: categoryId.toString(),
        sku: 'sku-1',
        name: 'Widget',
        initialStock: 5,
        minStock: 2
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_ALREADY_EXISTS,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });

  it('lists items with category, search and low stock filters', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const findLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        tenantId,
        categoryId,
        sku: 'W-01',
        name: 'Widget',
        description: null,
        currentStock: 2,
        minStock: 3,
        isActive: true
      }
    ]);
    const limit = vi.fn().mockReturnValue({ lean: findLean });
    const skip = vi.fn().mockReturnValue({ limit });
    const sort = vi.fn().mockReturnValue({ skip });

    vi.spyOn(InventoryItemModel, 'find').mockReturnValue({ sort } as never);
    vi.spyOn(InventoryItemModel, 'countDocuments').mockResolvedValue(1 as never);

    const result = await service.listItems({
      tenantId: tenantId.toString(),
      categoryId: categoryId.toString(),
      page: 1,
      limit: 20,
      search: 'W-0.',
      lowStockOnly: true
    });

    expect(InventoryItemModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        categoryId,
        isActive: true,
        $expr: {
          $lte: ['$currentStock', '$minStock']
        },
        $or: [
          { name: { $regex: 'W-0\\.', $options: 'i' } },
          { sku: { $regex: 'W-0\\.', $options: 'i' } }
        ]
      })
    );
    expect(result.items[0].isLowStock).toBe(true);
  });

  it('gets items and fails when the item does not exist', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const findOneSpy = vi.spyOn(InventoryItemModel, 'findOne');

    findOneSpy.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue({
        _id: itemId,
        tenantId,
        categoryId: new Types.ObjectId(),
        sku: 'W-01',
        name: 'Widget',
        description: null,
        currentStock: 1,
        minStock: 2,
        isActive: true
      })
    } as never);

    const result = await service.getItem({
      tenantId: tenantId.toString(),
      itemId: itemId.toString()
    });

    expect(result.id).toBe(itemId.toString());
    expect(result.isLowStock).toBe(true);

    findOneSpy.mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(
      service.getItem({
        tenantId: tenantId.toString(),
        itemId: itemId.toString()
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
  });

  it('updates items, validates category changes and maps duplicate conflicts', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryCategoryModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: categoryId })
    } as never);
    const updateSpy = vi.spyOn(InventoryItemModel, 'findOneAndUpdate');
    updateSpy.mockResolvedValueOnce({
      _id: itemId,
      tenantId,
      categoryId,
      sku: 'NEW-1',
      name: 'New Widget',
      description: 'Updated',
      currentStock: 4,
      minStock: 1,
      isActive: true,
      toObject() {
        return {
          _id: itemId,
          tenantId,
          categoryId,
          sku: 'NEW-1',
          name: 'New Widget',
          description: 'Updated',
          currentStock: 4,
          minStock: 1,
          isActive: true
        };
      }
    } as never);

    const result = await service.updateItem({
      tenantId: tenantId.toString(),
      itemId: itemId.toString(),
      patch: {
        categoryId: categoryId.toString(),
        sku: ' new-1 ',
        name: ' New Widget ',
        description: 'Updated',
        minStock: 1
      }
    });

    expect(result.sku).toBe('NEW-1');
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: itemId,
        tenantId,
        isActive: true
      }),
      {
        $set: {
          categoryId,
          sku: 'new-1',
          normalizedSku: 'NEW-1',
          name: 'New Widget',
          description: 'Updated',
          minStock: 1
        }
      },
      {
        new: true
      }
    );
    expect(audit.record).toHaveBeenCalled();

    updateSpy.mockRejectedValueOnce({ code: 11000 } as never);

    await expect(
      service.updateItem({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        patch: {
          sku: 'dup-1'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_ALREADY_EXISTS,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });

  it('fails item update for missing category or missing item', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();

    vi.spyOn(InventoryCategoryModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(
      service.updateItem({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        patch: {
          categoryId: categoryId.toString()
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });

    vi.spyOn(InventoryItemModel, 'findOneAndUpdate').mockResolvedValue(null as never);

    await expect(
      service.updateItem({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        patch: {
          name: 'Missing'
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
  });

  it('soft deletes items and maps missing item errors', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const categoryId = new Types.ObjectId();
    const updateSpy = vi.spyOn(InventoryItemModel, 'findOneAndUpdate');

    updateSpy.mockResolvedValueOnce({
      _id: itemId,
      tenantId,
      categoryId,
      sku: 'W-01',
      name: 'Widget',
      description: null,
      currentStock: 3,
      minStock: 1,
      isActive: false,
      toObject() {
        return {
          _id: itemId,
          tenantId,
          categoryId,
          sku: 'W-01',
          name: 'Widget',
          description: null,
          currentStock: 3,
          minStock: 1,
          isActive: false
        };
      }
    } as never);

    const result = await service.deleteItem({
      tenantId: tenantId.toString(),
      itemId: itemId.toString()
    });

    expect(result.isActive).toBe(false);
    expect(audit.record).toHaveBeenCalled();

    updateSpy.mockResolvedValueOnce(null as never);

    await expect(
      service.deleteItem({
        tenantId: tenantId.toString(),
        itemId: itemId.toString()
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
  });

  it('rejects stock movement when outgoing quantity would make stock negative', async () => {
    const sessionMock = createSessionMock();
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

  it('rejects stock movement when the item cannot be resolved', async () => {
    const sessionMock = createSessionMock();
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(InventoryItemModel, 'findOne').mockReturnValue(createSessionBoundResult(null) as never);

    await expect(
      service.createStockMovement({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 1,
        reason: 'restock'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
      statusCode: HTTP_STATUS.NOT_FOUND
    });
    expect(sessionMock.endSession).toHaveBeenCalled();
  });

  it('rejects stock movement when inventory changed concurrently', async () => {
    const sessionMock = createSessionMock();
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(InventoryItemModel, 'findOne').mockReturnValue(createSessionBoundResult({
      _id: itemId,
      tenantId,
      currentStock: 4,
      minStock: 1,
      isActive: true
    }) as never);
    vi.spyOn(InventoryItemModel, 'findOneAndUpdate').mockResolvedValue(null as never);

    await expect(
      service.createStockMovement({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 2,
        reason: 'restock'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVENTORY_STOCK_CONFLICT,
      statusCode: HTTP_STATUS.CONFLICT
    });
  });

  it('records stock movement in a transaction and emits a tenant-scoped audit event', async () => {
    const sessionMock = createSessionMock();
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
    expect(result.performedByUserId).toBe(userId.toString());
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

  it('creates inbound stock movements without actor user and fails closed when movement view is missing', async () => {
    const sessionMock = createSessionMock();
    const service = new InventoryService(createAuditStub() as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const findOneSpy = vi.spyOn(InventoryItemModel, 'findOne');
    const updateSpy = vi.spyOn(InventoryItemModel, 'findOneAndUpdate');
    const createSpy = vi.spyOn(InventoryStockMovementModel, 'create');

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    findOneSpy.mockReturnValue(createSessionBoundResult({
      _id: itemId,
      tenantId,
      currentStock: 1,
      minStock: 2,
      isActive: true
    }) as never);
    updateSpy.mockResolvedValue({
      _id: itemId,
      tenantId,
      currentStock: 4,
      minStock: 2
    } as never);
    createSpy.mockResolvedValueOnce([
      {
        _id: new Types.ObjectId(),
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 3,
        stockBefore: 1,
        stockAfter: 4,
        reason: 'restock',
        performedByUserId: undefined,
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
            performedByUserId: this.performedByUserId
          };
        }
      }
    ] as never);

    const result = await service.createStockMovement({
      tenantId: tenantId.toString(),
      itemId: itemId.toString(),
      direction: 'in',
      quantity: 3,
      reason: '  restock  ',
      context: {
        traceId: 'trace-inventory-system',
        actor: {
          kind: 'system'
        }
      } as never
    });

    expect(result.stockAfter).toBe(4);
    expect(result.performedByUserId).toBeNull();

    createSpy.mockResolvedValueOnce([] as never);

    await expect(
      service.createStockMovement({
        tenantId: tenantId.toString(),
        itemId: itemId.toString(),
        direction: 'in',
        quantity: 1,
        reason: 'restock'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.INTERNAL_ERROR,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR
    });
  });

  it('lists stock movements and low stock alerts with pagination', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const movementFindLean = vi.fn().mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        tenantId,
        itemId,
        direction: 'in',
        quantity: 2,
        stockBefore: 1,
        stockAfter: 3,
        reason: 'restock',
        performedByUserId: null,
        createdAt: new Date('2026-03-08T12:00:00.000Z')
      }
    ]);
    const movementLimit = vi.fn().mockReturnValue({ lean: movementFindLean });
    const movementSkip = vi.fn().mockReturnValue({ limit: movementLimit });
    const movementSort = vi.fn().mockReturnValue({ skip: movementSkip });
    const itemFindLean = vi.fn().mockResolvedValue([
      {
        _id: itemId,
        tenantId,
        categoryId: new Types.ObjectId(),
        sku: 'W-01',
        name: 'Widget',
        description: null,
        currentStock: 1,
        minStock: 3,
        isActive: true
      }
    ]);
    const itemLimit = vi.fn().mockReturnValue({ lean: itemFindLean });
    const itemSkip = vi.fn().mockReturnValue({ limit: itemLimit });
    const itemSort = vi.fn().mockReturnValue({ skip: itemSkip });

    vi.spyOn(InventoryStockMovementModel, 'find').mockReturnValue({ sort: movementSort } as never);
    vi.spyOn(InventoryStockMovementModel, 'countDocuments').mockResolvedValue(1 as never);
    vi.spyOn(InventoryItemModel, 'find').mockReturnValue({ sort: itemSort } as never);
    vi.spyOn(InventoryItemModel, 'countDocuments').mockResolvedValue(1 as never);

    const movements = await service.listStockMovements({
      tenantId: tenantId.toString(),
      itemId: itemId.toString(),
      page: 2,
      limit: 5
    });
    const alerts = await service.listLowStockAlerts({
      tenantId: tenantId.toString(),
      page: 1,
      limit: 10
    });

    expect(InventoryStockMovementModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        itemId
      })
    );
    expect(movements.items[0].performedByUserId).toBeNull();
    expect(movements.page).toBe(2);
    expect(alerts.items[0].item.isLowStock).toBe(true);
    expect(alerts.items[0].deficit).toBe(2);
  });

  it('fails closed when tenant execution context does not match requested tenant', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const requestedTenantId = new Types.ObjectId().toString();
    const mismatchedTenantId = new Types.ObjectId().toString();
    const createCategorySpy = vi.spyOn(InventoryCategoryModel, 'create');
    const startSessionSpy = vi.spyOn(mongoose, 'startSession');

    await expect(
      service.createCategory({
        tenantId: requestedTenantId,
        name: 'Raw Materials',
        context: {
          traceId: 'trace-inventory-tenant-mismatch-category',
          actor: {
            kind: 'user',
            userId: new Types.ObjectId().toString(),
            sessionId: new Types.ObjectId().toString(),
            scope: ['platform:self']
          },
          tenant: {
            tenantId: mismatchedTenantId
          }
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.createStockMovement({
        tenantId: requestedTenantId,
        itemId: new Types.ObjectId().toString(),
        direction: 'in',
        quantity: 5,
        reason: 'restock',
        context: {
          traceId: 'trace-inventory-tenant-mismatch-stock',
          actor: {
            kind: 'user',
            userId: new Types.ObjectId().toString(),
            sessionId: new Types.ObjectId().toString(),
            scope: ['platform:self']
          },
          tenant: {
            tenantId: mismatchedTenantId
          }
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    expect(createCategorySpy).not.toHaveBeenCalled();
    expect(startSessionSpy).not.toHaveBeenCalled();
  });

  it('fails closed when tenant context ids are malformed', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);

    await expect(
      service.createItem({
        tenantId: 'not-an-object-id',
        categoryId: new Types.ObjectId().toString(),
        sku: 'SKU-1',
        name: 'Widget',
        initialStock: 1,
        minStock: 1,
        context: {
          tenant: {
            tenantId: 'also-invalid'
          }
        } as never
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });
  });
  it('returns default rollout settings when tenant has no inventory settings', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();

    vi.spyOn(InventorySettingsModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    const result = await service.getSettings(tenantId.toString());

    expect(result).toEqual({
      tenantId: tenantId.toString(),
      lotAllocationPolicy: 'FIFO',
      rolloutPhase: 'pilot',
      capabilities: {
        warehouses: true,
        lots: false,
        stocktakes: false
      }
    });
  });

  it('updates rollout settings partially and records audit metadata', async () => {
    const audit = createAuditStub();
    const service = new InventoryService(audit as never);
    const tenantId = new Types.ObjectId();

    const updateSpy = vi.spyOn(InventorySettingsModel, 'findOneAndUpdate');
    updateSpy.mockResolvedValue({
      tenantId,
      lotAllocationPolicy: 'FEFO',
      rolloutPhase: 'cohort',
      capabilities: {
        warehouses: true,
        lots: true,
        stocktakes: false
      },
      toObject() {
        return {
          tenantId,
          lotAllocationPolicy: 'FEFO',
          rolloutPhase: 'cohort',
          capabilities: {
            warehouses: true,
            lots: true,
            stocktakes: false
          }
        };
      }
    } as never);

    const result = await service.updateSettings({
      tenantId: tenantId.toString(),
      rolloutPhase: 'cohort',
      capabilities: {
        lots: true
      }
    });

    expect(result.rolloutPhase).toBe('cohort');
    expect(result.capabilities.lots).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('computes reconciliation report from movements, balances and item stock', async () => {
    const service = new InventoryService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();

    const movementAggregateSpy = vi.spyOn(InventoryStockMovementModel, 'aggregate').mockResolvedValue([
      {
        movementCount: 3,
        movementIn: 20,
        movementOut: 12
      }
    ] as never);
    const balanceAggregateSpy = vi.spyOn(InventoryBalanceModel, 'aggregate').mockResolvedValue([
      {
        balanceTotal: 40
      }
    ] as never);
    const itemAggregateSpy = vi.spyOn(InventoryItemModel, 'aggregate').mockResolvedValue([
      {
        itemStockTotal: 42
      }
    ] as never);

    const report = await service.getReconciliation({
      tenantId: tenantId.toString(),
      sinceDays: 1
    });

    expect(report.movementCount).toBe(3);
    expect(report.balanceTotal).toBe(40);
    expect(report.itemStockTotal).toBe(42);
    expect(report.drift).toBe(2);
    expect(report.status).toBe('drift_detected');
    expect(movementAggregateSpy).toHaveBeenCalled();
    expect(balanceAggregateSpy).toHaveBeenCalled();
    expect(itemAggregateSpy).toHaveBeenCalled();
  });
});

