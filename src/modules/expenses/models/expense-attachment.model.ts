import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const expenseAttachmentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    expenseRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseRequest',
      required: true,
      index: true
    },
    storageProvider: {
      type: String,
      required: true,
      trim: true
    },
    objectKey: {
      type: String,
      required: true,
      trim: true
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1
    },
    checksumSha256: {
      type: String,
      required: true,
      trim: true
    },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: 'expense_attachments'
  }
);

expenseAttachmentSchema.index(
  {
    tenantId: 1,
    expenseRequestId: 1,
    objectKey: 1
  },
  {
    unique: true
  }
);

expenseAttachmentSchema.plugin(baseDocumentPlugin);

export type ExpenseAttachmentDocument = HydratedDocument<
  InferSchemaType<typeof expenseAttachmentSchema>
>;

export const ExpenseAttachmentModel = model<ExpenseAttachmentDocument>(
  'ExpenseAttachment',
  expenseAttachmentSchema
);
