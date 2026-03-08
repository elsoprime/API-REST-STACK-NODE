import { z } from 'zod';

const keySchema = z.string().trim().min(1).max(120);
const emailSchema = z.string().trim().email();
const urlSchema = z.string().trim().url();

const brandingSchema = z.object({
  applicationName: z.string().trim().min(1).max(120).optional(),
  supportEmail: z.union([emailSchema, z.null()]).optional(),
  supportUrl: z.union([urlSchema, z.null()]).optional()
});

const localizationSchema = z.object({
  defaultTimezone: z.string().trim().min(1).max(80).optional(),
  defaultCurrency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  defaultLanguage: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional()
});

const securitySchema = z.object({
  allowUserRegistration: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional()
});

const operationsSchema = z.object({
  maintenanceMode: z.boolean().optional()
});

const modulesSchema = z.object({
  disabledModuleKeys: z.array(keySchema).max(100).optional()
});

const featureFlagsSchema = z.object({
  disabledFeatureFlagKeys: z.array(keySchema).max(200).optional()
});

export const updatePlatformSettingsSchema = z
  .object({
    branding: brandingSchema.optional(),
    localization: localizationSchema.optional(),
    security: securitySchema.optional(),
    operations: operationsSchema.optional(),
    modules: modulesSchema.optional(),
    featureFlags: featureFlagsSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one platform settings section is required'
  });
