import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  twoFactorCode: z.string().trim().length(6).optional(),
  recoveryCode: z.string().trim().min(1).optional()
});

export const refreshHeadlessSchema = z.object({
  refreshToken: z.string().min(1)
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshHeadlessSchema = z.infer<typeof refreshHeadlessSchema>;
