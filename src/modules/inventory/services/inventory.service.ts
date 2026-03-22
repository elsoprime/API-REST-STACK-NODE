import mongoose, { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type AuditTenantScope,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { InventoryBalanceModel } from '@/modules/inventory/models/inventory-balance.model';
import { InventoryCategoryModel } from '@/modules/inventory/models/inventory-category.model';
import { InventoryItemModel } from '@/modules/inventory/models/inventory-item.model';
import { InventoryLotModel } from '@/modules/inventory/models/inventory-lot.model';
import { InventorySettingsModel } from '@/modules/inventory/models/inventory-settings.model';
import { InventoryStocktakeModel } from '@/modules/inventory/models/inventory-stocktake.model';
import { InventoryStockMovementModel } from '@/modules/inventory/models/inventory-stock-movement.model';
import { InventoryWarehouseModel } from '@/modules/inventory/models/inventory-warehouse.model';
import {
  type CreateInventoryCategoryInput,
  type CreateInventoryItemInput,
  type CreateInventoryLotInput,
  type CreateInventoryMovementCommandInput,
  type CreateInventoryStockMovementInput,
  type CreateInventoryStocktakeInput,
  type CreateInventoryWarehouseInput,
  type DeleteInventoryCategoryInput,
  type DeleteInventoryItemInput,
  type ApplyInventoryStocktakeInput,
  type CancelInventoryStocktakeInput,
  type GetInventoryItemInput,
  type GetInventoryReconciliationInput,
  type GetInventoryStocktakeInput,
  type InventoryCategoryView,
  type InventoryExpiringLotAlertView,
  type InventoryItemView,
  type InventoryLotAllocationPolicy,
  type InventoryLotView,
  type InventoryLowStockAlertView,
  type InventoryReconciliationView,
  type InventoryMovementDirection,
  type InventoryServiceContract,
  type InventorySettingsView,
  type InventoryStockMovementView,
  type InventoryStocktakeLineView,
  type InventoryStocktakeView,
  type InventoryWarehouseView,
  type ListInventoryCategoriesInput,
  type ListInventoryCategoriesResult,
  type ListInventoryExpiringLotAlertsInput,
  type ListInventoryExpiringLotAlertsResult,
  type ListInventoryItemsInput,
  type ListInventoryItemsResult,
  type ListInventoryLotsInput,
  type ListInventoryLotsResult,
  type ListInventoryLowStockAlertsInput,
  type ListInventoryLowStockAlertsResult,
  type ListInventoryStockMovementsInput,
  type ListInventoryStocktakesInput,
  type ListInventoryStocktakesResult,
  type ListInventoryStockMovementsResult,
  type ListInventoryWarehousesInput,
  type ListInventoryWarehousesResult,
  type UpsertInventoryStocktakeCountsInput,
  type UpdateInventoryCategoryInput,
  type UpdateInventoryItemInput,
  type UpdateInventoryLotInput,
  type UpdateInventorySettingsInput,
  type UpdateInventoryWarehouseInput
} from '@/modules/inventory/types/inventory.types';

function buildInventoryError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function assertTenantContextConsistency(tenantId: string, context?: ExecutionContext): void {
  const contextTenantId = context?.tenant?.tenantId;

  if (!contextTenantId) {
    return;
  }

  if (!Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(contextTenantId)) {
    throw buildInventoryError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Types.ObjectId(tenantId).toString() !== new Types.ObjectId(contextTenantId).toString()) {
    throw buildInventoryError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function toCategoryView(category: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}): InventoryCategoryView {
  return {
    id: category.id ?? category._id?.toString() ?? '',
    tenantId: typeof category.tenantId === 'string' ? category.tenantId : category.tenantId.toString(),
    name: category.name,
    description: category.description ?? null,
    isActive: category.isActive ?? true
  };
}

function toWarehouseView(warehouse: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}): InventoryWarehouseView {
  return {
    id: warehouse.id ?? warehouse._id?.toString() ?? '',
    tenantId: typeof warehouse.tenantId === 'string' ? warehouse.tenantId : warehouse.tenantId.toString(),
    name: warehouse.name,
    description: warehouse.description ?? null,
    isActive: warehouse.isActive ?? true
  };
}
function toItemView(item: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  categoryId: Types.ObjectId | string;
  sku: string;
  name: string;
  description?: string | null;
  currentStock: number;
  minStock: number;
  isActive?: boolean;
}): InventoryItemView {
  return {
    id: item.id ?? item._id?.toString() ?? '',
    tenantId: typeof item.tenantId === 'string' ? item.tenantId : item.tenantId.toString(),
    categoryId: typeof item.categoryId === 'string' ? item.categoryId : item.categoryId.toString(),
    sku: item.sku,
    name: item.name,
    description: item.description ?? null,
    currentStock: item.currentStock,
    minStock: item.minStock,
    isLowStock: item.currentStock <= item.minStock,
    isActive: item.isActive ?? true
  };
}

function toLotView(lot: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  itemId: Types.ObjectId | string;
  warehouseId: Types.ObjectId | string;
  lotCode: string;
  receivedAt: Date;
  expiresAt?: Date | null;
  initialQuantity: number;
  currentQuantity: number;
  isActive?: boolean;
}): InventoryLotView {
  return {
    id: lot.id ?? lot._id?.toString() ?? '',
    tenantId: typeof lot.tenantId === 'string' ? lot.tenantId : lot.tenantId.toString(),
    itemId: typeof lot.itemId === 'string' ? lot.itemId : lot.itemId.toString(),
    warehouseId: typeof lot.warehouseId === 'string' ? lot.warehouseId : lot.warehouseId.toString(),
    lotCode: lot.lotCode,
    receivedAt: lot.receivedAt.toISOString(),
    expiresAt: lot.expiresAt ? lot.expiresAt.toISOString() : null,
    initialQuantity: lot.initialQuantity,
    currentQuantity: lot.currentQuantity,
    isActive: lot.isActive ?? true
  };
}

function toSettingsView(settings: {
  tenantId: Types.ObjectId | string;
  lotAllocationPolicy: InventoryLotAllocationPolicy;
  rolloutPhase?: 'pilot' | 'cohort' | 'general';
  capabilities?: {
    warehouses?: boolean;
    lots?: boolean;
    stocktakes?: boolean;
  } | null;
}): InventorySettingsView {
  return {
    tenantId: typeof settings.tenantId === 'string' ? settings.tenantId : settings.tenantId.toString(),
    lotAllocationPolicy: settings.lotAllocationPolicy,
    rolloutPhase: settings.rolloutPhase ?? 'pilot',
    capabilities: {
      warehouses: settings.capabilities?.warehouses ?? true,
      lots: settings.capabilities?.lots ?? false,
      stocktakes: settings.capabilities?.stocktakes ?? false
    }
  };
}

