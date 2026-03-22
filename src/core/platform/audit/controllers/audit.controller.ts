import { type NextFunction, type Request, type Response } from 'express';

import { HTTP_STATUS } from '@/constants/http';
import { buildPaginatedSuccess, buildSuccess } from '@/core/shared/utils/build-success.util';
import { type AuditModuleKey } from '@/core/platform/audit/types/audit-query.types';
import { type AuditServiceContract, type AuditSeverity } from '@/core/platform/audit/types/audit.types';
import { type TenantContext } from '@/core/tenant/types/tenant.types';

function getTraceId(res: Response): string {
  return typeof res.locals.traceId === 'string' ? res.locals.traceId : 'unknown';
}

function getTenantContext(res: Response): TenantContext {
  return (res.locals.tenantContext ?? {}) as TenantContext;
}

export function createAuditController(service: AuditServiceContract) {
  return {
    listAuditLogs: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.list({
          tenantId: tenantContext.tenantId,
          page: Number(query.page),
          limit: Number(query.limit),
          action: typeof query.action === 'string' ? query.action : undefined,
          resourceType: typeof query.resourceType === 'string' ? query.resourceType : undefined,
          severity: typeof query.severity === 'string' ? (query.severity as never) : undefined,
          actorKind: typeof query.actorKind === 'string' ? (query.actorKind as never) : undefined,
          from: typeof query.from === 'string' ? query.from : undefined,
          to: typeof query.to === 'string' ? query.to : undefined
        });

        res.status(HTTP_STATUS.OK).json(
          buildPaginatedSuccess(
            {
              items: result.items
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

    getTenantAuditMetrics: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const tenantContext = getTenantContext(res);
        const query = req.query as Record<string, string | string[] | number | undefined>;

        const normalizeList = (value: string | string[] | undefined): string[] | undefined => {
          if (typeof value === 'undefined') {
            return undefined;
          }

          const source = Array.isArray(value) ? value : [value];
          const parsed = source
            .flatMap((entry) => entry.split(','))
            .map((entry) => entry.trim())
            .filter(Boolean);

          return parsed.length ? [...new Set(parsed)] : undefined;
        };

        const result = await service.getTenantMetrics({
          tenantId: tenantContext.tenantId,
          from: String(query.from),
          to: String(query.to),
          granularity: (query.granularity as 'day' | 'week') ?? 'day',
          modules: normalizeList(query.module as string | string[] | undefined) as AuditModuleKey[] | undefined,
          severities: normalizeList(query.severity as string | string[] | undefined) as AuditSeverity[] | undefined,
          topN: Number(query.topN)
        });

        res.status(HTTP_STATUS.OK).json(buildSuccess(result, getTraceId(res)));
      } catch (error) {
        next(error);
      }
    },

    listPlatformAuditLogs: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const query = req.query as Record<string, string | number | undefined>;
        const result = await service.listPlatform({
          page: Number(query.page),
          limit: Number(query.limit),
          action: typeof query.action === 'string' ? query.action : undefined,
          resourceType: typeof query.resourceType === 'string' ? query.resourceType : undefined,
          severity: typeof query.severity === 'string' ? (query.severity as never) : undefined,
          actorKind: typeof query.actorKind === 'string' ? (query.actorKind as never) : undefined,
          from: typeof query.from === 'string' ? query.from : undefined,
          to: typeof query.to === 'string' ? query.to : undefined
        });

        res.status(HTTP_STATUS.OK).json(
          buildPaginatedSuccess(
            {
              items: result.items
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
    }
  };
}

