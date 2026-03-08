import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import {
  HR_EMPLOYEE_STATUSES,
  HR_EMPLOYMENT_TYPES
} from '@/modules/hr/types/hr.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const hrEmployeeSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true
    },
    normalizedEmployeeCode: {
      type: String,
      required: true,
      trim: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    workEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    personalEmail: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: null
    },
    department: {
      type: String,
      default: null,
      trim: true
    },
    jobTitle: {
      type: String,
      default: null,
      trim: true
    },
    employmentType: {
      type: String,
      enum: HR_EMPLOYMENT_TYPES,
      required: true
    },
    status: {
      type: String,
      enum: HR_EMPLOYEE_STATUSES,
      required: true,
      default: 'active'
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      default: null
    },
    birthDate: {
      type: Date,
      default: null
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'HrEmployee',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'hr_employees'
  }
);

hrEmployeeSchema.index(
  {
    tenantId: 1,
    normalizedEmployeeCode: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true
    }
  }
);

hrEmployeeSchema.index(
  {
    tenantId: 1,
    workEmail: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      workEmail: {
        $type: 'string'
      }
    }
  }
);

hrEmployeeSchema.index({
  tenantId: 1,
  managerId: 1,
  isActive: 1
});

hrEmployeeSchema.plugin(baseDocumentPlugin);

export type HrEmployeeDocument = HydratedDocument<InferSchemaType<typeof hrEmployeeSchema>>;

export const HrEmployeeModel = model<HrEmployeeDocument>('HrEmployee', hrEmployeeSchema);
