import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const INVENTORY_MOVEMENT_DIRECTIONS = ['in', 'out'] as const;

export type InventoryMovementDirection = (typeof INVENTORY_MOVEMENT_DIRECTIONS)[number];

export interface InventoryCategoryView {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface InventoryItemView {
  id: string;
  tenantId: string;
  categoryId: string;
  sku: string;
  name: string;
  description: string | null;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
  isActive: boolean;
}

export interface InventoryStockMovementView {
  id: string;
  tenantId: string;
  itemId: string;
  direction: InventoryMovementDirection;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  performedByUserId: string | null;
  createdAt: string;
}

export interface InventoryLowStockAlertView {
  item: InventoryItemView;
  deficit: number;
}

export interface ListInventoryCategoriesInput {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ListInventoryCategoriesResult {
  items: InventoryCategoryView[];
  page: number;
  limit: number;
  total: number;
}

export interface ListInventoryItemsInput {
  tenantId: string;
  page: number;
  limit: number;
  categoryId?: string;
  search?: string;
  lowStockOnly?: boolean;
}

export interface ListInventoryItemsResult {
  items: InventoryItemView[];
  page: number;
  limit: number;
  total: number;
}

export interface ListInventoryLowStockAlertsInput {
  tenantId: string;
  page: number;
  limit: number;
}

export interface ListInventoryLowStockAlertsResult {
  items: InventoryLowStockAlertView[];
  page: number;
  limit: number;
  total: number;
}

export interface ListInventoryStockMovementsInput {
  tenantId: string;
  page: number;
  limit: number;
  itemId?: string;
}

export interface ListInventoryStockMovementsResult {
  items: InventoryStockMovementView[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateInventoryCategoryInput {
  tenantId: string;
  name: string;
  description?: string | null;
  context?: ExecutionContext;
}

export interface CreateInventoryItemInput {
  tenantId: string;
  categoryId: string;
  sku: string;
  name: string;
  description?: string | null;
  initialStock: number;
  minStock: number;
  context?: ExecutionContext;
}

export interface UpdateInventoryCategoryPatch {
  name?: string;
  description?: string | null;
}

export interface UpdateInventoryItemPatch {
  categoryId?: string;
  sku?: string;
  name?: string;
  description?: string | null;
  minStock?: number;
}

export interface UpdateInventoryCategoryInput {
  tenantId: string;
  categoryId: string;
  patch: UpdateInventoryCategoryPatch;
  context?: ExecutionContext;
}

export interface UpdateInventoryItemInput {
  tenantId: string;
  itemId: string;
  patch: UpdateInventoryItemPatch;
  context?: ExecutionContext;
}

export interface GetInventoryItemInput {
  tenantId: string;
  itemId: string;
}

export interface CreateInventoryStockMovementInput {
  tenantId: string;
  itemId: string;
  direction: InventoryMovementDirection;
  quantity: number;
  reason: string;
  context?: ExecutionContext;
}

export interface DeleteInventoryCategoryInput {
  tenantId: string;
  categoryId: string;
  context?: ExecutionContext;
}

export interface DeleteInventoryItemInput {
  tenantId: string;
  itemId: string;
  context?: ExecutionContext;
}

export interface InventoryServiceContract {
  createCategory: (input: CreateInventoryCategoryInput) => Promise<InventoryCategoryView>;
  listCategories: (input: ListInventoryCategoriesInput) => Promise<ListInventoryCategoriesResult>;
  updateCategory: (input: UpdateInventoryCategoryInput) => Promise<InventoryCategoryView>;
  deleteCategory: (input: DeleteInventoryCategoryInput) => Promise<InventoryCategoryView>;
  createItem: (input: CreateInventoryItemInput) => Promise<InventoryItemView>;
  listItems: (input: ListInventoryItemsInput) => Promise<ListInventoryItemsResult>;
  getItem: (input: GetInventoryItemInput) => Promise<InventoryItemView>;
  updateItem: (input: UpdateInventoryItemInput) => Promise<InventoryItemView>;
  deleteItem: (input: DeleteInventoryItemInput) => Promise<InventoryItemView>;
  createStockMovement: (
    input: CreateInventoryStockMovementInput
  ) => Promise<InventoryStockMovementView>;
  listStockMovements: (
    input: ListInventoryStockMovementsInput
  ) => Promise<ListInventoryStockMovementsResult>;
  listLowStockAlerts: (
    input: ListInventoryLowStockAlertsInput
  ) => Promise<ListInventoryLowStockAlertsResult>;
}