function toStocktakeLineView(line: {
  itemId: Types.ObjectId | string;
  countedStock: number;
  lotId?: Types.ObjectId | string | null;
}): InventoryStocktakeLineView {
  return {
    itemId: typeof line.itemId === 'string' ? line.itemId : line.itemId.toString(),
    countedStock: line.countedStock,
    lotId:
      typeof line.lotId === 'undefined' || line.lotId === null
        ? null
        : typeof line.lotId === 'string'
          ? line.lotId
          : line.lotId.toString()
  };
}

function toStocktakeView(stocktake: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  warehouseId: Types.ObjectId | string;
  name: string;
  status: 'draft' | 'in_progress' | 'review' | 'applied' | 'cancelled';
  lines?: Array<{
    itemId: Types.ObjectId | string;
    countedStock: number;
    lotId?: Types.ObjectId | string | null;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}): InventoryStocktakeView {
  return {
    id: stocktake.id ?? stocktake._id?.toString() ?? '',
    tenantId: typeof stocktake.tenantId === 'string' ? stocktake.tenantId : stocktake.tenantId.toString(),
    warehouseId:
      typeof stocktake.warehouseId === 'string' ? stocktake.warehouseId : stocktake.warehouseId.toString(),
    name: stocktake.name,
    status: stocktake.status,
    lines: (stocktake.lines ?? []).map((line) => toStocktakeLineView(line)),
    createdAt: (stocktake.createdAt ?? new Date()).toISOString(),
    updatedAt: (stocktake.updatedAt ?? new Date()).toISOString()
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayDiffUtc(from: Date, to: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / dayMs);
}

function toStockMovementView(movement: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  itemId: Types.ObjectId | string;
  direction: 'in' | 'out';
  movementType?: 'entry' | 'exit' | 'adjust' | 'transfer' | 'return';
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  warehouseId?: Types.ObjectId | string | null;
  sourceWarehouseId?: Types.ObjectId | string | null;
  destinationWarehouseId?: Types.ObjectId | string | null;
  idempotencyKey?: string | null;
  performedByUserId?: Types.ObjectId | string | null;
  createdAt?: Date;
}): InventoryStockMovementView {
  return {
    id: movement.id ?? movement._id?.toString() ?? '',
    tenantId: typeof movement.tenantId === 'string' ? movement.tenantId : movement.tenantId.toString(),
    itemId: typeof movement.itemId === 'string' ? movement.itemId : movement.itemId.toString(),
    direction: movement.direction,
    movementType: movement.movementType ?? 'adjust',
    quantity: movement.quantity,
    stockBefore: movement.stockBefore,
    stockAfter: movement.stockAfter,
    reason: movement.reason,
    warehouseId:
      typeof movement.warehouseId === 'undefined' || movement.warehouseId === null
        ? null
        : typeof movement.warehouseId === 'string'
          ? movement.warehouseId
          : movement.warehouseId.toString(),
    sourceWarehouseId:
      typeof movement.sourceWarehouseId === 'undefined' || movement.sourceWarehouseId === null
        ? null
        : typeof movement.sourceWarehouseId === 'string'
          ? movement.sourceWarehouseId
          : movement.sourceWarehouseId.toString(),
    destinationWarehouseId:
      typeof movement.destinationWarehouseId === 'undefined' || movement.destinationWarehouseId === null
        ? null
        : typeof movement.destinationWarehouseId === 'string'
          ? movement.destinationWarehouseId
          : movement.destinationWarehouseId.toString(),
    idempotencyKey: movement.idempotencyKey ?? null,
    performedByUserId:
      typeof movement.performedByUserId === 'undefined' || movement.performedByUserId === null
        ? null
        : typeof movement.performedByUserId === 'string'
          ? movement.performedByUserId
          : movement.performedByUserId.toString(),
    createdAt: (movement.createdAt ?? new Date()).toISOString()
  };
}

function toTenantAuditScope(tenantId: string, context?: ExecutionContext): AuditTenantScope {
  return {
    tenantId,
    membershipId: context?.tenant?.membershipId,
    roleKey: context?.tenant?.roleKey,
    isOwner: context?.tenant?.isOwner,
    effectiveRoleKeys: context?.tenant?.effectiveRoleKeys
  };
}

function toAuditActorUserId(context?: ExecutionContext): Types.ObjectId | null {
  if (!context || context.actor.kind !== 'user') {
    return null;
  }

  if (!Types.ObjectId.isValid(context.actor.userId)) {
    return null;
  }

  return new Types.ObjectId(context.actor.userId);
}

export class InventoryService implements InventoryServiceContract {
  constructor(private readonly audit: AuditService = auditService) {}

