import { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { transactionalEmailService } from '@/core/communications/email/services/transactional-email.service';
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
import { UserModel } from '@/core/platform/users/models/user.model';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { logger } from '@/infrastructure/logger/logger';
import { ExpenseAttachmentModel } from '@/modules/expenses/models/expense-attachment.model';
import { ExpenseCategoryModel } from '@/modules/expenses/models/expense-category.model';
import { ExpenseRequestModel } from '@/modules/expenses/models/expense-request.model';
import { ExpenseSettingsModel } from '@/modules/expenses/models/expense-settings.model';
import {
  type ApproveExpenseRequestInput,
  type BulkApproveExpenseRequestsInput,
  type BulkExportExpenseRequestsInput,
  type BulkMarkPaidExpenseRequestsInput,
  type BulkRejectExpenseRequestsInput,
  type CancelExpenseRequestInput,
  type CreateExpenseAttachmentInput,
  type CreateExpenseCategoryInput,
  type CreateExpenseUploadPresignInput,
  type CreateExpenseRequestInput,
  type DeleteExpenseAttachmentInput,
  type ExpenseAttachmentView,
  type ExpenseDashboardAlertView,
  type ExpenseDashboardAvailableCategoryView,
  type ExpenseDashboardCategoryBreakdownView,
  type ExpenseDashboardCurrencyTotalsView,
  type ExpenseDashboardDateWindow,
  type ExpenseDashboardKpisView,
  type ExpenseDashboardTrendPointView,
  type ExpenseDashboardView,
  type ExpenseBulkOperationItemResult,
  type ExpenseBulkOperationResult,
  type ExpenseCategoryView,
  type ExpenseCsvExportView,
  type ExpenseCountersView,
  type ExpenseExportRow,
  type ExpenseRequestStatus,
  type MarkPaidExpenseRequestInput,
  type ExpenseSummaryView,
  type ExpenseUploadPresignView,
  type RejectExpenseRequestInput,
  type ReviewExpenseRequestInput,
  type SubmitExpenseRequestInput,
  type ExpenseRequestView,
  type ExpenseServiceContract,
  type ExpenseSettingsView,
  type GetExpenseRequestInput,
  type GetExpenseDashboardInput,
  type ListExpenseAttachmentsInput,
  type ListExpenseCategoriesInput,
  type ListExpenseCategoriesResult,
  type ListExpenseQueueInput,
  type ListExpenseQueueResult,
  type ListExpenseRequestsInput,
  type ListExpenseRequestsResult,
  type UpdateExpenseCategoryInput,
  type UpdateExpenseRequestInput,
  type UpdateExpenseSettingsInput
} from '@/modules/expenses/types/expenses.types';
import { isExpenseWorkflowTransitionAllowed } from '@/modules/expenses/workflow/expense-workflow.machine';

function buildExpensesError(
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

function parseObjectIdInput(value: string, fieldName: string): Types.ObjectId {
  const normalized = value.trim();
  if (!Types.ObjectId.isValid(normalized)) {
    throw buildExpensesError(ERROR_CODES.VALIDATION_ERROR, `${fieldName} is invalid`, HTTP_STATUS.BAD_REQUEST);
  }

  return new Types.ObjectId(normalized);
}

function assertTenantContextConsistency(tenantId: string, context?: ExecutionContext): void {
  const contextTenantId = context?.tenant?.tenantId;

  if (!contextTenantId) {
    return;
  }

  if (!Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(contextTenantId)) {
    throw buildExpensesError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Types.ObjectId(tenantId).toString() !== new Types.ObjectId(contextTenantId).toString()) {
    throw buildExpensesError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCategoryKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return value.toISOString();
}

function toRequestView(request: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  requestNumber: string;
  requesterUserId: Types.ObjectId | string;
  title: string;
  description?: string | null;
  categoryKey: string;
  amount: number;
  currency: string;
  expenseDate: Date | string;
  status: ExpenseRequestStatus;
  submittedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  paidAt?: Date | string | null;
  canceledAt?: Date | string | null;
  rejectionReasonCode?: string | null;
  paymentReference?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ExpenseRequestView {
  return {
    id: request.id ?? request._id?.toString() ?? '',
    tenantId: typeof request.tenantId === 'string' ? request.tenantId : request.tenantId.toString(),
    requestNumber: request.requestNumber,
    requesterUserId:
      typeof request.requesterUserId === 'string'
        ? request.requesterUserId
        : request.requesterUserId.toString(),
    title: request.title,
    description: request.description ?? null,
    categoryKey: request.categoryKey,
    amount: request.amount,
    currency: request.currency,
    expenseDate: formatDate(request.expenseDate) ?? new Date().toISOString(),
    status: request.status,
    submittedAt: formatDate(request.submittedAt),
    approvedAt: formatDate(request.approvedAt),
    paidAt: formatDate(request.paidAt),
    canceledAt: formatDate(request.canceledAt),
    rejectionReasonCode: request.rejectionReasonCode ?? null,
    paymentReference: request.paymentReference ?? null,
    metadata: request.metadata ?? {},
    createdAt: formatDate(request.createdAt) ?? new Date().toISOString(),
    updatedAt: formatDate(request.updatedAt) ?? new Date().toISOString()
  };
}

function toCategoryView(category: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  key: string;
  name: string;
  requiresAttachment?: boolean;
  isActive?: boolean;
  monthlyLimit?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ExpenseCategoryView {
  return {
    id: category.id ?? category._id?.toString() ?? '',
    tenantId: typeof category.tenantId === 'string' ? category.tenantId : category.tenantId.toString(),
    key: category.key,
    name: category.name,
    requiresAttachment: category.requiresAttachment ?? true,
    isActive: category.isActive ?? true,
    monthlyLimit: category.monthlyLimit ?? null,
    createdAt: formatDate(category.createdAt) ?? new Date().toISOString(),
    updatedAt: formatDate(category.updatedAt) ?? new Date().toISOString()
  };
}

function toSettingsView(settings: {
  tenantId: Types.ObjectId | string;
  allowedCurrencies: string[];
  maxAmountWithoutReview: number;
  approvalMode: 'single_step' | 'multi_step';
  bulkMaxItemsPerOperation: number;
  exportsEnabled: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ExpenseSettingsView {
  return {
    tenantId: typeof settings.tenantId === 'string' ? settings.tenantId : settings.tenantId.toString(),
    allowedCurrencies: settings.allowedCurrencies,
    maxAmountWithoutReview: settings.maxAmountWithoutReview,
    approvalMode: settings.approvalMode,
    bulkMaxItemsPerOperation: settings.bulkMaxItemsPerOperation,
    exportsEnabled: settings.exportsEnabled,
    createdAt: formatDate(settings.createdAt) ?? new Date().toISOString(),
    updatedAt: formatDate(settings.updatedAt) ?? new Date().toISOString()
  };
}

function toAttachmentView(attachment: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  expenseRequestId: Types.ObjectId | string;
  storageProvider: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedByUserId: Types.ObjectId | string;
  isActive?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): ExpenseAttachmentView {
  return {
    id: attachment.id ?? attachment._id?.toString() ?? '',
    tenantId: typeof attachment.tenantId === 'string' ? attachment.tenantId : attachment.tenantId.toString(),
    expenseRequestId:
      typeof attachment.expenseRequestId === 'string'
        ? attachment.expenseRequestId
        : attachment.expenseRequestId.toString(),
    storageProvider: attachment.storageProvider,
    objectKey: attachment.objectKey,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    checksumSha256: attachment.checksumSha256,
    uploadedByUserId:
      typeof attachment.uploadedByUserId === 'string'
        ? attachment.uploadedByUserId
        : attachment.uploadedByUserId.toString(),
    isActive: attachment.isActive ?? true,
    createdAt: formatDate(attachment.createdAt) ?? new Date().toISOString(),
    updatedAt: formatDate(attachment.updatedAt) ?? new Date().toISOString()
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

function ensureMutableRequestStatus(status: ExpenseRequestStatus): void {
  if (status !== 'draft' && status !== 'returned') {
    throw buildExpensesError(
      ERROR_CODES.EXPENSE_REQUEST_STATE_INVALID,
      'Expense request can only be updated in draft or returned status',
      HTTP_STATUS.CONFLICT
    );
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function escapeCsvCell(value: string): string {
  const normalized = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized}"`;
  }

  return normalized;
}

const DASHBOARD_PENDING_STATUSES: ExpenseRequestStatus[] = ['submitted', 'returned'];
const DASHBOARD_PENDING_THRESHOLD = 15;
const DASHBOARD_SLA_DAYS_THRESHOLD = 4;
const DASHBOARD_REJECTION_RATE_THRESHOLD = 0.35;
const DASHBOARD_TOP_CATEGORIES_LIMIT = 6;

function resolveDashboardWindowStart(windowDays: ExpenseDashboardDateWindow): Date {
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));
  return startDate;
}

function toDashboardDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDashboardShortDay(value: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit'
  }).format(value);
}

function buildDashboardTrendSeries(
  windowDays: ExpenseDashboardDateWindow,
  trendMap: Map<string, Omit<ExpenseDashboardTrendPointView, 'day'>>
): ExpenseDashboardTrendPointView[] {
  const startDate = resolveDashboardWindowStart(windowDays);

  return Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);

    const dayKey = toDashboardDayKey(date);
    const current = trendMap.get(dayKey);

    return {
      day: formatDashboardShortDay(date),
      requested: current?.requested ?? 0,
      approved: current?.approved ?? 0,
      rejected: current?.rejected ?? 0
    };
  });
}

function selectPrimaryCurrency(
  totalsByCurrency: ExpenseDashboardCurrencyTotalsView[],
  fallbackCurrency: string | null
): string | null {
  if (totalsByCurrency.length === 0) {
    return fallbackCurrency;
  }

  const [primary] = [...totalsByCurrency].sort((left, right) => {
    if (right.totalAmount !== left.totalAmount) {
      return right.totalAmount - left.totalAmount;
    }

    if (right.requestCount !== left.requestCount) {
      return right.requestCount - left.requestCount;
    }

    return left.currency.localeCompare(right.currency);
  });

  return primary.currency;
}

function buildDashboardKpis(
  counts: {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  },
  primaryCurrencyTotals?: ExpenseDashboardCurrencyTotalsView
): ExpenseDashboardKpisView {
  return {
    totalRequests: counts.totalRequests,
    pendingRequests: counts.pendingRequests,
    approvedRequests: counts.approvedRequests,
    rejectedRequests: counts.rejectedRequests,
    totalAmount: primaryCurrencyTotals?.totalAmount ?? 0,
    pendingAmount: primaryCurrencyTotals?.pendingAmount ?? 0
  };
}

function buildDashboardAlerts(input: {
  totalRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  oldestPendingCreatedAt: Date | null;
}): ExpenseDashboardAlertView[] {
  const alerts: ExpenseDashboardAlertView[] = [];

  if (input.pendingRequests >= DASHBOARD_PENDING_THRESHOLD) {
    alerts.push({
      id: 'pending-high',
      severity: 'warning',
      title: 'Cola pendiente alta',
      description: `Hay ${input.pendingRequests} solicitudes pendientes para revision o decision.`
    });
  }

  if (input.oldestPendingCreatedAt) {
    const ageInDays = Math.floor(
      (Date.now() - input.oldestPendingCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (ageInDays >= DASHBOARD_SLA_DAYS_THRESHOLD) {
      alerts.push({
        id: 'sla-aging',
        severity: 'critical',
        title: 'Riesgo de SLA',
        description: `La solicitud pendiente mas antigua supera ${ageInDays} dias.`
      });
    }
  }

  const rejectionRate =
    input.totalRequests > 0 ? input.rejectedRequests / input.totalRequests : 0;

  if (rejectionRate >= DASHBOARD_REJECTION_RATE_THRESHOLD) {
    alerts.push({
      id: 'rejection-rate',
      severity: 'info',
      title: 'Tasa de rechazo elevada',
      description: 'Revisa politicas de categoria o calidad de captura en solicitudes.'
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'healthy',
      severity: 'info',
      title: 'Operacion estable',
      description: 'No se detectaron alertas operativas para el rango seleccionado.'
    });
  }

  return alerts;
}

export class ExpensesService implements ExpenseServiceContract {
  constructor(private readonly audit: AuditService = auditService) {}

  async createRequest(input: CreateExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = parseObjectIdInput(input.tenantId, 'tenantId');
    const requesterUserId = parseObjectIdInput(input.requesterUserId, 'requesterUserId');
    const normalizedCategoryKey = normalizeCategoryKey(input.categoryKey);

    const category = await ExpenseCategoryModel.findOne({
      tenantId,
      normalizedKey: normalizedCategoryKey,
      isActive: true
    }).lean();
    if (!category) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND,
        'Expense category not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const requestNumber = `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    try {
      const created = await ExpenseRequestModel.create({
        tenantId,
        requestNumber,
        requesterUserId,
        title: input.title.trim(),
        description: input.description ?? null,
        categoryKey: category.key,
        amount: input.amount,
        currency: normalizeCurrency(input.currency),
        expenseDate: new Date(input.expenseDate),
        status: 'draft',
        metadata: input.metadata ?? {}
      });

      const view = toRequestView(created.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'expenses.request.create',
        resource: {
          type: 'expense_request',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            requestNumber: view.requestNumber,
            amount: view.amount,
            currency: view.currency,
            status: view.status
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildExpensesError(
          ERROR_CODES.EXPENSE_REQUEST_NUMBER_CONFLICT,
          'Expense request number conflict',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listRequests(input: ListExpenseRequestsInput): Promise<ListExpenseRequestsResult> {
    const query: Record<string, unknown> = {
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId')
    };

    if (input.status) {
      query.status = input.status;
    }

    if (input.categoryKey) {
      query.categoryKey = input.categoryKey;
    }

    if (input.search) {
      query.$or = [
        { title: { $regex: escapeRegexLiteral(input.search), $options: 'i' } },
        { requestNumber: { $regex: escapeRegexLiteral(input.search), $options: 'i' } }
      ];
    }

    const skip = (input.page - 1) * input.limit;
    const [requests, total] = await Promise.all([
      ExpenseRequestModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
      ExpenseRequestModel.countDocuments(query)
    ]);

    return {
      items: requests.map((request) => toRequestView(request)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getRequest(input: GetExpenseRequestInput): Promise<ExpenseRequestView> {
    const request = await ExpenseRequestModel.findOne({
      _id: parseObjectIdInput(input.requestId, 'requestId'),
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId')
    }).lean();

    if (!request) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toRequestView(request);
  }

  async updateRequest(input: UpdateExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenantId = parseObjectIdInput(input.tenantId, 'tenantId');
    const requestId = parseObjectIdInput(input.requestId, 'requestId');

    const current = await ExpenseRequestModel.findOne({
      _id: requestId,
      tenantId
    });

    if (!current) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    ensureMutableRequestStatus(current.status as ExpenseRequestStatus);

    const updateData: Record<string, unknown> = {};
    if (typeof input.patch.title === 'string') {
      updateData.title = input.patch.title.trim();
    }
    if (typeof input.patch.description !== 'undefined') {
      updateData.description = input.patch.description;
    }
    if (typeof input.patch.categoryKey === 'string') {
      const normalizedCategoryKey = normalizeCategoryKey(input.patch.categoryKey);
      const category = await ExpenseCategoryModel.findOne({
        tenantId,
        normalizedKey: normalizedCategoryKey,
        isActive: true
      }).lean();
      if (!category) {
        throw buildExpensesError(
          ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND,
          'Expense category not found',
          HTTP_STATUS.NOT_FOUND
        );
      }
      updateData.categoryKey = category.key;
    }
    if (typeof input.patch.amount === 'number') {
      updateData.amount = input.patch.amount;
    }
    if (typeof input.patch.currency === 'string') {
      updateData.currency = normalizeCurrency(input.patch.currency);
    }
    if (typeof input.patch.expenseDate === 'string') {
      updateData.expenseDate = new Date(input.patch.expenseDate);
    }
    if (typeof input.patch.metadata !== 'undefined') {
      updateData.metadata = input.patch.metadata;
    }

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: requestId,
        tenantId
      },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.update',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'info',
      changes: {
        fields: Object.keys(input.patch),
        after: {
          categoryKey: view.categoryKey,
          amount: view.amount,
          currency: view.currency
        }
      }
    });

    return view;
  }

  async listQueue(input: ListExpenseQueueInput): Promise<ListExpenseQueueResult> {
    const query = {
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId'),
      status: { $in: ['submitted', 'returned'] }
    };

    const skip = (input.page - 1) * input.limit;
    const [requests, total] = await Promise.all([
      ExpenseRequestModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
      ExpenseRequestModel.countDocuments(query)
    ]);

    return {
      items: requests.map((request) => toRequestView(request)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getCounters(tenantId: string): Promise<ExpenseCountersView> {
    const tenantObjectId = parseObjectIdInput(tenantId, 'tenantId');
    const counters = await ExpenseRequestModel.aggregate<{
      _id: ExpenseRequestStatus;
      count: number;
    }>([
      { $match: { tenantId: tenantObjectId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const map = new Map(counters.map((item) => [item._id, item.count]));
    const draft = map.get('draft') ?? 0;
    const submitted = map.get('submitted') ?? 0;
    const returned = map.get('returned') ?? 0;
    const approved = map.get('approved') ?? 0;
    const rejected = map.get('rejected') ?? 0;
    const paid = map.get('paid') ?? 0;
    const canceled = map.get('canceled') ?? 0;

    return {
      total: draft + submitted + returned + approved + rejected + paid + canceled,
      draft,
      submitted,
      returned,
      approved,
      rejected,
      paid,
      canceled
    };
  }

  async getDashboard(input: GetExpenseDashboardInput): Promise<ExpenseDashboardView> {
    const tenantObjectId = parseObjectIdInput(input.tenantId, 'tenantId');
    const startDate = resolveDashboardWindowStart(input.dateWindowDays);
    const baseMatch: Record<string, unknown> = {
      tenantId: tenantObjectId,
      expenseDate: { $gte: startDate }
    };

    if (input.status) {
      baseMatch.status = input.status;
    }

    if (input.categoryKey) {
      baseMatch.categoryKey = input.categoryKey;
    }

    const [aggregateResult, catalog, settings] = await Promise.all([
      ExpenseRequestModel.aggregate<{
        kpis: Array<{
          _id: null;
          totalRequests: number;
          pendingRequests: number;
          approvedRequests: number;
          rejectedRequests: number;
        }>;
        totalsByCurrency: Array<{
          _id: string;
          requestCount: number;
          totalAmount: number;
          pendingAmount: number;
          approvedAmount: number;
          paidAmount: number;
        }>;
        trends: Array<{
          _id: string;
          requested: number;
          approved: number;
          rejected: number;
        }>;
        categories: Array<{
          _id: string;
          totalAmount: number;
          requests: number;
        }>;
        pendingStats: Array<{
          _id: null;
          pendingRequests: number;
          oldestCreatedAt: Date | null;
        }>;
      }>([
        { $match: baseMatch },
        {
          $facet: {
            kpis: [
              {
                $group: {
                  _id: null,
                  totalRequests: { $sum: 1 },
                  pendingRequests: {
                    $sum: {
                      $cond: [{ $in: ['$status', DASHBOARD_PENDING_STATUSES] }, 1, 0]
                    }
                  },
                  approvedRequests: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'approved'] }, 1, 0]
                    }
                  },
                  rejectedRequests: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
                    }
                  }
                }
              }
            ],
            totalsByCurrency: [
              {
                $group: {
                  _id: '$currency',
                  requestCount: { $sum: 1 },
                  totalAmount: { $sum: '$amount' },
                  pendingAmount: {
                    $sum: {
                      $cond: [{ $in: ['$status', DASHBOARD_PENDING_STATUSES] }, '$amount', 0]
                    }
                  },
                  approvedAmount: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0]
                    }
                  },
                  paidAmount: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0]
                    }
                  }
                }
              },
              { $sort: { totalAmount: -1, _id: 1 } }
            ],
            trends: [
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$expenseDate',
                      timezone: 'UTC'
                    }
                  },
                  requested: { $sum: 1 },
                  approved: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'approved'] }, 1, 0]
                    }
                  },
                  rejected: {
                    $sum: {
                      $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
                    }
                  }
                }
              },
              { $sort: { _id: 1 } }
            ],
            categories: [
              {
                $group: {
                  _id: '$categoryKey',
                  totalAmount: { $sum: '$amount' },
                  requests: { $sum: 1 }
                }
              },
              { $sort: { totalAmount: -1, _id: 1 } },
              { $limit: DASHBOARD_TOP_CATEGORIES_LIMIT }
            ],
            pendingStats: [
              {
                $match: {
                  status: { $in: DASHBOARD_PENDING_STATUSES }
                }
              },
              {
                $group: {
                  _id: null,
                  pendingRequests: { $sum: 1 },
                  oldestCreatedAt: { $min: '$createdAt' }
                }
              }
            ]
          }
        }
      ]),
      ExpenseCategoryModel.find({
        tenantId: tenantObjectId
      })
        .sort({ name: 1 })
        .select({ key: 1, name: 1 })
        .lean(),
      this.getSettings(input.tenantId)
    ]);

    const dashboardAggregate = aggregateResult[0] ?? {
      kpis: [],
      totalsByCurrency: [],
      trends: [],
      categories: [],
      pendingStats: []
    };

    const availableCategories: ExpenseDashboardAvailableCategoryView[] = catalog.map((category) => ({
      key: category.key,
      name: category.name
    }));
    const categoryLabelMap = new Map(availableCategories.map((category) => [category.key, category.name]));

    const totalsByCurrency: ExpenseDashboardCurrencyTotalsView[] = dashboardAggregate.totalsByCurrency.map(
      (currencyTotals) => ({
        currency: currencyTotals._id,
        requestCount: currencyTotals.requestCount,
        totalAmount: currencyTotals.totalAmount,
        pendingAmount: currencyTotals.pendingAmount,
        approvedAmount: currencyTotals.approvedAmount,
        paidAmount: currencyTotals.paidAmount
      })
    );

    const primaryCurrency = selectPrimaryCurrency(
      totalsByCurrency,
      settings.allowedCurrencies[0] ?? null
    );
    const primaryCurrencyTotals = primaryCurrency
      ? totalsByCurrency.find((currencyTotals) => currencyTotals.currency === primaryCurrency)
      : undefined;
    const currentCounts = dashboardAggregate.kpis[0] ?? {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0
    };
    const trendMap = new Map<string, Omit<ExpenseDashboardTrendPointView, 'day'>>(
      dashboardAggregate.trends.map((trend) => [
        trend._id,
        {
          requested: trend.requested,
          approved: trend.approved,
          rejected: trend.rejected
        }
      ])
    );
    const categories: ExpenseDashboardCategoryBreakdownView[] = dashboardAggregate.categories.map(
      (category) => ({
        categoryKey: category._id,
        label: categoryLabelMap.get(category._id) ?? category._id,
        totalAmount: category.totalAmount,
        requests: category.requests
      })
    );

    return {
      filters: {
        dateWindowDays: input.dateWindowDays,
        status: input.status ?? null,
        categoryKey: input.categoryKey ?? null
      },
      primaryCurrency,
      hasMixedCurrencies: totalsByCurrency.length > 1,
      totalsByCurrency,
      availableCategories,
      kpis: buildDashboardKpis(currentCounts, primaryCurrencyTotals),
      trends: buildDashboardTrendSeries(input.dateWindowDays, trendMap),
      categories,
      alerts: buildDashboardAlerts({
        totalRequests: currentCounts.totalRequests,
        pendingRequests: dashboardAggregate.pendingStats[0]?.pendingRequests ?? 0,
        rejectedRequests: currentCounts.rejectedRequests,
        oldestPendingCreatedAt: dashboardAggregate.pendingStats[0]?.oldestCreatedAt ?? null
      })
    };
  }

  async createCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategoryView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = parseObjectIdInput(input.tenantId, 'tenantId');

    try {
      const created = await ExpenseCategoryModel.create({
        tenantId,
        key: input.key.trim(),
        normalizedKey: normalizeCategoryKey(input.key),
        name: input.name.trim(),
        requiresAttachment: input.requiresAttachment ?? true,
        isActive: true,
        monthlyLimit: input.monthlyLimit ?? null
      });

      const view = toCategoryView(created.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'expenses.category.create',
        resource: {
          type: 'expense_category',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            key: view.key,
            name: view.name
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildExpensesError(
          ERROR_CODES.EXPENSE_CATEGORY_ALREADY_EXISTS,
          'Expense category already exists',
          HTTP_STATUS.CONFLICT
        );
      }
      throw error;
    }
  }

  async listCategories(input: ListExpenseCategoriesInput): Promise<ListExpenseCategoriesResult> {
    const query: Record<string, unknown> = {
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId')
    };

    if (!input.includeInactive) {
      query.isActive = true;
    }

    if (input.search) {
      query.$or = [
        { key: { $regex: escapeRegexLiteral(input.search), $options: 'i' } },
        { name: { $regex: escapeRegexLiteral(input.search), $options: 'i' } }
      ];
    }

    const skip = (input.page - 1) * input.limit;
    const [categories, total] = await Promise.all([
      ExpenseCategoryModel.find(query).sort({ name: 1 }).skip(skip).limit(input.limit).lean(),
      ExpenseCategoryModel.countDocuments(query)
    ]);

    return {
      items: categories.map((category) => toCategoryView(category)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async updateCategory(input: UpdateExpenseCategoryInput): Promise<ExpenseCategoryView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = parseObjectIdInput(input.tenantId, 'tenantId');
    const categoryId = parseObjectIdInput(input.categoryId, 'categoryId');
    const updateData: Record<string, unknown> = {};

    if (typeof input.patch.name === 'string') {
      updateData.name = input.patch.name.trim();
    }
    if (typeof input.patch.requiresAttachment === 'boolean') {
      updateData.requiresAttachment = input.patch.requiresAttachment;
    }
    if (typeof input.patch.isActive === 'boolean') {
      updateData.isActive = input.patch.isActive;
    }
    if (typeof input.patch.monthlyLimit !== 'undefined') {
      updateData.monthlyLimit = input.patch.monthlyLimit;
    }

    const updated = await ExpenseCategoryModel.findOneAndUpdate(
      {
        _id: categoryId,
        tenantId
      },
      {
        $set: updateData
      },
      {
        new: true
      }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_CATEGORY_NOT_FOUND,
        'Expense category not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toCategoryView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.category.update',
      resource: {
        type: 'expense_category',
        id: view.id
      },
      severity: 'info',
      changes: {
        fields: Object.keys(input.patch),
        after: {
          name: view.name,
          isActive: view.isActive
        }
      }
    });

    return view;
  }

  async getSettings(tenantId: string): Promise<ExpenseSettingsView> {
    const tenantObjectId = parseObjectIdInput(tenantId, 'tenantId');
    const settings = await ExpenseSettingsModel.findOneAndUpdate(
      { tenantId: tenantObjectId },
      {
        $setOnInsert: {
          allowedCurrencies: ['USD'],
          maxAmountWithoutReview: 0,
          approvalMode: 'single_step',
          bulkMaxItemsPerOperation: 100,
          exportsEnabled: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (!settings) {
      throw buildExpensesError(
        ERROR_CODES.INTERNAL_ERROR,
        'Expense settings could not be loaded',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return toSettingsView(settings);
  }

  async updateSettings(input: UpdateExpenseSettingsInput): Promise<ExpenseSettingsView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantObjectId = parseObjectIdInput(input.tenantId, 'tenantId');

    const updateData: Record<string, unknown> = {};
    if (typeof input.allowedCurrencies !== 'undefined') {
      updateData.allowedCurrencies = input.allowedCurrencies.map(normalizeCurrency);
    }
    if (typeof input.maxAmountWithoutReview === 'number') {
      updateData.maxAmountWithoutReview = input.maxAmountWithoutReview;
    }
    if (typeof input.approvalMode === 'string') {
      updateData.approvalMode = input.approvalMode;
    }
    if (typeof input.bulkMaxItemsPerOperation === 'number') {
      updateData.bulkMaxItemsPerOperation = input.bulkMaxItemsPerOperation;
    }
    if (typeof input.exportsEnabled === 'boolean') {
      updateData.exportsEnabled = input.exportsEnabled;
    }

    const settings = await ExpenseSettingsModel.findOneAndUpdate(
      {
        tenantId: tenantObjectId
      },
      {
        $set: updateData,
        $setOnInsert: {
          allowedCurrencies: ['USD'],
          maxAmountWithoutReview: 0,
          approvalMode: 'single_step',
          bulkMaxItemsPerOperation: 100,
          exportsEnabled: true
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    if (!settings) {
      throw buildExpensesError(
        ERROR_CODES.INTERNAL_ERROR,
        'Expense settings could not be updated',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const view = toSettingsView(settings.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.settings.update',
      resource: {
        type: 'expense_settings',
        id: view.tenantId
      },
      severity: 'warning',
      changes: {
        fields: Object.keys(updateData)
      }
    });

    return view;
  }

  async submitRequest(input: SubmitExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    this.assertTransitionAllowed('submit', current.status);

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'submitted',
          submittedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.submit',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'info',
      changes: {
        before: { status: current.status },
        after: { status: view.status, submittedAt: view.submittedAt },
        fields: ['status', 'submittedAt']
      }
    });

    return view;
  }

  async reviewRequest(input: ReviewExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertTransitionAllowed('review', current.status);
    const reviewComment = input.comment.trim();

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'returned',
          rejectionReasonCode: null,
          metadata: {
            ...(current.metadata ?? {}),
            workflow: {
              ...(typeof current.metadata === 'object' &&
              current.metadata !== null &&
              'workflow' in current.metadata
                ? (current.metadata.workflow as Record<string, unknown>)
                : {}),
              lastReviewComment: reviewComment
            }
          }
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.review',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'info',
      changes: {
        before: { status: current.status },
        after: { status: view.status },
        fields: ['status']
      },
      metadata: {
        comment: reviewComment
      }
    });

    await this.sendExpenseStatusNotification(view, {
      semantic: 'expense-returned',
      comment: reviewComment
    });

    return view;
  }

  async approveRequest(input: ApproveExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertTransitionAllowed('approve', current.status);
    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          rejectionReasonCode: null
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.approve',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'warning',
      changes: {
        before: { status: current.status },
        after: { status: view.status, approvedAt: view.approvedAt },
        fields: ['status', 'approvedAt']
      }
    });

    await this.sendExpenseStatusNotification(view, {
      semantic: 'expense-approved'
    });

    return view;
  }

  async rejectRequest(input: RejectExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertTransitionAllowed('reject', current.status);
    const reasonCode = input.reasonCode.trim();
    const rejectComment = normalizeOptionalText(input.comment);

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'rejected',
          rejectionReasonCode: reasonCode
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.reject',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'warning',
      changes: {
        before: { status: current.status },
        after: {
          status: view.status,
          rejectionReasonCode: view.rejectionReasonCode
        },
        fields: ['status', 'rejectionReasonCode']
      },
      metadata: rejectComment ? { comment: rejectComment } : undefined
    });

    await this.sendExpenseStatusNotification(view, {
      semantic: 'expense-rejected',
      comment: rejectComment ?? undefined
    });

    return view;
  }

  async cancelRequest(input: CancelExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    this.assertTransitionAllowed('cancel', current.status);
    const cancelReason = normalizeOptionalText(input.reason);

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'canceled',
          canceledAt: new Date()
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.cancel',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'warning',
      changes: {
        before: { status: current.status },
        after: {
          status: view.status,
          canceledAt: view.canceledAt
        },
        fields: ['status', 'canceledAt']
      },
      metadata: cancelReason ? { reason: cancelReason } : undefined
    });

    await this.sendExpenseStatusNotification(view, {
      semantic: 'expense-canceled',
      comment: cancelReason ?? undefined
    });

    return view;
  }

  async markRequestAsPaid(input: MarkPaidExpenseRequestInput): Promise<ExpenseRequestView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertTransitionAllowed('mark_paid', current.status);
    const paymentReference = normalizeOptionalText(input.paymentReference);

    const updated = await ExpenseRequestModel.findOneAndUpdate(
      {
        _id: current._id,
        tenantId: current.tenantId
      },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paymentReference
        }
      },
      { new: true }
    );

    if (!updated) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toRequestView(updated.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.request.mark_paid',
      resource: {
        type: 'expense_request',
        id: view.id
      },
      severity: 'warning',
      changes: {
        before: { status: current.status },
        after: {
          status: view.status,
          paidAt: view.paidAt,
          paymentReference: view.paymentReference
        },
        fields: ['status', 'paidAt', 'paymentReference']
      }
    });

    await this.sendExpenseStatusNotification(view, {
      semantic: 'expense-paid',
      comment: paymentReference ?? undefined
    });

    return view;
  }

  async createUploadPresign(
    input: CreateExpenseUploadPresignInput
  ): Promise<ExpenseUploadPresignView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    ensureMutableRequestStatus(current.status);

    const sanitizedFilename = input.originalFilename.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${input.tenantId}/expenses/${input.requestId}/${Date.now()}-${sanitizedFilename}`;

    return {
      storageProvider: 'mock-s3',
      objectKey,
      uploadUrl: `/api/v1/modules/expenses/uploads/mock/${encodeURIComponent(objectKey)}`,
      method: 'PUT',
      requiredHeaders: {
        'Content-Type': input.mimeType
      },
      expiresInSeconds: 900
    };
  }

  async createAttachment(input: CreateExpenseAttachmentInput): Promise<ExpenseAttachmentView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    ensureMutableRequestStatus(current.status);

    try {
      const created = await ExpenseAttachmentModel.create({
        tenantId: parseObjectIdInput(input.tenantId, 'tenantId'),
        expenseRequestId: parseObjectIdInput(input.requestId, 'requestId'),
        storageProvider: input.storageProvider.trim(),
        objectKey: input.objectKey.trim(),
        originalFilename: input.originalFilename.trim(),
        mimeType: input.mimeType.trim(),
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256.trim().toLowerCase(),
        uploadedByUserId: parseObjectIdInput(input.actorUserId, 'actorUserId'),
        isActive: true
      });
      const view = toAttachmentView(created.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'expenses.attachment.create',
        resource: {
          type: 'expense_attachment',
          id: view.id
        },
        severity: 'info',
        metadata: {
          expenseRequestId: view.expenseRequestId,
          objectKey: view.objectKey
        }
      });
      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildExpensesError(
          ERROR_CODES.VALIDATION_ERROR,
          'Attachment object key already registered for this request',
          HTTP_STATUS.CONFLICT
        );
      }
      throw error;
    }
  }

  async listAttachments(input: ListExpenseAttachmentsInput): Promise<ExpenseAttachmentView[]> {
    await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    const attachments = await ExpenseAttachmentModel.find({
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId'),
      expenseRequestId: parseObjectIdInput(input.requestId, 'requestId'),
      isActive: true
    })
      .sort({ createdAt: -1 })
      .lean();

    return attachments.map((attachment) => toAttachmentView(attachment));
  }

  async deleteAttachment(input: DeleteExpenseAttachmentInput): Promise<ExpenseAttachmentView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const current = await this.findRequestOrThrow({
      tenantId: input.tenantId,
      requestId: input.requestId
    });

    this.assertOwnsRequest(current.requesterUserId, input.actorUserId);
    ensureMutableRequestStatus(current.status);

    const attachment = await ExpenseAttachmentModel.findOneAndUpdate(
      {
        _id: parseObjectIdInput(input.attachmentId, 'attachmentId'),
        tenantId: parseObjectIdInput(input.tenantId, 'tenantId'),
        expenseRequestId: parseObjectIdInput(input.requestId, 'requestId'),
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

    if (!attachment) {
      throw buildExpensesError(ERROR_CODES.NOT_FOUND, 'Expense attachment not found', HTTP_STATUS.NOT_FOUND);
    }

    const view = toAttachmentView(attachment.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'expenses.attachment.delete',
      resource: {
        type: 'expense_attachment',
        id: view.id
      },
      severity: 'warning'
    });

    return view;
  }

  async bulkApproveRequests(input: BulkApproveExpenseRequestsInput): Promise<ExpenseBulkOperationResult> {
    return this.processBulkOperation({
      tenantId: input.tenantId,
      requestIds: input.requestIds,
      context: input.context,
      action: 'approve',
      processor: async (requestId) =>
        this.approveRequest({
          tenantId: input.tenantId,
          requestId,
          actorUserId: input.actorUserId,
          context: input.context
        })
    });
  }

  async bulkRejectRequests(input: BulkRejectExpenseRequestsInput): Promise<ExpenseBulkOperationResult> {
    return this.processBulkOperation({
      tenantId: input.tenantId,
      requestIds: input.requestIds,
      context: input.context,
      action: 'reject',
      processor: async (requestId) =>
        this.rejectRequest({
          tenantId: input.tenantId,
          requestId,
          reasonCode: input.reasonCode,
          comment: input.comment,
          actorUserId: input.actorUserId,
          context: input.context
        })
    });
  }

  async bulkMarkRequestsAsPaid(
    input: BulkMarkPaidExpenseRequestsInput
  ): Promise<ExpenseBulkOperationResult> {
    return this.processBulkOperation({
      tenantId: input.tenantId,
      requestIds: input.requestIds,
      context: input.context,
      action: 'mark_paid',
      processor: async (requestId) =>
        this.markRequestAsPaid({
          tenantId: input.tenantId,
          requestId,
          paymentReference: input.paymentReference,
          actorUserId: input.actorUserId,
          context: input.context
        })
    });
  }

  async bulkExportRequests(input: BulkExportExpenseRequestsInput): Promise<ExpenseExportRow[]> {
    await this.assertBulkRequestLimit(input.tenantId, input.requestIds.length);
    const requestIds = input.requestIds.map((id) => parseObjectIdInput(id, 'requestId'));
    const requests = await ExpenseRequestModel.find({
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId'),
      _id: { $in: requestIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    return requests.map((request) => ({
      id: request._id.toString(),
      requestNumber: request.requestNumber,
      status: request.status as ExpenseRequestStatus,
      categoryKey: request.categoryKey,
      amount: request.amount,
      currency: request.currency,
      expenseDate: request.expenseDate.toISOString()
    }));
  }

  async getSummary(tenantId: string): Promise<ExpenseSummaryView> {
    const [counters, totals] = await Promise.all([
      this.getCounters(tenantId),
      ExpenseRequestModel.aggregate<{
        _id: ExpenseRequestStatus;
        totalAmount: number;
      }>([
        { $match: { tenantId: parseObjectIdInput(tenantId, 'tenantId') } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    const amountsByStatus = new Map(totals.map((item) => [item._id, item.totalAmount]));
    const totalRequestedAmount = Array.from(amountsByStatus.values()).reduce((acc, value) => acc + value, 0);
    const totalApprovedAmount = amountsByStatus.get('approved') ?? 0;
    const totalPaidAmount = amountsByStatus.get('paid') ?? 0;

    return {
      counters,
      totalRequestedAmount,
      totalApprovedAmount,
      totalPaidAmount
    };
  }

  async exportRequestsCsv(tenantId: string): Promise<ExpenseCsvExportView> {
    const requests = await ExpenseRequestModel.find({
      tenantId: parseObjectIdInput(tenantId, 'tenantId')
    })
      .sort({ createdAt: -1 })
      .lean();

    const header = ['id', 'requestNumber', 'status', 'categoryKey', 'amount', 'currency', 'expenseDate'];
    const rows = requests.map((request) => [
      request._id.toString(),
      request.requestNumber,
      request.status,
      request.categoryKey,
      request.amount.toFixed(2),
      request.currency,
      request.expenseDate.toISOString()
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))].join(
      '\n'
    );

    return {
      filename: `expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: 'text/csv',
      csv,
      rows: rows.length
    };
  }

  private async processBulkOperation(input: {
    tenantId: string;
    requestIds: string[];
    action: 'approve' | 'reject' | 'mark_paid';
    context?: ExecutionContext;
    processor: (requestId: string) => Promise<ExpenseRequestView>;
  }): Promise<ExpenseBulkOperationResult> {
    await this.assertBulkRequestLimit(input.tenantId, input.requestIds.length);

    const results: ExpenseBulkOperationItemResult[] = [];
    for (const requestId of input.requestIds) {
      try {
        await input.processor(requestId);
        results.push({
          id: requestId,
          success: true
        });
      } catch (error) {
        if (error instanceof AppError) {
          results.push({
            id: requestId,
            success: false,
            code: error.code,
            message: error.message
          });
        } else {
          results.push({
            id: requestId,
            success: false,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Unexpected bulk operation error'
          });
        }
      }
    }

    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;
    const summary: ExpenseBulkOperationResult = {
      processed: results.length,
      succeeded,
      failed,
      results
    };

    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: `expenses.bulk.${input.action}`,
      resource: {
        type: 'expense_bulk_operation'
      },
      severity: failed > 0 ? 'warning' : 'info',
      metadata: {
        processed: summary.processed,
        succeeded: summary.succeeded,
        failed: summary.failed
      }
    });

    return summary;
  }

  private async assertBulkRequestLimit(tenantId: string, count: number): Promise<void> {
    const settings = await this.getSettings(tenantId);
    if (count > settings.bulkMaxItemsPerOperation) {
      throw buildExpensesError(
        ERROR_CODES.VALIDATION_ERROR,
        `Bulk operation exceeds max items per operation (${settings.bulkMaxItemsPerOperation})`,
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  private assertTransitionAllowed(
    action: 'submit' | 'review' | 'approve' | 'reject' | 'cancel' | 'mark_paid',
    status: ExpenseRequestStatus
  ): void {
    if (!isExpenseWorkflowTransitionAllowed(action, status)) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_STATE_INVALID,
        `Expense request cannot execute action ${action} from status ${status}`,
        HTTP_STATUS.CONFLICT
      );
    }
  }

  private assertOwnsRequest(
    requesterUserId: Types.ObjectId | string,
    actorUserId: string | undefined
  ): void {
    if (!actorUserId) {
      throw buildExpensesError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authenticated user required for own-scope expense operation',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const requesterId =
      typeof requesterUserId === 'string' ? requesterUserId : requesterUserId.toString();
    if (requesterId !== actorUserId) {
      throw buildExpensesError(
        ERROR_CODES.TENANT_ACCESS_DENIED,
        'Expense request does not belong to the authenticated user',
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  private async findRequestOrThrow(input: {
    tenantId: string;
    requestId: string;
  }): Promise<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    requesterUserId: Types.ObjectId;
    status: ExpenseRequestStatus;
    metadata?: Record<string, unknown>;
  }> {
    const request = await ExpenseRequestModel.findOne({
      _id: parseObjectIdInput(input.requestId, 'requestId'),
      tenantId: parseObjectIdInput(input.tenantId, 'tenantId')
    });
    if (!request) {
      throw buildExpensesError(
        ERROR_CODES.EXPENSE_REQUEST_NOT_FOUND,
        'Expense request not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return request;
  }

  private async sendExpenseStatusNotification(
    request: ExpenseRequestView,
    input: {
      semantic:
        | 'expense-submitted'
        | 'expense-returned'
        | 'expense-approved'
        | 'expense-rejected'
        | 'expense-canceled'
        | 'expense-paid';
      comment?: string;
    }
  ): Promise<void> {
    try {
      const requester = await UserModel.findById(request.requesterUserId).lean();
      if (!requester?.email) {
        return;
      }

      await transactionalEmailService.sendTemplate({
        templateKey: 'expense-status-update',
        to: requester.email,
        semantic: input.semantic,
        variables: {
          applicationName: 'SaaS Core Engine',
          recipientEmail: requester.email,
          recipientFirstName: requester.firstName ?? null,
          requestNumber: request.requestNumber,
          status: request.status,
          amount: request.amount,
          currency: request.currency,
          comment: input.comment ?? null,
          supportEmail: null
        }
      });
    } catch (error) {
      logger.warn(
        {
          module: 'expenses',
          event: input.semantic,
          requestNumber: request.requestNumber,
          error: error instanceof Error ? error.message : 'unknown'
        },
        'Expense status notification failed; continuing without blocking workflow.'
      );
    }
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

export const expensesService = new ExpensesService();
