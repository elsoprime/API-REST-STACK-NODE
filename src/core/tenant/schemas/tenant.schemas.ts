import { z } from 'zod';

import { TENANT_ROLE_VALUES } from '@/constants/tenant';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
});

export const switchActiveTenantSchema = z.object({
  tenantId: objectIdSchema
});

export const createInvitationSchema = z.object({
  email: z.string().trim().email(),
  roleKey: z.enum(TENANT_ROLE_VALUES).optional()
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1)
});

export const revokeInvitationSchema = z.object({
  invitationId: objectIdSchema
});

export const transferOwnershipSchema = z.object({
  targetUserId: objectIdSchema
});
