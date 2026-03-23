import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const EXPENSE_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'returned',
  'approved',
  'rejected',
  'paid',
  'canceled'
] as const;

export const EXPENSE_APPROVAL_MODES = ['single_step', 'multi_step'] as const;
export const EXPENSE_DASHBOARD_DATE_WINDOWS = [7, 30, 90] as const;

export type ExpenseRequestStatus = (typeof EXPENSE_REQUEST_STATUSES)[number];
export type ExpenseApprovalMode = (typeof EXPENSE_APPROVAL_MODES)[number];
export type ExpenseDashboardDateWindow = (typeof EXPENSE_DASHBOARD_DATE_WINDOWS)[number];
export type ExpenseDashboardAlertSeverity = 'info' | 'warning' | 'critical';

export interface ExpenseRequestView {
  id: string;
  tenantId: string;
  requestNumber: string;
  requesterUserId: string;
  submittedByUserId: string | null;
  reviewedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  canceledByUserId: string | null;
  paidByUserId: string | null;
  title: string;
  description: string | null;
  categoryKey: string;
  categoryId: string | null;
  subcategoryId: string | null;
  subcategoryKey: string | null;
  amount: number;
  currency: string;
  expenseDate: string;
  status: ExpenseRequestStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  canceledAt: string | null;
  rejectionReasonCode: string | null;
  paymentReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategoryView {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  requiresAttachment: boolean;
  isActive: boolean;
  monthlyLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSubcategoryView {
  id: string;
  tenantId: string;
  categoryId: string;
  key: string;
  name: string;
  requiresAttachment: boolean;
  isActive: boolean;
  monthlyLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSettingsView {
  tenantId: string;
  allowedCurrencies: string[];
  maxAmountWithoutReview: number;
  approvalMode: ExpenseApprovalMode;
  bulkMaxItemsPerOperation: number;
  exportsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseAttachmentView {
  id: string;
  tenantId: string;
  expenseRequestId: string;
  storageProvider: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedByUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseUploadPresignView {
  storageProvider: string;
  objectKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresInSeconds: number;
}

export interface ExpenseBulkOperationItemResult {
  id: string;
  success: boolean;
  code?: string;
  message?: string;
}

export interface ExpenseBulkOperationResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: ExpenseBulkOperationItemResult[];
}

export interface ExpenseSummaryView {
  counters: ExpenseCountersView;
  totalRequestedAmount: number;
  totalApprovedAmount: number;
  totalPaidAmount: number;
}

export interface ExpenseDashboardFiltersView {
  dateWindowDays: ExpenseDashboardDateWindow;
  status: ExpenseRequestStatus | null;
  categoryKey: string | null;
}

export interface ExpenseDashboardKpisView {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalAmount: number;
  pendingAmount: number;
}

export interface ExpenseDashboardTrendPointView {
  day: string;
  requested: number;
  approved: number;
  rejected: number;
}

export interface ExpenseDashboardCategoryBreakdownView {
  categoryKey: string;
  label: string;
  totalAmount: number;
  requests: number;
}

export interface ExpenseDashboardAlertView {
  id: string;
  severity: ExpenseDashboardAlertSeverity;
  title: string;
  description: string;
}

export interface ExpenseDashboardAvailableCategoryView {
  key: string;
  name: string;
}

export interface ExpenseDashboardCurrencyTotalsView {
  currency: string;
  requestCount: number;
  totalAmount: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
}

export interface ExpenseDashboardView {
  filters: ExpenseDashboardFiltersView;
  primaryCurrency: string | null;
  hasMixedCurrencies: boolean;
  totalsByCurrency: ExpenseDashboardCurrencyTotalsView[];
  availableCategories: ExpenseDashboardAvailableCategoryView[];
  kpis: ExpenseDashboardKpisView;
  trends: ExpenseDashboardTrendPointView[];
  categories: ExpenseDashboardCategoryBreakdownView[];
  alerts: ExpenseDashboardAlertView[];
}

export interface ExpenseCountersView {
  total: number;
  draft: number;
  submitted: number;
  returned: number;
  approved: number;
  rejected: number;
  paid: number;
  canceled: number;
}

export interface ListExpenseRequestsInput {
  tenantId: string;
  page: number;
  limit: number;
  status?: ExpenseRequestStatus;
  categoryKey?: string;
  search?: string;
}

export interface ListExpenseRequestsResult {
  items: ExpenseRequestView[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateExpenseRequestInput {
  tenantId: string;
  requesterUserId: string;
  title: string;
  description?: string | null;
  categoryKey: string;
  amount: number;
  currency: string;
  expenseDate: string;
  metadata?: Record<string, unknown>;
  context?: ExecutionContext;
}

export interface UpdateExpenseRequestPatch {
  title?: string;
  description?: string | null;
  categoryKey?: string;
  amount?: number;
  currency?: string;
  expenseDate?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateExpenseRequestInput {
  tenantId: string;
  requestId: string;
  patch: UpdateExpenseRequestPatch;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface GetExpenseRequestInput {
  tenantId: string;
  requestId: string;
}

export interface ListExpenseQueueInput {
  tenantId: string;
  page: number;
  limit: number;
}

export interface ListExpenseQueueResult {
  items: ExpenseRequestView[];
  page: number;
  limit: number;
  total: number;
}

export interface GetExpenseDashboardInput {
  tenantId: string;
  dateWindowDays: ExpenseDashboardDateWindow;
  status?: ExpenseRequestStatus;
  categoryKey?: string;
}

export interface CreateExpenseCategoryInput {
  tenantId: string;
  key: string;
  name: string;
  requiresAttachment?: boolean;
  monthlyLimit?: number | null;
  context?: ExecutionContext;
}

export interface UpdateExpenseCategoryPatch {
  name?: string;
  requiresAttachment?: boolean;
  isActive?: boolean;
  monthlyLimit?: number | null;
}

export interface UpdateExpenseCategoryInput {
  tenantId: string;
  categoryId: string;
  patch: UpdateExpenseCategoryPatch;
  context?: ExecutionContext;
}

export interface ListExpenseCategoriesInput {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  includeInactive?: boolean;
}

export interface ListExpenseCategoriesResult {
  items: ExpenseCategoryView[];
  page: number;
  limit: number;
  total: number;
}

export interface UpdateExpenseSettingsInput {
  tenantId: string;
  allowedCurrencies?: string[];
  maxAmountWithoutReview?: number;
  approvalMode?: ExpenseApprovalMode;
  bulkMaxItemsPerOperation?: number;
  exportsEnabled?: boolean;
  context?: ExecutionContext;
}

export interface CreateExpenseSubcategoryInput {
  tenantId: string;
  categoryId: string;
  key: string;
  name: string;
  requiresAttachment?: boolean;
  monthlyLimit?: number | null;
  context?: ExecutionContext;
}

export interface UpdateExpenseSubcategoryPatch {
  name?: string;
  requiresAttachment?: boolean;
  isActive?: boolean;
  monthlyLimit?: number | null;
}

export interface UpdateExpenseSubcategoryInput {
  tenantId: string;
  subcategoryId: string;
  patch: UpdateExpenseSubcategoryPatch;
  context?: ExecutionContext;
}

export interface ListExpenseSubcategoriesInput {
  tenantId: string;
  categoryId: string;
  page: number;
  limit: number;
  search?: string;
  includeInactive?: boolean;
}

export interface ListExpenseSubcategoriesResult {
  items: ExpenseSubcategoryView[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateExpenseUploadPresignInput {
  tenantId: string;
  requestId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  actorUserId: string;
  context?: ExecutionContext;
}

export interface CreateExpenseAttachmentInput {
  tenantId: string;
  requestId: string;
  storageProvider: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  actorUserId: string;
  context?: ExecutionContext;
}

export interface ListExpenseAttachmentsInput {
  tenantId: string;
  requestId: string;
}

export interface DeleteExpenseAttachmentInput {
  tenantId: string;
  requestId: string;
  attachmentId: string;
  actorUserId: string;
  context?: ExecutionContext;
}

export interface BulkApproveExpenseRequestsInput {
  tenantId: string;
  requestIds: string[];
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface BulkRejectExpenseRequestsInput {
  tenantId: string;
  requestIds: string[];
  reasonCode: string;
  comment?: string;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface BulkMarkPaidExpenseRequestsInput {
  tenantId: string;
  requestIds: string[];
  paymentReference?: string | null;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface BulkExportExpenseRequestsInput {
  tenantId: string;
  requestIds: string[];
}

export interface ExpenseExportRow {
  id: string;
  requestNumber: string;
  status: ExpenseRequestStatus;
  categoryKey: string;
  amount: number;
  currency: string;
  expenseDate: string;
}

export interface ExpenseCsvExportView {
  filename: string;
  contentType: 'text/csv';
  csv: string;
  rows: number;
}

export interface SubmitExpenseRequestInput {
  tenantId: string;
  requestId: string;
  actorUserId: string;
  context?: ExecutionContext;
}

export interface ReviewExpenseRequestInput {
  tenantId: string;
  requestId: string;
  comment: string;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface ApproveExpenseRequestInput {
  tenantId: string;
  requestId: string;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface RejectExpenseRequestInput {
  tenantId: string;
  requestId: string;
  reasonCode: string;
  comment?: string;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface CancelExpenseRequestInput {
  tenantId: string;
  requestId: string;
  actorUserId: string;
  reason?: string;
  context?: ExecutionContext;
}

export interface MarkPaidExpenseRequestInput {
  tenantId: string;
  requestId: string;
  paymentReference?: string | null;
  actorUserId?: string;
  context?: ExecutionContext;
}

export interface ExpenseServiceContract {
  createRequest: (input: CreateExpenseRequestInput) => Promise<ExpenseRequestView>;
  listRequests: (input: ListExpenseRequestsInput) => Promise<ListExpenseRequestsResult>;
  getRequest: (input: GetExpenseRequestInput) => Promise<ExpenseRequestView>;
  updateRequest: (input: UpdateExpenseRequestInput) => Promise<ExpenseRequestView>;
  listQueue: (input: ListExpenseQueueInput) => Promise<ListExpenseQueueResult>;
  getCounters: (tenantId: string) => Promise<ExpenseCountersView>;
  createCategory: (input: CreateExpenseCategoryInput) => Promise<ExpenseCategoryView>;
  listCategories: (input: ListExpenseCategoriesInput) => Promise<ListExpenseCategoriesResult>;
  updateCategory: (input: UpdateExpenseCategoryInput) => Promise<ExpenseCategoryView>;
  createSubcategory: (input: CreateExpenseSubcategoryInput) => Promise<ExpenseSubcategoryView>;
  listSubcategories: (
    input: ListExpenseSubcategoriesInput
  ) => Promise<ListExpenseSubcategoriesResult>;
  updateSubcategory: (input: UpdateExpenseSubcategoryInput) => Promise<ExpenseSubcategoryView>;
  getSettings: (tenantId: string) => Promise<ExpenseSettingsView>;
  updateSettings: (input: UpdateExpenseSettingsInput) => Promise<ExpenseSettingsView>;
  submitRequest: (input: SubmitExpenseRequestInput) => Promise<ExpenseRequestView>;
  reviewRequest: (input: ReviewExpenseRequestInput) => Promise<ExpenseRequestView>;
  approveRequest: (input: ApproveExpenseRequestInput) => Promise<ExpenseRequestView>;
  rejectRequest: (input: RejectExpenseRequestInput) => Promise<ExpenseRequestView>;
  cancelRequest: (input: CancelExpenseRequestInput) => Promise<ExpenseRequestView>;
  markRequestAsPaid: (input: MarkPaidExpenseRequestInput) => Promise<ExpenseRequestView>;
  createUploadPresign: (input: CreateExpenseUploadPresignInput) => Promise<ExpenseUploadPresignView>;
  createAttachment: (input: CreateExpenseAttachmentInput) => Promise<ExpenseAttachmentView>;
  listAttachments: (input: ListExpenseAttachmentsInput) => Promise<ExpenseAttachmentView[]>;
  deleteAttachment: (input: DeleteExpenseAttachmentInput) => Promise<ExpenseAttachmentView>;
  bulkApproveRequests: (input: BulkApproveExpenseRequestsInput) => Promise<ExpenseBulkOperationResult>;
  bulkRejectRequests: (input: BulkRejectExpenseRequestsInput) => Promise<ExpenseBulkOperationResult>;
  bulkMarkRequestsAsPaid: (
    input: BulkMarkPaidExpenseRequestsInput
  ) => Promise<ExpenseBulkOperationResult>;
  bulkExportRequests: (input: BulkExportExpenseRequestsInput) => Promise<ExpenseExportRow[]>;
  getDashboard: (input: GetExpenseDashboardInput) => Promise<ExpenseDashboardView>;
  getSummary: (tenantId: string) => Promise<ExpenseSummaryView>;
  exportRequestsCsv: (tenantId: string) => Promise<ExpenseCsvExportView>;
}
