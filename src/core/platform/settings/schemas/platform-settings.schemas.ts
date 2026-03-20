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

const passwordPolicySchema = z.object({
  minLength: z.number().int().min(8).max(128).optional(),
  preventReuseCount: z.number().int().min(0).max(24).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireSpecialChar: z.boolean().optional()
});

const sessionPolicySchema = z.object({
  browserSessionTtlMinutes: z.number().int().min(5).max(43200).optional(),
  idleTimeoutMinutes: z.union([z.number().int().min(1).max(43200), z.null()]).optional()
});

const riskControlsSchema = z.object({
  allowRecoveryCodes: z.boolean().optional(),
  enforceVerifiedEmailForPrivilegedAccess: z.boolean().optional()
});

const securitySchema = z.object({
  allowUserRegistration: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  requireTwoFactorForPrivilegedUsers: z.boolean().optional(),
  passwordPolicy: passwordPolicySchema.optional(),
  sessionPolicy: sessionPolicySchema.optional(),
  riskControls: riskControlsSchema.optional()
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
