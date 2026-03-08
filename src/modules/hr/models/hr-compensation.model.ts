import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';
import { HR_PAY_FREQUENCIES } from '@/modules/hr/types/hr.types';

const hrCompensationSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'HrEmployee',
      required: true,
      index: true
    },
    salaryAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3
    },
    payFrequency: {
      type: String,
      enum: HR_PAY_FREQUENCIES,
      required: true
    },
    effectiveFrom: {
      type: Date,
      required: true
    },
    notes: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    collection: 'hr_compensations'
  }
);

hrCompensationSchema.index(
  {
    tenantId: 1,
    employeeId: 1,
    isActive: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true
    }
  }
);

hrCompensationSchema.plugin(baseDocumentPlugin);

export type HrCompensationDocument = HydratedDocument<InferSchemaType<typeof hrCompensationSchema>>;

export const HrCompensationModel = model<HrCompensationDocument>('HrCompensation', hrCompensationSchema);
