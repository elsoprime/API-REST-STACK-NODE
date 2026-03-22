import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { EXPENSE_APPROVAL_MODES } from '@/modules/expenses/types/expenses.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const expenseSettingsSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true
    },
    allowedCurrencies: {
      type: [String],
      required: true,
      default: ['USD']
    },
    maxAmountWithoutReview: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    approvalMode: {
      type: String,
      enum: EXPENSE_APPROVAL_MODES,
      required: true,
      default: 'single_step'
    },
    bulkMaxItemsPerOperation: {
      type: Number,
      required: true,
      min: 1,
      default: 100
    },
    exportsEnabled: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  {
    collection: 'expense_settings'
  }
);

expenseSettingsSchema.plugin(baseDocumentPlugin);

export type ExpenseSettingsDocument = HydratedDocument<
  InferSchemaType<typeof expenseSettingsSchema>
>;

export const ExpenseSettingsModel = model<ExpenseSettingsDocument>(
  'ExpenseSettings',
  expenseSettingsSchema
);
