import { z } from 'zod';

import { CRM_OPPORTUNITY_STAGES } from '@/modules/crm/types/crm.types';

const objectIdSchema = z.string().trim().regex(/^[a-f0-9]{24}$/i, 'Invalid ObjectId');
const nullableEmailSchema = z.union([z.string().trim().email(), z.null()]);
const nullablePhoneSchema = z.union([z.string().trim().min(1).max(40), z.null()]);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(160).optional()
});

export const createCrmContactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: nullableEmailSchema.optional(),
  phone: nullablePhoneSchema.optional(),
  organizationId: z.union([objectIdSchema, z.null()]).optional()
});

export const updateCrmContactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    email: nullableEmailSchema.optional(),
    phone: nullablePhoneSchema.optional(),
    organizationId: z.union([objectIdSchema, z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one contact field is required'
  });

export const listCrmContactsQuerySchema = paginationQuerySchema.extend({
  organizationId: objectIdSchema.optional()
});

export const createCrmOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(180),
  domain: z.union([z.string().trim().min(1).max(200), z.null()]).optional(),
  industry: z.union([z.string().trim().min(1).max(120), z.null()]).optional()
});

export const updateCrmOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(180).optional(),
    domain: z.union([z.string().trim().min(1).max(200), z.null()]).optional(),
    industry: z.union([z.string().trim().min(1).max(120), z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one organization field is required'
  });

export const listCrmOrganizationsQuerySchema = paginationQuerySchema;

export const createCrmOpportunitySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.union([z.string().trim().min(1).max(1000), z.null()]).optional(),
  amount: z.union([z.coerce.number().min(0), z.null()]).optional(),
  currency: z.union([z.string().trim().regex(/^[A-Z]{3}$/), z.null()]).optional(),
  contactId: z.union([objectIdSchema, z.null()]).optional(),
  organizationId: z.union([objectIdSchema, z.null()]).optional(),
  expectedCloseDate: z.union([z.string().datetime(), z.null()]).optional()
});

export const updateCrmOpportunitySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.union([z.string().trim().min(1).max(1000), z.null()]).optional(),
    amount: z.union([z.coerce.number().min(0), z.null()]).optional(),
    currency: z.union([z.string().trim().regex(/^[A-Z]{3}$/), z.null()]).optional(),
    contactId: z.union([objectIdSchema, z.null()]).optional(),
    organizationId: z.union([objectIdSchema, z.null()]).optional(),
    expectedCloseDate: z.union([z.string().datetime(), z.null()]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one opportunity field is required'
  });

export const changeCrmOpportunityStageSchema = z.object({
  stage: z.enum(CRM_OPPORTUNITY_STAGES)
});

export const listCrmOpportunitiesQuerySchema = paginationQuerySchema.extend({
  stage: z.enum(CRM_OPPORTUNITY_STAGES).optional(),
  contactId: objectIdSchema.optional(),
  organizationId: objectIdSchema.optional()
});

export const createCrmActivitySchema = z
  .object({
    type: z.string().trim().min(1).max(100),
    note: z.string().trim().min(1).max(1200),
    contactId: z.union([objectIdSchema, z.null()]).optional(),
    organizationId: z.union([objectIdSchema, z.null()]).optional(),
    opportunityId: z.union([objectIdSchema, z.null()]).optional(),
    occurredAt: z.string().datetime().optional()
  })
  .refine(
    (value) =>
      Boolean(value.contactId) || Boolean(value.organizationId) || Boolean(value.opportunityId),
    {
      message: 'At least one CRM reference is required'
    }
  );

export const listCrmActivitiesQuerySchema = paginationQuerySchema.extend({
  contactId: objectIdSchema.optional(),
  organizationId: objectIdSchema.optional(),
  opportunityId: objectIdSchema.optional()
});

export const crmContactParamsSchema = z.object({
  contactId: objectIdSchema
});

export const crmOrganizationParamsSchema = z.object({
  organizationId: objectIdSchema
});

export const crmOpportunityParamsSchema = z.object({
  opportunityId: objectIdSchema
});
