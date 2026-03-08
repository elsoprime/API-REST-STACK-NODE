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
import { InventoryCategoryModel } from '@/modules/inventory/models/inventory-category.model';
import { InventoryItemModel } from '@/modules/inventory/models/inventory-item.model';
import { InventoryStockMovementModel } from '@/modules/inventory/models/inventory-stock-movement.model';
import {
  type CreateInventoryCategoryInput,
  type CreateInventoryItemInput,
  type CreateInventoryStockMovementInput,
  type DeleteInventoryCategoryInput,
  type DeleteInventoryItemInput,
  type GetInventoryItemInput,
  type InventoryCategoryView,
  type InventoryItemView,
  type InventoryLowStockAlertView,
  type InventoryServiceContract,
  type InventoryStockMovementView,
  type ListInventoryCategoriesInput,
  type ListInventoryCategoriesResult,
  type ListInventoryItemsInput,
  type ListInventoryItemsResult,
  type ListInventoryStockMovementsInput,
  type ListInventoryStockMovementsResult,
  type ListInventoryLowStockAlertsInput,
  type ListInventoryLowStockAlertsResult,
  type UpdateInventoryCategoryInput,
  type UpdateInventoryItemInput
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

function toStockMovementView(movement: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  itemId: Types.ObjectId | string;
  direction: 'in' | 'out';
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  performedByUserId?: Types.ObjectId | string | null;
  createdAt?: Date;
}): InventoryStockMovementView {
  return {
    id: movement.id ?? movement._id?.toString() ?? '',
    tenantId: typeof movement.tenantId === 'string' ? movement.tenantId : movement.tenantId.toString(),
    itemId: typeof movement.itemId === 'string' ? movement.itemId : movement.itemId.toString(),
    direction: movement.direction,
    quantity: movement.quantity,
    stockBefore: movement.stockBefore,
    stockAfter: movement.stockAfter,
    reason: movement.reason,
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

  async createItem(input: CreateInventoryItemInput): Promise<InventoryItemView> {
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

  async createStockMovement(
    input: CreateInventoryStockMovementInput
  ): Promise<InventoryStockMovementView> {
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
