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
