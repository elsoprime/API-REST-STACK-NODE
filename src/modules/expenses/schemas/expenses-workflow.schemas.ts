import { z } from 'zod';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

export const expenseWorkflowRequestParamsSchema = z.object({
  requestId: objectIdSchema
});

export const reviewExpenseRequestSchema = z.object({
  comment: z.string().trim().min(1).max(1000)
});

export const rejectExpenseRequestSchema = z.object({
  reasonCode: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._:-]+$/),
  comment: z.string().trim().min(1).max(1000).optional()
});

export const cancelExpenseRequestSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional()
});

export const markPaidExpenseRequestSchema = z.object({
  paymentReference: z.string().trim().min(1).max(120).optional()
});
