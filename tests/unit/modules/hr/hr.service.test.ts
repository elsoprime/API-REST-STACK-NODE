import { Types } from 'mongoose';

import { HrCompensationModel } from '@/modules/hr/models/hr-compensation.model';
import { HrEmployeeModel } from '@/modules/hr/models/hr-employee.model';
import { HrService } from '@/modules/hr/services/hr.service';

describe('HrService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
