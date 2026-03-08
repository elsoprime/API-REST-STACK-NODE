import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { type AuthContext } from '@/core/platform/auth/types/auth.types';
import { createExecutionContext } from '@/core/platform/context/services/execution-context.factory';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type TenantContext } from '@/core/tenant/types/tenant.types';
import {
  type HrEmployeeView,
  type HrServiceContract,
  HR_EMPLOYEE_STATUSES
} from '@/modules/hr/types/hr.types';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getTenantContext(res: Response): TenantContext {
  return (res.locals.tenantContext ?? {}) as TenantContext;
}

function getExecutionContext(res: Response) {
  return createExecutionContext({
    traceId: getTraceId(res),
    auth: res.locals.auth as AuthContext | undefined,
    tenant: res.locals.tenantContext as TenantContext | undefined
  });
}

function canReadHrPersonalData(res: Response): boolean {
  const tenantContext = getTenantContext(res);
  return tenantContext.authorization.permissionKeys.includes('tenant:hr:personal:read');
}

function redactPersonalEmployeeData(employee: HrEmployeeView): HrEmployeeView {
  return {
    ...employee,
    personalEmail: null,
    phone: null,
    birthDate: null
  };
}

function maybeRedactEmployee(employee: HrEmployeeView, shouldRedact: boolean): HrEmployeeView {
  return shouldRedact ? redactPersonalEmployeeData(employee) : employee;
}

export function createHrController(service: HrServiceContract) {
  return {
    createEmployee: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const employee = await service.createEmployee({
          tenantId: tenantContext.tenantId,
          employeeCode: req.body.employeeCode,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          workEmail: req.body.workEmail,
          personalEmail: req.body.personalEmail,
          phone: req.body.phone,
          department: req.body.department,
          jobTitle: req.body.jobTitle,
          employmentType: req.body.employmentType,
          status: req.body.status,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          birthDate: req.body.birthDate,
          managerId: req.body.managerId,
          context: getExecutionContext(res)
        });

        const shouldRedact = !canReadHrPersonalData(res);
        res
          .status(HTTP_STATUS.CREATED)
          .json(buildSuccess({ employee: maybeRedactEmployee(employee, shouldRedact) }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listEmployees: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const parsedStatus = query.status;
        const status =
          typeof parsedStatus === 'string' &&
          HR_EMPLOYEE_STATUSES.includes(parsedStatus as (typeof HR_EMPLOYEE_STATUSES)[number])
            ? (parsedStatus as (typeof HR_EMPLOYEE_STATUSES)[number])
            : undefined;
        const result = await service.listEmployees({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          search: typeof query.search === 'string' ? query.search : undefined,
          status,
          department: typeof query.department === 'string' ? query.department : undefined
        });

        const shouldRedact = !canReadHrPersonalData(res);
        res.status(HTTP_STATUS.OK).json(
          buildPaginatedSuccess(
            {
              items: result.items.map((employee) => maybeRedactEmployee(employee, shouldRedact))
            },
            {
              page: result.page,
              limit: result.limit,
              total: result.total
            },
            getTraceId(res)
          )
        );
      } catch (error) {
        next(error);
      }
    },

    getEmployee: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawEmployeeId = req.params.employeeId;
        const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : rawEmployeeId;
        const employee = await service.getEmployee({
          tenantId: tenantContext.tenantId,
          employeeId
        });

        const shouldRedact = !canReadHrPersonalData(res);
        res
          .status(HTTP_STATUS.OK)
          .json(buildSuccess({ employee: maybeRedactEmployee(employee, shouldRedact) }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateEmployee: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawEmployeeId = req.params.employeeId;
        const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : rawEmployeeId;
        const employee = await service.updateEmployee({
          tenantId: tenantContext.tenantId,
          employeeId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        const shouldRedact = !canReadHrPersonalData(res);
        res
          .status(HTTP_STATUS.OK)
          .json(buildSuccess({ employee: maybeRedactEmployee(employee, shouldRedact) }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    deleteEmployee: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawEmployeeId = req.params.employeeId;
        const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : rawEmployeeId;
        const employee = await service.deleteEmployee({
          tenantId: tenantContext.tenantId,
          employeeId,
          context: getExecutionContext(res)
        });

        const shouldRedact = !canReadHrPersonalData(res);
        res
          .status(HTTP_STATUS.OK)
          .json(buildSuccess({ employee: maybeRedactEmployee(employee, shouldRedact) }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    getCompensation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawEmployeeId = req.params.employeeId;
        const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : rawEmployeeId;
        const compensation = await service.getCompensation({
          tenantId: tenantContext.tenantId,
          employeeId
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ compensation }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    updateCompensation: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const rawEmployeeId = req.params.employeeId;
        const employeeId = Array.isArray(rawEmployeeId) ? rawEmployeeId[0] : rawEmployeeId;
        const compensation = await service.updateCompensation({
          tenantId: tenantContext.tenantId,
          employeeId,
          patch: req.body,
          context: getExecutionContext(res)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess({ compensation }, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    }
  };
}
