import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const INVENTORY_MOVEMENT_DIRECTIONS = ['in', 'out'] as const;
export const INVENTORY_MOVEMENT_TYPES = ['entry', 'exit', 'adjust', 'transfer', 'return'] as const;
export const INVENTORY_LOT_ALLOCATION_POLICIES = ['FIFO', 'FEFO'] as const;
export const INVENTORY_ROLLOUT_PHASES = ['pilot', 'cohort', 'general'] as const;
export const INVENTORY_STOCKTAKE_STATUSES = [
  'draft',
  'in_progress',
  'review',
  'applied',
  'cancelled'
] as const;

export type InventoryMovementDirection = (typeof INVENTORY_MOVEMENT_DIRECTIONS)[number];
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];
export type InventoryLotAllocationPolicy = (typeof INVENTORY_LOT_ALLOCATION_POLICIES)[number];
export type InventoryRolloutPhase = (typeof INVENTORY_ROLLOUT_PHASES)[number];
export type InventoryStocktakeStatus = (typeof INVENTORY_STOCKTAKE_STATUSES)[number];

export interface InventoryCategoryView {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface InventoryWarehouseView {
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

export interface InventoryLotView {
  id: string;
  tenantId: string;
  itemId: string;
  warehouseId: string;
  lotCode: string;
  receivedAt: string;
  expiresAt: string | null;
  initialQuantity: number;
  currentQuantity: number;
  isActive: boolean;
}

export interface InventoryExpiringLotAlertView {
  lot: InventoryLotView;
  daysToExpiry: number;
}

export interface InventorySettingsView {
  tenantId: string;
  lotAllocationPolicy: InventoryLotAllocationPolicy;
  rolloutPhase: InventoryRolloutPhase;
  capabilities: {
    warehouses: boolean;
    lots: boolean;
    stocktakes: boolean;
  };
}

export interface InventoryReconciliationView {
  tenantId: string;
  comparedAt: string;
  movementCount: number;
  movementIn: number;
  movementOut: number;
  balanceTotal: number;
  itemStockTotal: number;
  drift: number;
  status: 'ok' | 'drift_detected';
}

export interface InventoryStocktakeLineView {
  itemId: string;
  countedStock: number;
  lotId: string | null;
}

export interface InventoryStocktakeView {
  id: string;
  tenantId: string;
  warehouseId: string;
  name: string;
  status: InventoryStocktakeStatus;
  lines: InventoryStocktakeLineView[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStockMovementView {
  id: string;
  tenantId: string;
  itemId: string;
  direction: InventoryMovementDirection;
  movementType: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  warehouseId: string | null;
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  idempotencyKey: string | null;
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

export interface ListInventoryWarehousesInput {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ListInventoryWarehousesResult {
  items: InventoryWarehouseView[];
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

export interface ListInventoryLotsInput {
  tenantId: string;
  page: number;
  limit: number;
  itemId?: string;
  warehouseId?: string;
  expiringBefore?: string;
}

export interface ListInventoryLotsResult {
  items: InventoryLotView[];
  page: number;
  limit: number;
  total: number;
}

export interface ListInventoryStocktakesInput {
  tenantId: string;
  page: number;
  limit: number;
  warehouseId?: string;
  status?: InventoryStocktakeStatus;
}

export interface ListInventoryStocktakesResult {
  items: InventoryStocktakeView[];
  page: number;
  limit: number;
  total: number;
}

export interface ListInventoryExpiringLotAlertsInput {
  tenantId: string;
  page: number;
  limit: number;
  withinDays: number;
  warehouseId?: string;
  itemId?: string;
}

export interface ListInventoryExpiringLotAlertsResult {
  items: InventoryExpiringLotAlertView[];
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
  movementType?: InventoryMovementType;
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

export interface CreateInventoryWarehouseInput {
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

export interface CreateInventoryLotInput {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  lotCode: string;
  receivedAt?: string;
  expiresAt?: string | null;
  quantity: number;
  context?: ExecutionContext;
}

export interface CreateInventoryStocktakeLineInput {
  itemId: string;
  countedStock: number;
  lotId?: string;
}

export interface CreateInventoryStocktakeInput {
  tenantId: string;
  warehouseId: string;
  name: string;
  lines?: CreateInventoryStocktakeLineInput[];
  context?: ExecutionContext;
}

export interface UpsertInventoryStocktakeCountsInput {
  tenantId: string;
  stocktakeId: string;
  lines: CreateInventoryStocktakeLineInput[];
  context?: ExecutionContext;
}

export interface ApplyInventoryStocktakeInput {
  tenantId: string;
  stocktakeId: string;
  context?: ExecutionContext;
}

export interface CancelInventoryStocktakeInput {
  tenantId: string;
  stocktakeId: string;
  context?: ExecutionContext;
}

export interface GetInventoryStocktakeInput {
  tenantId: string;
  stocktakeId: string;
}

export interface UpdateInventoryLotPatch {
  expiresAt?: string | null;
  isActive?: boolean;
}

export interface UpdateInventoryLotInput {
  tenantId: string;
  lotId: string;
  patch: UpdateInventoryLotPatch;
  context?: ExecutionContext;
}

export interface UpdateInventorySettingsInput {
  tenantId: string;
  lotAllocationPolicy?: InventoryLotAllocationPolicy;
  rolloutPhase?: InventoryRolloutPhase;
  capabilities?: {
    warehouses?: boolean;
    lots?: boolean;
    stocktakes?: boolean;
  };
  context?: ExecutionContext;
}

export interface GetInventoryReconciliationInput {
  tenantId: string;
  sinceDays?: number;
}

export interface UpdateInventoryCategoryPatch {
  name?: string;
  description?: string | null;
}

export interface UpdateInventoryWarehousePatch {
  name?: string;
  description?: string | null;
  isActive?: boolean;
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

export interface UpdateInventoryWarehouseInput {
  tenantId: string;
  warehouseId: string;
  patch: UpdateInventoryWarehousePatch;
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

export interface CreateInventoryMovementCommandInput {
  tenantId: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  reason: string;
  direction?: InventoryMovementDirection;
  warehouseId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  lotCode?: string;
  receivedAt?: string;
  expiresAt?: string | null;
  idempotencyKey?: string;
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
  createWarehouse: (input: CreateInventoryWarehouseInput) => Promise<InventoryWarehouseView>;
  listWarehouses: (input: ListInventoryWarehousesInput) => Promise<ListInventoryWarehousesResult>;
  updateWarehouse: (input: UpdateInventoryWarehouseInput) => Promise<InventoryWarehouseView>;
  createItem: (input: CreateInventoryItemInput) => Promise<InventoryItemView>;
  listItems: (input: ListInventoryItemsInput) => Promise<ListInventoryItemsResult>;
  getItem: (input: GetInventoryItemInput) => Promise<InventoryItemView>;
  updateItem: (input: UpdateInventoryItemInput) => Promise<InventoryItemView>;
  deleteItem: (input: DeleteInventoryItemInput) => Promise<InventoryItemView>;
  createLot: (input: CreateInventoryLotInput) => Promise<InventoryLotView>;
  listLots: (input: ListInventoryLotsInput) => Promise<ListInventoryLotsResult>;
  updateLot: (input: UpdateInventoryLotInput) => Promise<InventoryLotView>;
  getSettings: (tenantId: string) => Promise<InventorySettingsView>;
  updateSettings: (input: UpdateInventorySettingsInput) => Promise<InventorySettingsView>;
  getReconciliation: (input: GetInventoryReconciliationInput) => Promise<InventoryReconciliationView>;
  createStocktake: (input: CreateInventoryStocktakeInput) => Promise<InventoryStocktakeView>;
  upsertStocktakeCounts: (input: UpsertInventoryStocktakeCountsInput) => Promise<InventoryStocktakeView>;
  applyStocktake: (input: ApplyInventoryStocktakeInput) => Promise<InventoryStocktakeView>;
  cancelStocktake: (input: CancelInventoryStocktakeInput) => Promise<InventoryStocktakeView>;
  getStocktake: (input: GetInventoryStocktakeInput) => Promise<InventoryStocktakeView>;
  listStocktakes: (input: ListInventoryStocktakesInput) => Promise<ListInventoryStocktakesResult>;
  createStockMovement: (input: CreateInventoryStockMovementInput) => Promise<InventoryStockMovementView>;
  createMovementCommand: (input: CreateInventoryMovementCommandInput) => Promise<InventoryStockMovementView>;
  listStockMovements: (input: ListInventoryStockMovementsInput) => Promise<ListInventoryStockMovementsResult>;
  listLowStockAlerts: (input: ListInventoryLowStockAlertsInput) => Promise<ListInventoryLowStockAlertsResult>;
  listExpiringLotAlerts: (
    input: ListInventoryExpiringLotAlertsInput
  ) => Promise<ListInventoryExpiringLotAlertsResult>;
}


