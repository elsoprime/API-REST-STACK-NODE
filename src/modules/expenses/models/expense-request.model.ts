import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { EXPENSE_REQUEST_STATUSES } from '@/modules/expenses/types/expenses.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const expenseRequestSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    requestNumber: {
      type: String,
      required: true,
      trim: true
    },
    requesterUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: null
    },
    categoryKey: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      trim: true
    },
    expenseDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: EXPENSE_REQUEST_STATUSES,
      required: true,
      default: 'draft',
      index: true
    },
    submittedAt: {
      type: Date,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    paidAt: {
      type: Date,
      default: null
    },
    canceledAt: {
      type: Date,
      default: null
    },
    rejectionReasonCode: {
      type: String,
      default: null
    },
    paymentReference: {
      type: String,
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    collection: 'expense_requests'
  }
);

expenseRequestSchema.index(
  {
    tenantId: 1,
    requestNumber: 1
  },
  {
    unique: true
  }
);

expenseRequestSchema.index({
  tenantId: 1,
  status: 1,
  createdAt: -1
});

expenseRequestSchema.plugin(baseDocumentPlugin);

export type ExpenseRequestDocument = HydratedDocument<InferSchemaType<typeof expenseRequestSchema>>;

export const ExpenseRequestModel = model<ExpenseRequestDocument>('ExpenseRequest', expenseRequestSchema);
