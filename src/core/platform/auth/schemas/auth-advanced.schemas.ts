import { z } from 'zod';

const optionalChallengeCodeSchema = z
  .object({
    code: z.string().trim().length(6).optional(),
    recoveryCode: z.string().trim().min(1).optional()
  })
  .refine((value) => Boolean(value.code || value.recoveryCode), {
    message: 'Either code or recoveryCode is required',
    path: ['code']
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(1)
});

export const setupTwoFactorSchema = z.object({});

export const confirmTwoFactorSchema = z.object({
  code: z.string().trim().length(6)
});

export const disableTwoFactorSchema = optionalChallengeCodeSchema;
export const regenerateRecoveryCodesSchema = optionalChallengeCodeSchema;

export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
export type ConfirmTwoFactorSchema = z.infer<typeof confirmTwoFactorSchema>;
export type DisableTwoFactorSchema = z.infer<typeof disableTwoFactorSchema>;
