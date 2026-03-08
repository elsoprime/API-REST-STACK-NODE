import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const HR_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contractor', 'intern'] as const;
export const HR_EMPLOYEE_STATUSES = ['active', 'inactive', 'terminated'] as const;
export const HR_PAY_FREQUENCIES = ['monthly', 'biweekly', 'weekly'] as const;

export type HrEmploymentType = (typeof HR_EMPLOYMENT_TYPES)[number];
export type HrEmployeeStatus = (typeof HR_EMPLOYEE_STATUSES)[number];
export type HrPayFrequency = (typeof HR_PAY_FREQUENCIES)[number];

export interface HrEmployeeView {
  id: string;
  tenantId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  employmentType: HrEmploymentType;
  status: HrEmployeeStatus;
  startDate: string;
  endDate: string | null;
  birthDate: string | null;
  managerId: string | null;
  isActive: boolean;
  deletedAt: string | null;
}

export interface HrCompensationView {
  id: string;
  tenantId: string;
  employeeId: string;
  salaryAmount: number;
  currency: string;
  payFrequency: HrPayFrequency;
  effectiveFrom: string;
  notes: string | null;
  isActive: boolean;
}

export interface ListHrEmployeesInput {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
  status?: HrEmployeeStatus;
  department?: string;
}

export interface ListHrEmployeesResult {
  items: HrEmployeeView[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateHrEmployeeInput {
  tenantId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentType: HrEmploymentType;
  status?: HrEmployeeStatus;
  startDate: string;
  endDate?: string | null;
  birthDate?: string | null;
  managerId?: string | null;
  context?: ExecutionContext;
}

export interface UpdateHrEmployeePatch {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  workEmail?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentType?: HrEmploymentType;
  status?: HrEmployeeStatus;
  startDate?: string;
  endDate?: string | null;
  birthDate?: string | null;
  managerId?: string | null;
}

export interface UpdateHrEmployeeInput {
  tenantId: string;
  employeeId: string;
  patch: UpdateHrEmployeePatch;
  context?: ExecutionContext;
}

export interface DeleteHrEmployeeInput {
  tenantId: string;
  employeeId: string;
  context?: ExecutionContext;
}

export interface GetHrEmployeeInput {
  tenantId: string;
  employeeId: string;
}

export interface GetHrCompensationInput {
  tenantId: string;
  employeeId: string;
}

export interface UpdateHrCompensationPatch {
  salaryAmount?: number;
  currency?: string;
  payFrequency?: HrPayFrequency;
  effectiveFrom?: string;
  notes?: string | null;
}

export interface UpdateHrCompensationInput {
  tenantId: string;
  employeeId: string;
  patch: UpdateHrCompensationPatch;
  context?: ExecutionContext;
}

export interface HrServiceContract {
  createEmployee: (input: CreateHrEmployeeInput) => Promise<HrEmployeeView>;
  listEmployees: (input: ListHrEmployeesInput) => Promise<ListHrEmployeesResult>;
  getEmployee: (input: GetHrEmployeeInput) => Promise<HrEmployeeView>;
  updateEmployee: (input: UpdateHrEmployeeInput) => Promise<HrEmployeeView>;
  deleteEmployee: (input: DeleteHrEmployeeInput) => Promise<HrEmployeeView>;
  getCompensation: (input: GetHrCompensationInput) => Promise<HrCompensationView>;
  updateCompensation: (input: UpdateHrCompensationInput) => Promise<HrCompensationView>;
}
