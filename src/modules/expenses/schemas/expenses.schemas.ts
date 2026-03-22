import { z } from 'zod';

import {
  EXPENSE_APPROVAL_MODES,
  EXPENSE_REQUEST_STATUSES
} from '@/modules/expenses/types/expenses.types';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');
const isoDateStringSchema = z.string().datetime({ offset: true });
const currencySchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);

export const listExpenseRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(EXPENSE_REQUEST_STATUSES).optional(),
  categoryKey: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(160).optional()
});

export const createExpenseRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.union([z.string().trim().min(1).max(800), z.null()]).optional(),
  categoryKey: z.string().trim().min(1).max(80),
  amount: z.coerce.number().min(0),
  currency: currencySchema,
  expenseDate: isoDateStringSchema,
  metadata: z.record(z.unknown()).optional()
});

export const updateExpenseRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.union([z.string().trim().min(1).max(800), z.null()]).optional(),
    categoryKey: z.string().trim().min(1).max(80).optional(),
    amount: z.coerce.number().min(0).optional(),
    currency: currencySchema.optional(),
    expenseDate: isoDateStringSchema.optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one request field is required'
  });

export const expenseRequestParamsSchema = z.object({
  requestId: objectIdSchema
});

export const listExpenseQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const listExpenseCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  includeInactive: z.coerce.boolean().default(false)
});

export const createExpenseCategorySchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/),
  name: z.string().trim().min(1).max(120),
  requiresAttachment: z.boolean().optional(),
  monthlyLimit: z.union([z.coerce.number().min(0), z.null()]).optional()
});

export const updateExpenseCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    requiresAttachment: z.boolean().optional(),
    isActive: z.boolean().optional(),
    monthlyLimit: z.union([z.coerce.number().min(0), z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one category field is required'
  });

export const expenseCategoryParamsSchema = z.object({
  categoryId: objectIdSchema
});

export const updateExpenseSettingsSchema = z
  .object({
    allowedCurrencies: z.array(currencySchema).min(1).max(10).optional(),
    maxAmountWithoutReview: z.coerce.number().min(0).optional(),
    approvalMode: z.enum(EXPENSE_APPROVAL_MODES).optional(),
    bulkMaxItemsPerOperation: z.coerce.number().int().min(1).max(1000).optional(),
    exportsEnabled: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one settings field is required'
  });

export const createExpenseUploadPresignSchema = z.object({
  requestId: objectIdSchema,
  originalFilename: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024)
});

export const createExpenseAttachmentSchema = z.object({
  storageProvider: z.string().trim().min(1).max(80),
  objectKey: z.string().trim().min(1).max(500),
  originalFilename: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024),
  checksumSha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/)
});

export const expenseAttachmentParamsSchema = z.object({
  requestId: objectIdSchema,
  attachmentId: objectIdSchema
});

export const bulkExpenseRequestIdsSchema = z
  .array(objectIdSchema)
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Duplicate request ids are not allowed'
  });

export const bulkApproveExpenseRequestsSchema = z.object({
  requestIds: bulkExpenseRequestIdsSchema
});

export const bulkRejectExpenseRequestsSchema = z.object({
  requestIds: bulkExpenseRequestIdsSchema,
  reasonCode: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/),
  comment: z.string().trim().min(1).max(1000).optional()
});

export const bulkMarkPaidExpenseRequestsSchema = z.object({
  requestIds: bulkExpenseRequestIdsSchema,
  paymentReference: z.string().trim().min(1).max(120).optional()
});

export const bulkExportExpenseRequestsSchema = z.object({
  requestIds: bulkExpenseRequestIdsSchema
});
