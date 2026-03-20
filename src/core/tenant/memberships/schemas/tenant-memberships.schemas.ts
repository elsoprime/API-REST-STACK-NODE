import { z } from 'zod';

import { MEMBERSHIP_STATUS } from '@/constants/tenant';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

export const listTenantMembershipsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(160).optional(),
  roleKey: z.string().trim().min(1).max(120).optional(),
  status: z.enum([MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.SUSPENDED]).optional()
});

export const updateTenantMembershipSchema = z
  .object({
    roleKey: z.string().trim().min(1).max(120).optional(),
    status: z.enum([MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_STATUS.SUSPENDED]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one membership field is required'
  });

export const tenantMembershipIdParamSchema = z.object({
  membershipId: objectIdSchema
});
