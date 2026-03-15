import { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { HrCompensationModel } from '@/modules/hr/models/hr-compensation.model';
import { HrEmployeeModel } from '@/modules/hr/models/hr-employee.model';
import { HrService } from '@/modules/hr/services/hr.service';

describe('HrService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails closed when tenant execution context does not match requested tenant', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const requestedTenantId = new Types.ObjectId().toString();
    const mismatchedTenantId = new Types.ObjectId().toString();
    const createEmployeeSpy = vi.spyOn(HrEmployeeModel, 'create');
    const updateCompensationSpy = vi.spyOn(HrCompensationModel, 'findOneAndUpdate');
    const findEmployeeSpy = vi.spyOn(HrEmployeeModel, 'findOne');

    await expect(
      service.createEmployee({
        tenantId: requestedTenantId,
        employeeCode: 'HR-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        employmentType: 'full_time',
        startDate: '2026-03-01T00:00:00.000Z',
        context: {
          traceId: 'trace-hr-tenant-mismatch-create',
          actor: {
            kind: 'user',
            userId: new Types.ObjectId().toString(),
            sessionId: new Types.ObjectId().toString(),
            scope: ['platform:self']
          },
          tenant: {
            tenantId: mismatchedTenantId
          }
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.updateCompensation({
        tenantId: requestedTenantId,
        employeeId: new Types.ObjectId().toString(),
        patch: {
          salaryAmount: 100000,
          currency: 'USD',
          payFrequency: 'monthly',
          effectiveFrom: '2026-03-01T00:00:00.000Z'
        },
        context: {
          traceId: 'trace-hr-tenant-mismatch-compensation',
          actor: {
            kind: 'user',
            userId: new Types.ObjectId().toString(),
            sessionId: new Types.ObjectId().toString(),
            scope: ['platform:self']
          },
          tenant: {
            tenantId: mismatchedTenantId
          }
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    expect(createEmployeeSpy).not.toHaveBeenCalled();
    expect(updateCompensationSpy).not.toHaveBeenCalled();
    expect(findEmployeeSpy).not.toHaveBeenCalled();
  });

  it('maps duplicate employee creation to a stable conflict code', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);

    vi.spyOn(HrEmployeeModel, 'create').mockRejectedValue({
      code: 11000
    });

    await expect(
      service.createEmployee({
        tenantId: new Types.ObjectId().toString(),
        employeeCode: 'HR-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@example.com',
        jobTitle: 'Engineer',
        department: 'R&D',
        managerId: null,
        employmentType: 'full_time',
        startDate: '2026-03-01T00:00:00.000Z'
      })
    ).rejects.toMatchObject({
      code: 'HR_EMPLOYEE_ALREADY_EXISTS',
      statusCode: 409
    });
  });

  it('rejects hierarchy cycles with a stable code', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();

    await expect(
      service.updateEmployee({
        tenantId: tenantId.toString(),
        employeeId: employeeId.toString(),
        patch: {
          managerId: employeeId.toString()
        }
      })
    ).rejects.toMatchObject({
      code: 'HR_EMPLOYEE_HIERARCHY_CYCLE'
    });
  });

  it('rejects invalid hierarchy assignments when manager is not found', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    const missingManagerId = new Types.ObjectId();

    vi.spyOn(HrEmployeeModel, 'findOne')
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: employeeId,
          tenantId,
          employeeCode: 'HR-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          employmentType: 'full_time',
          status: 'active',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          managerId: null,
          isActive: true
        })
      } as never)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue(null)
      } as never);

    await expect(
      service.updateEmployee({
        tenantId: tenantId.toString(),
        employeeId: employeeId.toString(),
        patch: {
          managerId: missingManagerId.toString()
        }
      })
    ).rejects.toMatchObject({
      code: 'HR_EMPLOYEE_HIERARCHY_INVALID'
    });
  });

  it('rejects compensation updates when salary is negative', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);

    await expect(
      service.updateCompensation({
        tenantId: new Types.ObjectId().toString(),
        employeeId: new Types.ObjectId().toString(),
        patch: {
          salaryAmount: -1
        }
      })
    ).rejects.toMatchObject({
      code: 'HR_COMPENSATION_INVALID'
    });
  });

  it('rejects compensation lookups when no compensation record exists', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const tenantId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();

    vi.spyOn(HrEmployeeModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: employeeId,
        tenantId,
        employeeCode: 'HR-001',
        firstName: 'Ada',
        lastName: 'Lovelace',
        employmentType: 'full_time',
        status: 'active',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        isActive: true
      })
    } as never);
    vi.spyOn(HrCompensationModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);

    await expect(
      service.getCompensation({
        tenantId: tenantId.toString(),
        employeeId: employeeId.toString()
      })
    ).rejects.toMatchObject({
      code: 'HR_COMPENSATION_NOT_FOUND'
    });
  });
  it('rejects invalid ObjectId values with validation error before touching persistence', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const findEmployeeSpy = vi.spyOn(HrEmployeeModel, 'findOne');

    await expect(
      service.getEmployee({
        tenantId: 'invalid-tenant-id',
        employeeId: new Types.ObjectId().toString()
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    await expect(
      service.updateCompensation({
        tenantId: new Types.ObjectId().toString(),
        employeeId: 'invalid-employee-id',
        patch: {
          salaryAmount: 100000
        }
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    expect(findEmployeeSpy).not.toHaveBeenCalled();
  });

  it('rejects required text fields when they become empty after trimming', async () => {
    const service = new HrService({
      record: vi.fn()
    } as never);
    const createEmployeeSpy = vi.spyOn(HrEmployeeModel, 'create');

    await expect(
      service.createEmployee({
        tenantId: new Types.ObjectId().toString(),
        employeeCode: '   ',
        firstName: 'Ada',
        lastName: 'Lovelace',
        employmentType: 'full_time',
        startDate: '2026-03-01T00:00:00.000Z'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: HTTP_STATUS.BAD_REQUEST
    });

    expect(createEmployeeSpy).not.toHaveBeenCalled();
  });
});

