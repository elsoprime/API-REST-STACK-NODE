import { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type AuditTenantScope,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { HrCompensationModel } from '@/modules/hr/models/hr-compensation.model';
import { HrEmployeeModel } from '@/modules/hr/models/hr-employee.model';
import {
  type CreateHrEmployeeInput,
  type DeleteHrEmployeeInput,
  type GetHrCompensationInput,
  type GetHrEmployeeInput,
  type HrCompensationView,
  type HrEmployeeView,
  type HrEmployeeStatus,
  type HrPayFrequency,
  type HrServiceContract,
  type ListHrEmployeesInput,
  type ListHrEmployeesResult,
  type UpdateHrCompensationInput,
  type UpdateHrEmployeeInput
} from '@/modules/hr/types/hr.types';

function buildHrError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function assertTenantContextConsistency(tenantId: string, context?: ExecutionContext): void {
  const contextTenantId = context?.tenant?.tenantId;

  if (!contextTenantId) {
    return;
  }

  if (!Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(contextTenantId)) {
    throw buildHrError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Types.ObjectId(tenantId).toString() !== new Types.ObjectId(contextTenantId).toString()) {
    throw buildHrError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEmployeeCode(value: string): string {
  return value.trim().toUpperCase();
}

function parseDateInput(
  value: string | Date | null | undefined,
  fieldName: string,
  options: {
    required?: boolean;
  } = {}
): Date | null {
  if (typeof value === 'undefined' || value === null) {
    if (options.required) {
      throw buildHrError(ERROR_CODES.VALIDATION_ERROR, `${fieldName} is required`, HTTP_STATUS.BAD_REQUEST);
    }

    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw buildHrError(ERROR_CODES.VALIDATION_ERROR, `${fieldName} is invalid`, HTTP_STATUS.BAD_REQUEST);
    }

    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw buildHrError(ERROR_CODES.VALIDATION_ERROR, `${fieldName} is invalid`, HTTP_STATUS.BAD_REQUEST);
  }

  return parsed;
}

function validateEmployeeLaborDates(input: {
  startDate: Date;
  endDate?: Date | null;
  birthDate?: Date | null;
}): void {
  if (input.endDate && input.endDate.getTime() < input.startDate.getTime()) {
    throw buildHrError(
      ERROR_CODES.VALIDATION_ERROR,
      'Employee endDate must be greater than or equal to startDate',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (input.birthDate && input.birthDate.getTime() >= input.startDate.getTime()) {
    throw buildHrError(
      ERROR_CODES.VALIDATION_ERROR,
      'Employee birthDate must be before startDate',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function toEmployeeView(employee: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentType: string;
  status: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  birthDate?: Date | string | null;
  managerId?: Types.ObjectId | string | null;
  isActive?: boolean;
  deletedAt?: Date | string | null;
}): HrEmployeeView {
  const startDate =
    typeof employee.startDate === 'string' ? employee.startDate : employee.startDate.toISOString();
  const endDate =
    typeof employee.endDate === 'undefined' || employee.endDate === null
      ? null
      : typeof employee.endDate === 'string'
        ? employee.endDate
        : employee.endDate.toISOString();
  const birthDate =
    typeof employee.birthDate === 'undefined' || employee.birthDate === null
      ? null
      : typeof employee.birthDate === 'string'
        ? employee.birthDate
        : employee.birthDate.toISOString();
  const deletedAt =
    typeof employee.deletedAt === 'undefined' || employee.deletedAt === null
      ? null
      : typeof employee.deletedAt === 'string'
        ? employee.deletedAt
        : employee.deletedAt.toISOString();

  return {
    id: employee.id ?? employee._id?.toString() ?? '',
    tenantId: typeof employee.tenantId === 'string' ? employee.tenantId : employee.tenantId.toString(),
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    workEmail: employee.workEmail ?? null,
    personalEmail: employee.personalEmail ?? null,
    phone: employee.phone ?? null,
    department: employee.department ?? null,
    jobTitle: employee.jobTitle ?? null,
    employmentType: employee.employmentType as HrEmployeeView['employmentType'],
    status: employee.status as HrEmployeeStatus,
    startDate,
    endDate,
    birthDate,
    managerId:
      typeof employee.managerId === 'undefined' || employee.managerId === null
        ? null
        : typeof employee.managerId === 'string'
          ? employee.managerId
          : employee.managerId.toString(),
    isActive: employee.isActive ?? true,
    deletedAt
  };
}

function toCompensationView(compensation: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  employeeId: Types.ObjectId | string;
  salaryAmount: number;
  currency: string;
  payFrequency: string;
  effectiveFrom: Date | string;
  notes?: string | null;
  isActive?: boolean;
}): HrCompensationView {
  return {
    id: compensation.id ?? compensation._id?.toString() ?? '',
    tenantId:
      typeof compensation.tenantId === 'string'
        ? compensation.tenantId
        : compensation.tenantId.toString(),
    employeeId:
      typeof compensation.employeeId === 'string'
        ? compensation.employeeId
        : compensation.employeeId.toString(),
    salaryAmount: compensation.salaryAmount,
    currency: compensation.currency,
    payFrequency: compensation.payFrequency as HrPayFrequency,
    effectiveFrom:
      typeof compensation.effectiveFrom === 'string'
        ? compensation.effectiveFrom
        : compensation.effectiveFrom.toISOString(),
    notes: compensation.notes ?? null,
    isActive: compensation.isActive ?? true
  };
}

function toTenantAuditScope(tenantId: string, context?: ExecutionContext): AuditTenantScope {
  return {
    tenantId,
    membershipId: context?.tenant?.membershipId,
    roleKey: context?.tenant?.roleKey,
    isOwner: context?.tenant?.isOwner,
    effectiveRoleKeys: context?.tenant?.effectiveRoleKeys
  };
}

export class HrService implements HrServiceContract {
  constructor(private readonly audit: AuditService = auditService) {}

  async createEmployee(input: CreateHrEmployeeInput): Promise<HrEmployeeView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const startDate = parseDateInput(input.startDate, 'startDate', { required: true });
    if (!startDate) {
      throw buildHrError(ERROR_CODES.VALIDATION_ERROR, 'startDate is required', HTTP_STATUS.BAD_REQUEST);
    }
    const endDate = parseDateInput(input.endDate, 'endDate');
    const birthDate = parseDateInput(input.birthDate, 'birthDate');
    validateEmployeeLaborDates({
      startDate,
      endDate,
      birthDate
    });

    const managerId = await this.resolveValidatedManagerId({
      tenantId,
      managerId: input.managerId
    });

    try {
      const createdEmployee = await HrEmployeeModel.create({
        tenantId,
        employeeCode: input.employeeCode.trim(),
        normalizedEmployeeCode: normalizeEmployeeCode(input.employeeCode),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        workEmail: input.workEmail ?? null,
        personalEmail: input.personalEmail ?? null,
        phone: input.phone ?? null,
        department: input.department ?? null,
        jobTitle: input.jobTitle ?? null,
        employmentType: input.employmentType,
        status: input.status ?? 'active',
        startDate,
        endDate,
        birthDate,
        managerId,
        isActive: true,
        deletedAt: null
      });

      const view = toEmployeeView(createdEmployee.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'hr.employee.create',
        resource: {
          type: 'hr_employee',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            employeeCode: view.employeeCode,
            employmentType: view.employmentType,
            status: view.status
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildHrError(
          ERROR_CODES.HR_EMPLOYEE_ALREADY_EXISTS,
          'HR employee already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listEmployees(input: ListHrEmployeesInput): Promise<ListHrEmployeesResult> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.status) {
      query.status = input.status;
    }

    if (input.department) {
      query.department = {
        $regex: escapeRegexLiteral(input.department),
        $options: 'i'
      };
    }

    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [
        { employeeCode: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { workEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (input.page - 1) * input.limit;
    const [employees, total] = await Promise.all([
      HrEmployeeModel.find(query).sort({ firstName: 1, lastName: 1 }).skip(skip).limit(input.limit).lean(),
      HrEmployeeModel.countDocuments(query)
    ]);

    return {
      items: employees.map((employee) => toEmployeeView(employee)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getEmployee(input: GetHrEmployeeInput): Promise<HrEmployeeView> {
    const employee = await this.findActiveEmployee(new Types.ObjectId(input.tenantId), input.employeeId);
    if (!employee) {
      throw buildHrError(ERROR_CODES.HR_EMPLOYEE_NOT_FOUND, 'HR employee not found', HTTP_STATUS.NOT_FOUND);
    }

    return toEmployeeView(employee);
  }

  async updateEmployee(input: UpdateHrEmployeeInput): Promise<HrEmployeeView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const employeeId = new Types.ObjectId(input.employeeId);

    if (input.patch.managerId && input.patch.managerId === input.employeeId) {
      throw buildHrError(
        ERROR_CODES.HR_EMPLOYEE_HIERARCHY_CYCLE,
        'HR employee cannot report directly to itself',
        HTTP_STATUS.CONFLICT
      );
    }

    const currentEmployee = await this.findActiveEmployee(tenantId, input.employeeId);

    if (!currentEmployee) {
      throw buildHrError(ERROR_CODES.HR_EMPLOYEE_NOT_FOUND, 'HR employee not found', HTTP_STATUS.NOT_FOUND);
    }

    const startDate = parseDateInput(
      typeof input.patch.startDate !== 'undefined' ? input.patch.startDate : currentEmployee.startDate,
      'startDate',
      { required: true }
    );
    if (!startDate) {
      throw buildHrError(ERROR_CODES.VALIDATION_ERROR, 'startDate is required', HTTP_STATUS.BAD_REQUEST);
    }
    const endDate = parseDateInput(
      typeof input.patch.endDate !== 'undefined' ? input.patch.endDate : currentEmployee.endDate,
      'endDate'
    );
    const birthDate = parseDateInput(
      typeof input.patch.birthDate !== 'undefined' ? input.patch.birthDate : currentEmployee.birthDate,
      'birthDate'
    );

    validateEmployeeLaborDates({
      startDate,
      endDate,
      birthDate
    });

    const managerId =
      typeof input.patch.managerId === 'undefined'
        ? undefined
        : await this.resolveValidatedManagerId({
            tenantId,
            managerId: input.patch.managerId,
            employeeId
          });

    const updateData: Record<string, unknown> = {};
    if (typeof input.patch.employeeCode === 'string') {
      updateData.employeeCode = input.patch.employeeCode.trim();
      updateData.normalizedEmployeeCode = normalizeEmployeeCode(input.patch.employeeCode);
    }
    if (typeof input.patch.firstName === 'string') {
      updateData.firstName = input.patch.firstName.trim();
    }
    if (typeof input.patch.lastName === 'string') {
      updateData.lastName = input.patch.lastName.trim();
    }
    if (typeof input.patch.workEmail !== 'undefined') {
      updateData.workEmail = input.patch.workEmail;
    }
    if (typeof input.patch.personalEmail !== 'undefined') {
      updateData.personalEmail = input.patch.personalEmail;
    }
    if (typeof input.patch.phone !== 'undefined') {
      updateData.phone = input.patch.phone;
    }
    if (typeof input.patch.department !== 'undefined') {
      updateData.department = input.patch.department;
    }
    if (typeof input.patch.jobTitle !== 'undefined') {
      updateData.jobTitle = input.patch.jobTitle;
    }
    if (typeof input.patch.employmentType !== 'undefined') {
      updateData.employmentType = input.patch.employmentType;
    }
    if (typeof input.patch.status !== 'undefined') {
      updateData.status = input.patch.status;
    }
    if (typeof input.patch.startDate !== 'undefined') {
      updateData.startDate = startDate;
    }
    if (typeof input.patch.endDate !== 'undefined') {
      updateData.endDate = endDate;
    }
    if (typeof input.patch.birthDate !== 'undefined') {
      updateData.birthDate = birthDate;
    }
    if (typeof managerId !== 'undefined') {
      updateData.managerId = managerId;
    }

    try {
      const updatedEmployee = await HrEmployeeModel.findOneAndUpdate(
        {
          _id: employeeId,
          tenantId,
          isActive: true
        },
        {
          $set: updateData
        },
        {
          new: true
        }
      );

      if (!updatedEmployee) {
        throw buildHrError(ERROR_CODES.HR_EMPLOYEE_NOT_FOUND, 'HR employee not found', HTTP_STATUS.NOT_FOUND);
      }

      const view = toEmployeeView(updatedEmployee.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'hr.employee.update',
        resource: {
          type: 'hr_employee',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            employeeCode: view.employeeCode,
            status: view.status,
            employmentType: view.employmentType
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildHrError(
          ERROR_CODES.HR_EMPLOYEE_ALREADY_EXISTS,
          'HR employee already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async deleteEmployee(input: DeleteHrEmployeeInput): Promise<HrEmployeeView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const employeeId = new Types.ObjectId(input.employeeId);

    const activeReports = await HrEmployeeModel.countDocuments({
      tenantId,
      managerId: employeeId,
      isActive: true
    });

    if (activeReports > 0) {
      throw buildHrError(
        ERROR_CODES.HR_EMPLOYEE_HIERARCHY_INVALID,
        'HR employee cannot be deleted while active direct reports exist',
        HTTP_STATUS.CONFLICT
      );
    }

    const deletedEmployee = await HrEmployeeModel.findOneAndUpdate(
      {
        _id: employeeId,
        tenantId,
        isActive: true
      },
      {
        $set: {
          isActive: false,
          status: 'inactive',
          deletedAt: new Date()
        }
      },
      {
        new: true
      }
    );

    if (!deletedEmployee) {
      throw buildHrError(ERROR_CODES.HR_EMPLOYEE_NOT_FOUND, 'HR employee not found', HTTP_STATUS.NOT_FOUND);
    }

    await HrCompensationModel.updateMany(
      {
        tenantId,
        employeeId,
        isActive: true
      },
      {
        $set: {
          isActive: false
        }
      }
    );

    const view = toEmployeeView(deletedEmployee.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'hr.employee.delete',
      resource: {
        type: 'hr_employee',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive', 'deletedAt']
      }
    });

    return view;
  }

  async getCompensation(input: GetHrCompensationInput): Promise<HrCompensationView> {
    await this.assertEmployeeExists(new Types.ObjectId(input.tenantId), input.employeeId);

    const compensation = await HrCompensationModel.findOne({
      tenantId: new Types.ObjectId(input.tenantId),
      employeeId: new Types.ObjectId(input.employeeId),
      isActive: true
    }).lean();

    if (!compensation) {
      throw buildHrError(
        ERROR_CODES.HR_COMPENSATION_NOT_FOUND,
        'HR compensation not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toCompensationView(compensation);
  }

  async updateCompensation(input: UpdateHrCompensationInput): Promise<HrCompensationView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const employeeId = new Types.ObjectId(input.employeeId);

    if (typeof input.patch.salaryAmount === 'number' && input.patch.salaryAmount < 0) {
      throw buildHrError(
        ERROR_CODES.HR_COMPENSATION_INVALID,
        'HR compensation salaryAmount must be greater than or equal to zero',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await this.assertEmployeeExists(tenantId, input.employeeId);

    const existingCompensation = await HrCompensationModel.findOne({
      tenantId,
      employeeId,
      isActive: true
    });

    const salaryAmount = input.patch.salaryAmount ?? existingCompensation?.salaryAmount;
    const currency = (input.patch.currency ?? existingCompensation?.currency)?.trim().toUpperCase();
    const payFrequency = input.patch.payFrequency ?? existingCompensation?.payFrequency;
    const effectiveFrom = parseDateInput(
      input.patch.effectiveFrom ?? existingCompensation?.effectiveFrom ?? null,
      'effectiveFrom',
      {
        required: true
      }
    );

    if (typeof salaryAmount !== 'number' || !currency || !payFrequency || !effectiveFrom) {
      throw buildHrError(
        ERROR_CODES.HR_COMPENSATION_INVALID,
        'HR compensation requires salaryAmount, currency, payFrequency and effectiveFrom',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const notes =
      typeof input.patch.notes !== 'undefined' ? input.patch.notes : (existingCompensation?.notes ?? null);

    const updatedCompensation = await HrCompensationModel.findOneAndUpdate(
      {
        tenantId,
        employeeId,
        isActive: true
      },
      {
        $set: {
          salaryAmount,
          currency,
          payFrequency,
          effectiveFrom,
          notes,
          isActive: true
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    if (!updatedCompensation) {
      throw buildHrError(
        ERROR_CODES.INTERNAL_ERROR,
        'HR compensation could not be updated',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const view = toCompensationView(updatedCompensation.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'hr.compensation.update',
      resource: {
        type: 'hr_compensation',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          currency: view.currency,
          payFrequency: view.payFrequency,
          effectiveFrom: view.effectiveFrom
        },
        fields: Object.keys(input.patch)
      },
      metadata: {
        employeeId: input.employeeId,
        containsCompensationChange: true
      }
    });

    return view;
  }

  private async assertEmployeeExists(tenantId: Types.ObjectId, employeeId: string): Promise<void> {
    const employee = await this.findActiveEmployee(tenantId, employeeId);
    if (!employee) {
      throw buildHrError(ERROR_CODES.HR_EMPLOYEE_NOT_FOUND, 'HR employee not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  private async findActiveEmployee(
    tenantId: Types.ObjectId,
    employeeId: string
  ): Promise<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    employeeCode: string;
    firstName: string;
    lastName: string;
    workEmail?: string | null;
    personalEmail?: string | null;
    phone?: string | null;
    department?: string | null;
    jobTitle?: string | null;
    employmentType: string;
    status: string;
    startDate: Date;
    endDate?: Date | null;
    birthDate?: Date | null;
    managerId?: Types.ObjectId | null;
    isActive: boolean;
    deletedAt?: Date | null;
  } | null> {
    return HrEmployeeModel.findOne({
      _id: new Types.ObjectId(employeeId),
      tenantId,
      isActive: true
    }).lean();
  }

  private async resolveValidatedManagerId(input: {
    tenantId: Types.ObjectId;
    managerId?: string | null;
    employeeId?: Types.ObjectId;
  }): Promise<Types.ObjectId | null | undefined> {
    if (typeof input.managerId === 'undefined') {
      return undefined;
    }

    if (input.managerId === null) {
      return null;
    }

    const managerObjectId = new Types.ObjectId(input.managerId);
    if (input.employeeId && managerObjectId.equals(input.employeeId)) {
      throw buildHrError(
        ERROR_CODES.HR_EMPLOYEE_HIERARCHY_CYCLE,
        'HR employee cannot report directly to itself',
        HTTP_STATUS.CONFLICT
      );
    }

    const manager = await HrEmployeeModel.findOne({
      _id: managerObjectId,
      tenantId: input.tenantId,
      isActive: true
    }).lean();

    if (!manager) {
      throw buildHrError(
        ERROR_CODES.HR_EMPLOYEE_HIERARCHY_INVALID,
        'HR manager reference is invalid',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (input.employeeId) {
      await this.assertManagerChainHasNoCycles(input.tenantId, managerObjectId, input.employeeId);
    }

    return managerObjectId;
  }

  private async assertManagerChainHasNoCycles(
    tenantId: Types.ObjectId,
    managerId: Types.ObjectId,
    employeeId: Types.ObjectId
  ): Promise<void> {
    const visited = new Set<string>();
    let currentManagerId: Types.ObjectId | null = managerId;

    while (currentManagerId) {
      const currentId = currentManagerId.toString();
      if (currentId === employeeId.toString()) {
        throw buildHrError(
          ERROR_CODES.HR_EMPLOYEE_HIERARCHY_CYCLE,
          'HR hierarchy cycle detected',
          HTTP_STATUS.CONFLICT
        );
      }

      if (visited.has(currentId)) {
        throw buildHrError(
          ERROR_CODES.HR_EMPLOYEE_HIERARCHY_CYCLE,
          'HR hierarchy cycle detected',
          HTTP_STATUS.CONFLICT
        );
      }
      visited.add(currentId);

      const currentManager: {
        managerId?: Types.ObjectId | string | null;
      } | null = await HrEmployeeModel.findOne({
        _id: currentManagerId,
        tenantId,
        isActive: true
      })
        .select({ managerId: 1 })
        .lean();

      if (!currentManager || !currentManager.managerId) {
        return;
      }

      currentManagerId =
        typeof currentManager.managerId === 'string'
          ? new Types.ObjectId(currentManager.managerId)
          : currentManager.managerId;
    }
  }

  private async recordAuditLog(
    input: {
      context?: ExecutionContext;
      tenantId: string;
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: toTenantAuditScope(input.tenantId, input.context),
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const hrService = new HrService();