  async createCategory(input: CreateInventoryCategoryInput): Promise<InventoryCategoryView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    try {
      const createdCategory = await InventoryCategoryModel.create({
        tenantId: new Types.ObjectId(input.tenantId),
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        description: input.description ?? null,
        isActive: true
      });
      const view = toCategoryView(createdCategory.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.category.create',
        resource: {
          type: 'inventory_category',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            isActive: view.isActive
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_CATEGORY_ALREADY_EXISTS,
          'Inventory category already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listCategories(input: ListInventoryCategoriesInput): Promise<ListInventoryCategoriesResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.search) {
      query.name = {
        $regex: escapeRegexLiteral(input.search),
        $options: 'i'
      };
    }

    const skip = (input.page - 1) * input.limit;
    const [categories, total] = await Promise.all([
      InventoryCategoryModel.find(query).sort({ name: 1 }).skip(skip).limit(input.limit).lean(),
      InventoryCategoryModel.countDocuments(query)
    ]);

    return {
      items: categories.map((category) => toCategoryView(category)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async updateCategory(input: UpdateInventoryCategoryInput): Promise<InventoryCategoryView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const categoryId = new Types.ObjectId(input.categoryId);
    const updateData: Record<string, unknown> = {};

    if (typeof input.patch.name === 'string') {
      updateData.name = input.patch.name.trim();
      updateData.normalizedName = normalizeName(input.patch.name);
    }

    if (typeof input.patch.description !== 'undefined') {
      updateData.description = input.patch.description;
    }

    try {
      const updatedCategory = await InventoryCategoryModel.findOneAndUpdate(
        {
          _id: categoryId,
          tenantId,
          isActive: true
        },
        {
          $set: updateData
        },
        {
          new: true
        }
      );

      if (!updatedCategory) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
          'Inventory category not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      const view = toCategoryView(updatedCategory.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.category.update',
        resource: {
          type: 'inventory_category',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            description: view.description
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_CATEGORY_ALREADY_EXISTS,
          'Inventory category already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async deleteCategory(input: DeleteInventoryCategoryInput): Promise<InventoryCategoryView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const categoryId = new Types.ObjectId(input.categoryId);
    const activeItemsCount = await InventoryItemModel.countDocuments({
      tenantId,
      categoryId,
      isActive: true
    });

    if (activeItemsCount > 0) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_CATEGORY_IN_USE,
        'Inventory category cannot be deleted while active items exist',
        HTTP_STATUS.CONFLICT
      );
    }

    const deletedCategory = await InventoryCategoryModel.findOneAndUpdate(
      {
        _id: categoryId,
        tenantId,
        isActive: true
      },
      {
        $set: {
          isActive: false
        }
      },
      {
        new: true
      }
    );

    if (!deletedCategory) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
        'Inventory category not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toCategoryView(deletedCategory.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.category.delete',
      resource: {
        type: 'inventory_category',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive']
      }
    });

    return view;
  }

    async createWarehouse(input: CreateInventoryWarehouseInput): Promise<InventoryWarehouseView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    try {
      const createdWarehouse = await InventoryWarehouseModel.create({
        tenantId: new Types.ObjectId(input.tenantId),
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        description: input.description ?? null,
        isActive: true
      });
      const view = toWarehouseView(createdWarehouse.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.warehouse.create',
        resource: {
          type: 'inventory_warehouse',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            isActive: view.isActive
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_WAREHOUSE_ALREADY_EXISTS,
          'Inventory warehouse already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listWarehouses(input: ListInventoryWarehousesInput): Promise<ListInventoryWarehousesResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.search) {
      query.name = {
        $regex: escapeRegexLiteral(input.search),
        $options: 'i'
      };
    }

    const skip = (input.page - 1) * input.limit;
    const [warehouses, total] = await Promise.all([
      InventoryWarehouseModel.find(query).sort({ name: 1 }).skip(skip).limit(input.limit).lean(),
      InventoryWarehouseModel.countDocuments(query)
    ]);

    return {
      items: warehouses.map((warehouse) => toWarehouseView(warehouse)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async updateWarehouse(input: UpdateInventoryWarehouseInput): Promise<InventoryWarehouseView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const warehouseId = new Types.ObjectId(input.warehouseId);
    const updateData: Record<string, unknown> = {};

    if (typeof input.patch.name === 'string') {
      updateData.name = input.patch.name.trim();
      updateData.normalizedName = normalizeName(input.patch.name);
    }

    if (typeof input.patch.description !== 'undefined') {
      updateData.description = input.patch.description;
    }

    if (typeof input.patch.isActive === 'boolean') {
      updateData.isActive = input.patch.isActive;
    }

    try {
      const updatedWarehouse = await InventoryWarehouseModel.findOneAndUpdate(
        {
          _id: warehouseId,
          tenantId
        },
        {
          $set: updateData
        },
        {
          new: true
        }
      );

      if (!updatedWarehouse) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_WAREHOUSE_NOT_FOUND,
          'Inventory warehouse not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      const view = toWarehouseView(updatedWarehouse.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.warehouse.update',
        resource: {
          type: 'inventory_warehouse',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            description: view.description,
            isActive: view.isActive
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_WAREHOUSE_ALREADY_EXISTS,
          'Inventory warehouse already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }
  async createItem(input: CreateInventoryItemInput): Promise<InventoryItemView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const category = await InventoryCategoryModel.findOne({
      _id: new Types.ObjectId(input.categoryId),
      tenantId,
      isActive: true
    }).lean();

    if (!category) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
        'Inventory category not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    try {
      const createdItem = await InventoryItemModel.create({
        tenantId,
        categoryId: new Types.ObjectId(input.categoryId),
        sku: input.sku.trim(),
        normalizedSku: normalizeSku(input.sku),
        name: input.name.trim(),
        description: input.description ?? null,
        currentStock: input.initialStock,
        minStock: input.minStock,
        isActive: true
      });
      const view = toItemView(createdItem.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.item.create',
        resource: {
          type: 'inventory_item',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            sku: view.sku,
            currentStock: view.currentStock,
            minStock: view.minStock
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_ITEM_ALREADY_EXISTS,
          'Inventory item already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listItems(input: ListInventoryItemsInput): Promise<ListInventoryItemsResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.categoryId) {
      query.categoryId = new Types.ObjectId(input.categoryId);
    }

    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    }

    if (input.lowStockOnly) {
      query.$expr = {
        $lte: ['$currentStock', '$minStock']
      };
    }

    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      InventoryItemModel.find(query).sort({ name: 1 }).skip(skip).limit(input.limit).lean(),
      InventoryItemModel.countDocuments(query)
    ]);

    return {
      items: items.map((item) => toItemView(item)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getItem(input: GetInventoryItemInput): Promise<InventoryItemView> {
    const item = await InventoryItemModel.findOne({
      _id: new Types.ObjectId(input.itemId),
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    }).lean();

    if (!item) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
        'Inventory item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toItemView(item);
  }

  async updateItem(input: UpdateInventoryItemInput): Promise<InventoryItemView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const itemId = new Types.ObjectId(input.itemId);
    const updateData: Record<string, unknown> = {};

    if (input.patch.categoryId) {
      const category = await InventoryCategoryModel.findOne({
        _id: new Types.ObjectId(input.patch.categoryId),
        tenantId,
        isActive: true
      }).lean();

      if (!category) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_CATEGORY_NOT_FOUND,
          'Inventory category not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      updateData.categoryId = new Types.ObjectId(input.patch.categoryId);
    }

    if (typeof input.patch.sku === 'string') {
      updateData.sku = input.patch.sku.trim();
      updateData.normalizedSku = normalizeSku(input.patch.sku);
    }

    if (typeof input.patch.name === 'string') {
      updateData.name = input.patch.name.trim();
    }

    if (typeof input.patch.description !== 'undefined') {
      updateData.description = input.patch.description;
    }

    if (typeof input.patch.minStock === 'number') {
      updateData.minStock = input.patch.minStock;
    }

    try {
      const updatedItem = await InventoryItemModel.findOneAndUpdate(
        {
          _id: itemId,
          tenantId,
          isActive: true
        },
        {
          $set: updateData
        },
        {
          new: true
        }
      );

      if (!updatedItem) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
          'Inventory item not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      const view = toItemView(updatedItem.toObject());

      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'inventory.item.update',
        resource: {
          type: 'inventory_item',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            sku: view.sku,
            name: view.name,
            minStock: view.minStock
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_ITEM_ALREADY_EXISTS,
          'Inventory item already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async deleteItem(input: DeleteInventoryItemInput): Promise<InventoryItemView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const deletedItem = await InventoryItemModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(input.itemId),
        tenantId: new Types.ObjectId(input.tenantId),
        isActive: true
      },
      {
        $set: {
          isActive: false
        }
      },
      {
        new: true
      }
    );

    if (!deletedItem) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
        'Inventory item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toItemView(deletedItem.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.item.delete',
      resource: {
        type: 'inventory_item',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive']
      }
    });

    return view;
  }

  async createLot(input: CreateInventoryLotInput): Promise<InventoryLotView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const itemId = new Types.ObjectId(input.itemId);
    const warehouseId = new Types.ObjectId(input.warehouseId);
    const lotCode = input.lotCode.trim();
    const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
    const expiresAt = typeof input.expiresAt === 'undefined' ? null : input.expiresAt ? new Date(input.expiresAt) : null;

    const [item, warehouse] = await Promise.all([
      InventoryItemModel.findOne({ _id: itemId, tenantId, isActive: true }).lean(),
      InventoryWarehouseModel.findOne({ _id: warehouseId, tenantId, isActive: true }).lean()
    ]);

    if (!item) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
        'Inventory item not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!warehouse) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_WAREHOUSE_NOT_FOUND,
        'Inventory warehouse not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const session = await mongoose.startSession();

    try {
      let view: InventoryLotView | null = null;

      await session.withTransaction(async () => {
        const lot = await InventoryLotModel.findOneAndUpdate(
          {
            tenantId,
            itemId,
            warehouseId,
            lotCode
          },
          {
            $setOnInsert: {
              receivedAt,
              isActive: true
            },
            $set: {
              expiresAt
            },
            $inc: {
              initialQuantity: input.quantity,
              currentQuantity: input.quantity
            }
          },
          {
            upsert: true,
            new: true,
            session
          }
        );

        if (!lot) {
          throw buildInventoryError(
            ERROR_CODES.INTERNAL_ERROR,
            'Inventory lot did not complete',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        await InventoryBalanceModel.findOneAndUpdate(
          {
            tenantId,
            itemId,
            warehouseId
          },
          {
            $setOnInsert: {
              isActive: true,
              currentStock: 0
            },
            $inc: {
              currentStock: input.quantity
            }
          },
          {
            upsert: true,
            new: true,
            session
          }
        );

        await InventoryItemModel.findOneAndUpdate(
          {
            _id: itemId,
            tenantId,
            isActive: true
          },
          {
            $inc: {
              currentStock: input.quantity
            }
          },
          {
            session,
            new: true
          }
        );

        view = toLotView(lot.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'inventory.lot.create',
            resource: {
              type: 'inventory_item',
              id: input.itemId
            },
            severity: 'info',
            metadata: {
              warehouseId: input.warehouseId,
              lotCode,
              quantity: input.quantity,
              expiresAt: view.expiresAt
            }
          },
          { session }
        );
      });

      if (!view) {
        throw buildInventoryError(
          ERROR_CODES.INTERNAL_ERROR,
          'Inventory lot did not complete',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_LOT_ALREADY_EXISTS,
          'Inventory lot already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }

  async listLots(input: ListInventoryLotsInput): Promise<ListInventoryLotsResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.itemId) {
      query.itemId = new Types.ObjectId(input.itemId);
    }


    if (input.warehouseId) {
      query.warehouseId = new Types.ObjectId(input.warehouseId);
    }

    if (input.expiringBefore) {
      query.expiresAt = {
        $lte: new Date(input.expiringBefore)
      };
    }

    const skip = (input.page - 1) * input.limit;
    const [lots, total] = await Promise.all([
      InventoryLotModel.find(query)
        .sort({ expiresAt: 1, receivedAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(input.limit)
        .lean(),
      InventoryLotModel.countDocuments(query)
    ]);

    return {
      items: lots.map((lot) => toLotView(lot)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async updateLot(input: UpdateInventoryLotInput): Promise<InventoryLotView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const lotId = new Types.ObjectId(input.lotId);
    const patch: Record<string, unknown> = {};

    if (typeof input.patch.expiresAt !== 'undefined') {
      patch.expiresAt = input.patch.expiresAt ? new Date(input.patch.expiresAt) : null;
    }

    if (typeof input.patch.isActive === 'boolean') {
      patch.isActive = input.patch.isActive;
    }

    const lot = await InventoryLotModel.findOneAndUpdate(
      {
        _id: lotId,
        tenantId
      },
      {
        $set: patch
      },
      {
        new: true
      }
    );

    if (!lot) {
      throw buildInventoryError(ERROR_CODES.INVENTORY_LOT_NOT_FOUND, 'Inventory lot not found', HTTP_STATUS.NOT_FOUND);
    }

    const view = toLotView(lot.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.lot.update',
      resource: {
        type: 'inventory_item',
        id: view.itemId
      },
      severity: 'info',
      metadata: {
        lotId: view.id,
        fields: Object.keys(input.patch)
      }
    });

    return view;
  }

  async getSettings(tenantId: string): Promise<InventorySettingsView> {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const settings = await InventorySettingsModel.findOne({ tenantId: tenantObjectId }).lean();

    if (!settings) {
      return {
        tenantId,
        lotAllocationPolicy: 'FIFO',
        rolloutPhase: 'pilot',
        capabilities: {
          warehouses: true,
          lots: false,
          stocktakes: false
        }
      };
    }

    return toSettingsView(settings);
  }

  async updateSettings(input: UpdateInventorySettingsInput): Promise<InventorySettingsView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const settings = await InventorySettingsModel.findOneAndUpdate(
      {
        tenantId
      },
      {
        $set: {
          ...(typeof input.lotAllocationPolicy !== 'undefined' ? { lotAllocationPolicy: input.lotAllocationPolicy } : {}),
          ...(typeof input.rolloutPhase !== 'undefined' ? { rolloutPhase: input.rolloutPhase } : {}),
          ...(typeof input.capabilities !== 'undefined' ? { capabilities: input.capabilities } : {})
        },
        $setOnInsert: {
          lotAllocationPolicy: input.lotAllocationPolicy ?? 'FIFO',
          rolloutPhase: input.rolloutPhase ?? 'pilot',
          capabilities: {
            warehouses: input.capabilities?.warehouses ?? true,
            lots: input.capabilities?.lots ?? false,
            stocktakes: input.capabilities?.stocktakes ?? false
          }
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    if (!settings) {
      throw buildInventoryError(
        ERROR_CODES.INTERNAL_ERROR,
        'Inventory settings update failed',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const view = toSettingsView(settings.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.settings.update',
      resource: {
        type: 'inventory_item',
        id: 'inventory-settings'
      },
      severity: 'info',
      metadata: {
        lotAllocationPolicy: view.lotAllocationPolicy,
        rolloutPhase: view.rolloutPhase,
        capabilities: view.capabilities
      }
    });

    return view;
  }
  async getReconciliation(input: GetInventoryReconciliationInput): Promise<InventoryReconciliationView> {
    const tenantId = new Types.ObjectId(input.tenantId);
    const sinceDays = input.sinceDays ?? 1;
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const [movementStats, balances, items] = await Promise.all([
      InventoryStockMovementModel.aggregate<{
        movementCount: number;
        movementIn: number;
        movementOut: number;
      }>([
        {
          $match: {
            tenantId,
            createdAt: { $gte: sinceDate }
          }
        },
        {
          $group: {
            _id: null,
            movementCount: { $sum: 1 },
            movementIn: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'in'] }, '$quantity', 0]
              }
            },
            movementOut: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'out'] }, '$quantity', 0]
              }
            }
          }
        }
      ]),
      InventoryBalanceModel.aggregate<{ balanceTotal: number }>([
        {
          $match: {
            tenantId,
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            balanceTotal: { $sum: '$currentStock' }
          }
        }
      ]),
      InventoryItemModel.aggregate<{ itemStockTotal: number }>([
        {
          $match: {
            tenantId,
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            itemStockTotal: { $sum: '$currentStock' }
          }
        }
      ])
    ]);

    const movement = movementStats[0] ?? {
      movementCount: 0,
      movementIn: 0,
      movementOut: 0
    };
    const balanceTotal = balances[0]?.balanceTotal ?? 0;
    const itemStockTotal = items[0]?.itemStockTotal ?? 0;
    const drift = itemStockTotal - balanceTotal;

    return {
      tenantId: input.tenantId,
      comparedAt: new Date().toISOString(),
      movementCount: movement.movementCount,
      movementIn: movement.movementIn,
      movementOut: movement.movementOut,
      balanceTotal,
      itemStockTotal,
      drift,
      status: drift === 0 ? 'ok' : 'drift_detected'
    };
  }
  async createStocktake(input: CreateInventoryStocktakeInput): Promise<InventoryStocktakeView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const warehouseId = new Types.ObjectId(input.warehouseId);

    const warehouse = await InventoryWarehouseModel.findOne({
      _id: warehouseId,
      tenantId,
      isActive: true
    }).lean();

    if (!warehouse) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_WAREHOUSE_NOT_FOUND,
        'Inventory warehouse not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const created = await InventoryStocktakeModel.create({
      tenantId,
      warehouseId,
      name: input.name.trim(),
      status: 'draft',
      lines: (input.lines ?? []).map((line) => ({
        itemId: new Types.ObjectId(line.itemId),
        countedStock: line.countedStock,
        lotId: line.lotId ? new Types.ObjectId(line.lotId) : null
      }))
    });

