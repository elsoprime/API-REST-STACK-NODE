import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const expenseSubcategorySchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
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
    collection: 'expense_subcategories'
  }
);

expenseSubcategorySchema.index(
  {
    tenantId: 1,
    categoryId: 1,
    normalizedKey: 1
  },
  {
    unique: true
  }
);

expenseSubcategorySchema.plugin(baseDocumentPlugin);

export type ExpenseSubcategoryDocument = HydratedDocument<
  InferSchemaType<typeof expenseSubcategorySchema>
>;

export const ExpenseSubcategoryModel = model<ExpenseSubcategoryDocument>(
  'ExpenseSubcategory',
  expenseSubcategorySchema
);

