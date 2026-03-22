import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const expenseCategorySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      trim: true
    },
    normalizedKey: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    requiresAttachment: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    monthlyLimit: {
      type: Number,
      default: null
    }
  },
  {
    collection: 'expense_categories'
  }
);

expenseCategorySchema.index(
  {
    tenantId: 1,
    normalizedKey: 1
  },
  {
    unique: true
  }
);

expenseCategorySchema.plugin(baseDocumentPlugin);

export type ExpenseCategoryDocument = HydratedDocument<
  InferSchemaType<typeof expenseCategorySchema>
>;

export const ExpenseCategoryModel = model<ExpenseCategoryDocument>(
  'ExpenseCategory',
  expenseCategorySchema
);
