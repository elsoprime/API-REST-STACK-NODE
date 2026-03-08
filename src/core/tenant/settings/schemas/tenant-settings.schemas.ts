import { z } from 'zod';

const nullableTrimmedString = z.string().trim().min(1).max(160);
const emailSchema = z.string().trim().email();
const urlSchema = z.string().trim().url();

const brandingSchema = z.object({
  displayName: z.union([nullableTrimmedString.max(120), z.null()]).optional(),
  supportEmail: z.union([emailSchema, z.null()]).optional(),
  supportUrl: z.union([urlSchema, z.null()]).optional()
});

const localizationSchema = z.object({
  defaultTimezone: z.union([z.string().trim().min(1).max(80), z.null()]).optional(),
  defaultCurrency: z.union([z.string().trim().regex(/^[A-Z]{3}$/), z.null()]).optional(),
  defaultLanguage: z.union([z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), z.null()]).optional()
});

const contactSchema = z.object({
  primaryEmail: z.union([emailSchema, z.null()]).optional(),
  phone: z.union([z.string().trim().min(1).max(32), z.null()]).optional(),
  websiteUrl: z.union([urlSchema, z.null()]).optional()
});

const billingSchema = z.object({
  billingEmail: z.union([emailSchema, z.null()]).optional(),
  legalName: z.union([nullableTrimmedString, z.null()]).optional(),
  taxId: z.union([z.string().trim().min(1).max(80), z.null()]).optional()
});

export const updateTenantSettingsSchema = z
  .object({
    branding: brandingSchema.optional(),
    localization: localizationSchema.optional(),
    contact: contactSchema.optional(),
    billing: billingSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one tenant settings section is required'
  });