    const view = toStocktakeView(created.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.stocktake.create',
      resource: {
        type: 'inventory_item',
        id: 'stocktake'
      },
      severity: 'info',
      metadata: {
        stocktakeId: view.id,
        warehouseId: view.warehouseId,
        lines: view.lines.length
      }
    });

    return view;
  }

  async upsertStocktakeCounts(input: UpsertInventoryStocktakeCountsInput): Promise<InventoryStocktakeView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const stocktakeId = new Types.ObjectId(input.stocktakeId);

    const stocktake = await InventoryStocktakeModel.findOne({
      _id: stocktakeId,
      tenantId
    });

    if (!stocktake) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_STOCKTAKE_NOT_FOUND,
        'Inventory stocktake not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (stocktake.status === 'applied' || stocktake.status === 'cancelled') {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_STOCKTAKE_STATE_INVALID,
        'Inventory stocktake cannot be modified in current state',
        HTTP_STATUS.CONFLICT
      );
    }

    stocktake.set('lines', input.lines.map((line) => ({
      itemId: new Types.ObjectId(line.itemId),
      countedStock: line.countedStock,
      lotId: line.lotId ? new Types.ObjectId(line.lotId) : null
    })));

    if (stocktake.status === 'draft') {
      stocktake.status = 'in_progress';
    }

    await stocktake.save();

    const view = toStocktakeView(stocktake.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.stocktake.counts.upsert',
      resource: {
        type: 'inventory_item',
        id: 'stocktake'
      },
      severity: 'info',
      metadata: {
        stocktakeId: view.id,
        lines: view.lines.length
      }
    });

    return view;
  }

  async applyStocktake(input: ApplyInventoryStocktakeInput): Promise<InventoryStocktakeView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const stocktakeId = new Types.ObjectId(input.stocktakeId);
    const session = await mongoose.startSession();

    try {
      let view: InventoryStocktakeView | null = null;

      await session.withTransaction(async () => {
        const stocktake = await InventoryStocktakeModel.findOne({
          _id: stocktakeId,
          tenantId
        }).session(session);

        if (!stocktake) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_STOCKTAKE_NOT_FOUND,
            'Inventory stocktake not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        if (stocktake.status === 'applied' || stocktake.status === 'cancelled') {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_STOCKTAKE_STATE_INVALID,
            'Inventory stocktake cannot be applied in current state',
            HTTP_STATUS.CONFLICT
          );
        }

        const warehouseId = stocktake.warehouseId as Types.ObjectId;

        for (const line of stocktake.lines) {
          const itemId = line.itemId as Types.ObjectId;
          const countedStock = line.countedStock;

          const item = await InventoryItemModel.findOne({ _id: itemId, tenantId, isActive: true }).session(session);

          if (!item) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
              'Inventory item not found',
              HTTP_STATUS.NOT_FOUND
            );
          }

          const balance = await InventoryBalanceModel.findOneAndUpdate(
            {
              tenantId,
              itemId,
              warehouseId
            },
            {
              $setOnInsert: {
                isActive: true,
                currentStock: 0
              }
            },
            {
              upsert: true,
              new: true,
              session
            }
          );

          if (!balance) {
            throw buildInventoryError(
              ERROR_CODES.INTERNAL_ERROR,
              'Inventory stocktake apply did not complete',
              HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
          }

          const delta = countedStock - balance.currentStock;

          if (delta === 0) {
            continue;
          }

          const updatedBalance = await InventoryBalanceModel.findOneAndUpdate(
            {
              _id: balance._id,
              tenantId,
              currentStock: balance.currentStock
            },
            {
              $set: {
                currentStock: countedStock
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedBalance) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          const stockBefore = item.currentStock;
          const stockAfter = stockBefore + delta;

          if (stockAfter < 0) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
              'Inventory stock cannot be negative',
              HTTP_STATUS.CONFLICT
            );
          }

          const updatedItem = await InventoryItemModel.findOneAndUpdate(
            {
              _id: item._id,
              tenantId,
              currentStock: stockBefore
            },
            {
              $set: {
                currentStock: stockAfter
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedItem) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          await InventoryStockMovementModel.create(
            [
              {
                tenantId,
                itemId,
                direction: delta > 0 ? 'in' : 'out',
                movementType: 'adjust',
                quantity: Math.abs(delta),
                stockBefore,
                stockAfter,
                reason: `stocktake:${stocktake._id.toString()}`,
                warehouseId,
                performedByUserId: toAuditActorUserId(input.context)
              }
            ],
            { session }
          );
        }

        stocktake.status = 'applied';
        await stocktake.save({ session });
        view = toStocktakeView(stocktake.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'inventory.stocktake.apply',
            resource: {
              type: 'inventory_item',
              id: 'stocktake'
            },
            severity: 'warning',
            metadata: {
              stocktakeId: stocktake._id.toString(),
              warehouseId: warehouseId.toString(),
              lines: stocktake.lines.length
            }
          },
          { session }
        );
      });

      if (!view) {
        throw buildInventoryError(
          ERROR_CODES.INTERNAL_ERROR,
          'Inventory stocktake apply did not complete',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return view;
    } finally {
      await session.endSession();
    }
  }

  async cancelStocktake(input: CancelInventoryStocktakeInput): Promise<InventoryStocktakeView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const stocktakeId = new Types.ObjectId(input.stocktakeId);

    const stocktake = await InventoryStocktakeModel.findOne({
      _id: stocktakeId,
      tenantId
    });

    if (!stocktake) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_STOCKTAKE_NOT_FOUND,
        'Inventory stocktake not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (stocktake.status === 'applied' || stocktake.status === 'cancelled') {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_STOCKTAKE_STATE_INVALID,
        'Inventory stocktake cannot be cancelled in current state',
        HTTP_STATUS.CONFLICT
      );
    }

    stocktake.status = 'cancelled';
    await stocktake.save();

    const view = toStocktakeView(stocktake.toObject());

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'inventory.stocktake.cancel',
      resource: {
        type: 'inventory_item',
        id: 'stocktake'
      },
      severity: 'warning',
      metadata: {
        stocktakeId: view.id
      }
    });

    return view;
  }

  async getStocktake(input: GetInventoryStocktakeInput): Promise<InventoryStocktakeView> {
    const stocktake = await InventoryStocktakeModel.findOne({
      _id: new Types.ObjectId(input.stocktakeId),
      tenantId: new Types.ObjectId(input.tenantId)
    }).lean();

    if (!stocktake) {
      throw buildInventoryError(
        ERROR_CODES.INVENTORY_STOCKTAKE_NOT_FOUND,
        'Inventory stocktake not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toStocktakeView(stocktake);
  }

  async listStocktakes(input: ListInventoryStocktakesInput): Promise<ListInventoryStocktakesResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId)
    };

    if (input.warehouseId) {
      query.warehouseId = new Types.ObjectId(input.warehouseId);
    }

    if (input.status) {
      query.status = input.status;
    }

    const skip = (input.page - 1) * input.limit;
    const [stocktakes, total] = await Promise.all([
      InventoryStocktakeModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
      InventoryStocktakeModel.countDocuments(query)
    ]);

    return {
      items: stocktakes.map((stocktake) => toStocktakeView(stocktake)),
      page: input.page,
      limit: input.limit,
      total
    };
  }
  async createStockMovement(
    input: CreateInventoryStockMovementInput
  ): Promise<InventoryStockMovementView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const session = await mongoose.startSession();
    const tenantId = new Types.ObjectId(input.tenantId);
    const itemId = new Types.ObjectId(input.itemId);
    const reason = input.reason.trim();
    let movementView: InventoryStockMovementView | null = null;

    try {
      await session.withTransaction(async () => {
        const item = await InventoryItemModel.findOne({
          _id: itemId,
          tenantId,
          isActive: true
        }).session(session);

        if (!item) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
            'Inventory item not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        const stockBefore = item.currentStock;
        const delta = input.direction === 'in' ? input.quantity : -input.quantity;
        const stockAfter = stockBefore + delta;

        if (stockAfter < 0) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
            'Inventory stock cannot be negative',
            HTTP_STATUS.CONFLICT
          );
        }

        const updatedItem = await InventoryItemModel.findOneAndUpdate(
          {
            _id: item._id,
            tenantId,
            currentStock: stockBefore
          },
          {
            $set: {
              currentStock: stockAfter
            }
          },
          {
            new: true,
            session
          }
        );

        if (!updatedItem) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_STOCK_CONFLICT,
            'Inventory stock changed concurrently, retry the operation',
            HTTP_STATUS.CONFLICT
          );
        }

        const [movement] = await InventoryStockMovementModel.create(
          [
            {
              tenantId,
              itemId: item._id,
              direction: input.direction,
              quantity: input.quantity,
              stockBefore,
              stockAfter,
              reason,
              performedByUserId: toAuditActorUserId(input.context)
            }
          ],
          { session }
        );

        if (!movement) {
          throw buildInventoryError(
            ERROR_CODES.INTERNAL_ERROR,
            'Inventory stock movement did not complete',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        movementView = toStockMovementView(movement.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'inventory.stock.move',
            resource: {
              type: 'inventory_item',
              id: item._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                currentStock: stockBefore
              },
              after: {
                currentStock: stockAfter
              },
              fields: ['currentStock']
            },
            metadata: {
              direction: input.direction,
              quantity: input.quantity,
              reason
            }
          },
          { session }
        );
      });

      if (!movementView) {
        throw buildInventoryError(
          ERROR_CODES.INTERNAL_ERROR,
          'Inventory stock movement did not complete',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return movementView;
    } finally {
      await session.endSession();
    }
  }

  async createMovementCommand(
    input: CreateInventoryMovementCommandInput
  ): Promise<InventoryStockMovementView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = new Types.ObjectId(input.tenantId);
    const itemId = new Types.ObjectId(input.itemId);
    const quantity = input.quantity;
    const reason = input.reason.trim();
    const idempotencyKey = input.idempotencyKey?.trim() || null;

    if (idempotencyKey) {
      const existing = await InventoryStockMovementModel.findOne({
        tenantId,
        idempotencyKey
      }).lean();

      if (existing) {
        return toStockMovementView(existing);
      }
    }

    const session = await mongoose.startSession();
    let movementView: InventoryStockMovementView | null = null;

    const ensureWarehouse = async (warehouseId: string): Promise<Types.ObjectId> => {
      const warehouseObjectId = new Types.ObjectId(warehouseId);
      const warehouse = await InventoryWarehouseModel.findOne({
        _id: warehouseObjectId,
        tenantId,
        isActive: true
      }).session(session);

      if (!warehouse) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_WAREHOUSE_NOT_FOUND,
          'Inventory warehouse not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      return warehouseObjectId;
    };

    const resolveLotPolicy = async (): Promise<InventoryLotAllocationPolicy> => {
      const settings = await InventorySettingsModel.findOne({ tenantId }).session(session).lean();
      return settings?.lotAllocationPolicy === 'FEFO' ? 'FEFO' : 'FIFO';
    };

    const consumeLots = async (
      warehouseId: Types.ObjectId,
      qty: number
    ): Promise<
      Array<{
        lotCode: string;
        quantity: number;
        receivedAt: Date;
        expiresAt: Date | null;
      }>
    > => {
      const lotPolicy = await resolveLotPolicy();
      const lotSort: Record<string, 1 | -1> =
        lotPolicy === 'FEFO'
          ? { expiresAt: 1, receivedAt: 1, createdAt: 1 }
          : { receivedAt: 1, createdAt: 1 };

      const lots = await InventoryLotModel.find({
        tenantId,
        itemId,
        warehouseId,
        isActive: true,
        currentQuantity: { $gt: 0 }
      })
        .sort(lotSort)
        .session(session)
        .lean();

      if (lots.length === 0) {
        return [];
      }

      const available = lots.reduce((acc, lot) => acc + lot.currentQuantity, 0);

      if (available < qty) {
        throw buildInventoryError(
          ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
          'Inventory stock cannot be negative',
          HTTP_STATUS.CONFLICT
        );
      }

      let remaining = qty;
      const consumed: Array<{
        lotCode: string;
        quantity: number;
        receivedAt: Date;
        expiresAt: Date | null;
      }> = [];

      for (const lot of lots) {
        if (remaining <= 0) {
          break;
        }

        const lotQuantity = Math.min(lot.currentQuantity, remaining);
        const nextQuantity = lot.currentQuantity - lotQuantity;

        const updatedLot = await InventoryLotModel.findOneAndUpdate(
          {
            _id: lot._id,
            tenantId,
            currentQuantity: lot.currentQuantity
          },
          {
            $set: {
              currentQuantity: nextQuantity,
              isActive: nextQuantity > 0
            }
          },
          {
            new: true,
            session
          }
        );

        if (!updatedLot) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_STOCK_CONFLICT,
            'Inventory stock changed concurrently, retry the operation',
            HTTP_STATUS.CONFLICT
          );
        }

        consumed.push({
          lotCode: lot.lotCode,
          quantity: lotQuantity,
          receivedAt: lot.receivedAt,
          expiresAt: lot.expiresAt ?? null
        });
        remaining -= lotQuantity;
      }

      return consumed;
    };

    try {
      await session.withTransaction(async () => {
        const item = await InventoryItemModel.findOne({
          _id: itemId,
          tenantId,
          isActive: true
        }).session(session);

        if (!item) {
          throw buildInventoryError(
            ERROR_CODES.INVENTORY_ITEM_NOT_FOUND,
            'Inventory item not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        const movementType = input.movementType;
        const direction: InventoryMovementDirection =
          movementType === 'entry' || movementType === 'return'
            ? 'in'
            : movementType === 'exit' || movementType === 'transfer'
              ? 'out'
              : input.direction ?? 'in';

        const stockBefore = item.currentStock;
        let stockAfter = stockBefore;

        const upsertBalance = async (warehouseId: Types.ObjectId) =>
          InventoryBalanceModel.findOneAndUpdate(
            {
              tenantId,
              itemId,
              warehouseId
            },
            {
              $setOnInsert: {
                currentStock: 0,
                isActive: true
              }
            },
            {
              upsert: true,
              new: true,
              session
            }
          );

        let warehouseId: Types.ObjectId | null = null;
        let sourceWarehouseId: Types.ObjectId | null = null;
        let destinationWarehouseId: Types.ObjectId | null = null;

        if (movementType === 'transfer') {
          if (!input.sourceWarehouseId || !input.destinationWarehouseId) {
            throw buildInventoryError(
              ERROR_CODES.VALIDATION_ERROR,
              'sourceWarehouseId and destinationWarehouseId are required for transfer',
              HTTP_STATUS.BAD_REQUEST
            );
          }

          sourceWarehouseId = await ensureWarehouse(input.sourceWarehouseId);
          destinationWarehouseId = await ensureWarehouse(input.destinationWarehouseId);

          const sourceBalance = await upsertBalance(sourceWarehouseId);

          if (!sourceBalance || sourceBalance.currentStock < quantity) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
              'Inventory stock cannot be negative',
              HTTP_STATUS.CONFLICT
            );
          }

          const consumedLots = await consumeLots(sourceWarehouseId, quantity);

          const updatedSource = await InventoryBalanceModel.findOneAndUpdate(
            {
              _id: sourceBalance._id,
              tenantId,
              currentStock: sourceBalance.currentStock
            },
            {
              $set: {
                currentStock: sourceBalance.currentStock - quantity
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedSource) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          const destinationBalance = await upsertBalance(destinationWarehouseId);

          if (!destinationBalance) {
            throw buildInventoryError(
              ERROR_CODES.INTERNAL_ERROR,
              'Inventory stock movement did not complete',
              HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
          }

          const updatedDestination = await InventoryBalanceModel.findOneAndUpdate(
            {
              _id: destinationBalance._id,
              tenantId,
              currentStock: destinationBalance.currentStock
            },
            {
              $set: {
                currentStock: destinationBalance.currentStock + quantity
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedDestination) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          for (const consumedLot of consumedLots) {
            await InventoryLotModel.findOneAndUpdate(
              {
                tenantId,
                itemId,
                warehouseId: destinationWarehouseId,
                lotCode: consumedLot.lotCode
              },
              {
                $setOnInsert: {
                  isActive: true,
                  receivedAt: consumedLot.receivedAt,
                  initialQuantity: 0,
                  currentQuantity: 0
                },
                $set: {
                  expiresAt: consumedLot.expiresAt
                },
                $inc: {
                  initialQuantity: consumedLot.quantity,
                  currentQuantity: consumedLot.quantity
                }
              },
              {
                upsert: true,
                new: true,
                session
              }
            );
          }
        } else {
          if (!input.warehouseId) {
            throw buildInventoryError(
              ERROR_CODES.VALIDATION_ERROR,
              'warehouseId is required for this movement type',
              HTTP_STATUS.BAD_REQUEST
            );
          }

          warehouseId = await ensureWarehouse(input.warehouseId);
          const delta = direction === 'in' ? quantity : -quantity;
          stockAfter = stockBefore + delta;

          if (stockAfter < 0) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
              'Inventory stock cannot be negative',
              HTTP_STATUS.CONFLICT
            );
          }

          const updatedItem = await InventoryItemModel.findOneAndUpdate(
            {
              _id: item._id,
              tenantId,
              currentStock: stockBefore
            },
            {
              $set: {
                currentStock: stockAfter
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedItem) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          const balance = await upsertBalance(warehouseId);

          if (!balance) {
            throw buildInventoryError(
              ERROR_CODES.INTERNAL_ERROR,
              'Inventory stock movement did not complete',
              HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
          }

          const balanceAfter = balance.currentStock + delta;

          if (balanceAfter < 0) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_UNDERFLOW,
              'Inventory stock cannot be negative',
              HTTP_STATUS.CONFLICT
            );
          }

          const updatedBalance = await InventoryBalanceModel.findOneAndUpdate(
            {
              _id: balance._id,
              tenantId,
              currentStock: balance.currentStock
            },
            {
              $set: {
                currentStock: balanceAfter
              }
            },
            {
              new: true,
              session
            }
          );

          if (!updatedBalance) {
            throw buildInventoryError(
              ERROR_CODES.INVENTORY_STOCK_CONFLICT,
              'Inventory stock changed concurrently, retry the operation',
              HTTP_STATUS.CONFLICT
            );
          }

          if (direction === 'out') {
            await consumeLots(warehouseId, quantity);
          } else {
            const lotCode = input.lotCode?.trim() || `AUTO-${new Types.ObjectId().toString().slice(-10)}`;
            const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
            const expiresAt = typeof input.expiresAt === 'undefined' ? null : input.expiresAt ? new Date(input.expiresAt) : null;

            await InventoryLotModel.findOneAndUpdate(
              {
                tenantId,
                itemId,
                warehouseId,
                lotCode
              },
              {
                $setOnInsert: {
                  isActive: true,
                  receivedAt,
                  initialQuantity: 0,
                  currentQuantity: 0
                },
                $set: {
                  expiresAt
                },
                $inc: {
                  initialQuantity: quantity,
                  currentQuantity: quantity
                }
              },
              {
                upsert: true,
                new: true,
                session
              }
            );
          }
        }

        const [movement] = await InventoryStockMovementModel.create(
          [
            {
              tenantId,
              itemId,
              direction,
              movementType,
              quantity,
              stockBefore,
              stockAfter,
              reason,
              warehouseId,
              sourceWarehouseId,
              destinationWarehouseId,
              idempotencyKey,
              performedByUserId: toAuditActorUserId(input.context)
            }
          ],
          { session }
        );

        if (!movement) {
          throw buildInventoryError(
            ERROR_CODES.INTERNAL_ERROR,
            'Inventory stock movement did not complete',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        movementView = toStockMovementView(movement.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'inventory.stock.move.command',
            resource: {
              type: 'inventory_item',
              id: item._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                currentStock: stockBefore
              },
              after: {
                currentStock: stockAfter
              },
              fields: ['currentStock']
            },
            metadata: {
              movementType,
              direction,
              quantity,
              warehouseId: warehouseId?.toString() ?? null,
              sourceWarehouseId: sourceWarehouseId?.toString() ?? null,
              destinationWarehouseId: destinationWarehouseId?.toString() ?? null,
              idempotencyKey
            }
          },
          { session }
        );
      });

      if (!movementView) {
        throw buildInventoryError(
          ERROR_CODES.INTERNAL_ERROR,
          'Inventory stock movement did not complete',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return movementView;
    } finally {
      await session.endSession();
    }
  }

  async listStockMovements(
    input: ListInventoryStockMovementsInput
  ): Promise<ListInventoryStockMovementsResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId)
    };

    if (input.itemId) {
      query.itemId = new Types.ObjectId(input.itemId);
    }


    const skip = (input.page - 1) * input.limit;
    const [movements, total] = await Promise.all([
      InventoryStockMovementModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(input.limit)
        .lean(),
      InventoryStockMovementModel.countDocuments(query)
    ]);

    return {
      items: movements.map((movement) => toStockMovementView(movement)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async listLowStockAlerts(
    input: ListInventoryLowStockAlertsInput
  ): Promise<ListInventoryLowStockAlertsResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true,
      $expr: {
        $lte: ['$currentStock', '$minStock']
      }
    };
    const skip = (input.page - 1) * input.limit;
    const [items, total] = await Promise.all([
      InventoryItemModel.find(query).sort({ currentStock: 1, name: 1 }).skip(skip).limit(input.limit).lean(),
      InventoryItemModel.countDocuments(query)
    ]);

    const alerts: InventoryLowStockAlertView[] = items.map((item) => ({
      item: toItemView(item),
      deficit: Math.max(item.minStock - item.currentStock, 0)
    }));

    return {
      items: alerts,
      page: input.page,
      limit: input.limit,
      total
    };
  }


  async listExpiringLotAlerts(
    input: ListInventoryExpiringLotAlertsInput
  ): Promise<ListInventoryExpiringLotAlertsResult> {
    const now = new Date();
    const upperBound = new Date(now.getTime() + input.withinDays * 24 * 60 * 60 * 1000);

    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true,
      currentQuantity: {
        $gt: 0
      },
      expiresAt: {
        $ne: null,
        $lte: upperBound
      }
    };

    if (input.warehouseId) {
      query.warehouseId = new Types.ObjectId(input.warehouseId);
    }

    if (input.itemId) {
      query.itemId = new Types.ObjectId(input.itemId);
    }

    const skip = (input.page - 1) * input.limit;
    const [lots, total] = await Promise.all([
      InventoryLotModel.find(query)
        .sort({ expiresAt: 1, receivedAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(input.limit)
        .lean(),
      InventoryLotModel.countDocuments(query)
    ]);

    const items: InventoryExpiringLotAlertView[] = lots
      .filter((lot) => lot.expiresAt instanceof Date)
      .map((lot) => ({
        lot: toLotView(lot),
        daysToExpiry: dayDiffUtc(now, lot.expiresAt as Date)
      }));

    return {
      items,
      page: input.page,
      limit: input.limit,
      total
    };
  }
  private async recordAuditLog(
    input: {
      context?: ExecutionContext;
      tenantId: string;
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: toTenantAuditScope(input.tenantId, input.context),
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const inventoryService = new InventoryService();






























