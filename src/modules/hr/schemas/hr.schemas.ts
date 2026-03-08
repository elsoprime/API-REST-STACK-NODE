import { z } from 'zod';

import {
  HR_EMPLOYEE_STATUSES,
  HR_EMPLOYMENT_TYPES,
  HR_PAY_FREQUENCIES
} from '@/modules/hr/types/hr.types';

function parseIsoDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function addEmployeeDateIssues(
  value: {
    startDate?: string;
    endDate?: string | null;
    birthDate?: string | null;
  },
  context: z.RefinementCtx
): void {
  const startDate = parseIsoDate(value.startDate);
  const endDate = parseIsoDate(value.endDate);
  const birthDate = parseIsoDate(value.birthDate);

  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'endDate must be greater than or equal to startDate'
    });
  }

  if (startDate && birthDate && birthDate.getTime() >= startDate.getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['birthDate'],
      message: 'birthDate must be before startDate'
    });
  }
}

export const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

const nullableEmailSchema = z.union([z.string().trim().email(), z.null()]);
const nullableText120Schema = z.union([z.string().trim().min(1).max(120), z.null()]);
const nullableText160Schema = z.union([z.string().trim().min(1).max(160), z.null()]);
const nullableText200Schema = z.union([z.string().trim().min(1).max(200), z.null()]);
const nullablePhoneSchema = z.union([z.string().trim().min(1).max(40), z.null()]);
const isoDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

export const createHrEmployeeSchema = z
  .object({
    employeeCode: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    workEmail: nullableEmailSchema.optional(),
    personalEmail: nullableEmailSchema.optional(),
    phone: nullablePhoneSchema.optional(),
    department: nullableText120Schema.optional(),
    jobTitle: nullableText160Schema.optional(),
    employmentType: z.enum(HR_EMPLOYMENT_TYPES),
    status: z.enum(HR_EMPLOYEE_STATUSES).default('active'),
    startDate: isoDateSchema,
    endDate: z.union([isoDateSchema, z.null()]).optional(),
    birthDate: z.union([isoDateSchema, z.null()]).optional(),
    managerId: z.union([objectIdSchema, z.null()]).optional()
  })
  .superRefine(addEmployeeDateIssues);

export const listHrEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(160).optional(),
  status: z.enum(HR_EMPLOYEE_STATUSES).optional(),
  department: z.string().trim().min(1).max(120).optional()
});

export const updateHrEmployeeSchema = z
  .object({
    employeeCode: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    workEmail: nullableEmailSchema.optional(),
    personalEmail: nullableEmailSchema.optional(),
    phone: nullablePhoneSchema.optional(),
    department: nullableText120Schema.optional(),
    jobTitle: nullableText160Schema.optional(),
    employmentType: z.enum(HR_EMPLOYMENT_TYPES).optional(),
    status: z.enum(HR_EMPLOYEE_STATUSES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: z.union([isoDateSchema, z.null()]).optional(),
    birthDate: z.union([isoDateSchema, z.null()]).optional(),
    managerId: z.union([objectIdSchema, z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one employee field is required'
  })
  .superRefine(addEmployeeDateIssues);

export const hrEmployeeParamsSchema = z.object({
  employeeId: objectIdSchema
});

export const updateHrCompensationSchema = z
  .object({
    salaryAmount: z.coerce.number().min(0).optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
    payFrequency: z.enum(HR_PAY_FREQUENCIES).optional(),
    effectiveFrom: isoDateSchema.optional(),
    notes: nullableText200Schema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one compensation field is required'
  });
