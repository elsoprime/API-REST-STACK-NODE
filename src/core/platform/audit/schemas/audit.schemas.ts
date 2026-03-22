import { z } from 'zod';

import { AUDIT_SEVERITY_VALUES } from '@/core/platform/audit/types/audit.types';

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).optional(),
  resourceType: z.string().trim().min(1).optional(),
  severity: z.enum(AUDIT_SEVERITY_VALUES).optional(),
  actorKind: z.enum(['user', 'system', 'unknown']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

const auditModuleEnum = z.enum(['auth', 'tenant', 'billing', 'inventory', 'crm', 'hr', 'audit', 'expenses']);

function normalizeCsvList(value: unknown): string[] | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  const raw = Array.isArray(value) ? value : [value];

  const tokens = raw
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return tokens.length ? [...new Set(tokens)] : undefined;
}

export const auditMetricsQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    granularity: z.enum(['day', 'week']).default('day'),
    module: z.preprocess(normalizeCsvList, z.array(auditModuleEnum).optional()),
    severity: z.preprocess(normalizeCsvList, z.array(z.enum(AUDIT_SEVERITY_VALUES)).optional()),
    topN: z.coerce.number().int().min(1).max(20).default(5)
  })
  .refine((input) => new Date(input.to).getTime() > new Date(input.from).getTime(), {
    message: 'to must be after from',
    path: ['to']
  });
