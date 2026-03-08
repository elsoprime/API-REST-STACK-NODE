import { type AuthScope, AUTH_SCOPES } from '@/constants/security';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export type MongoObjectIdString = string;

export interface AuthenticatedUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  status: 'active' | 'pending_verification';
  isEmailVerified: boolean;
}

export interface AuthSessionView {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface AccessTokenClaims {
  sub: MongoObjectIdString;
  sid: MongoObjectIdString;
  scope: AuthScope[];
  tenantId?: MongoObjectIdString;
  membershipId?: MongoObjectIdString;
  tokenType: 'access';
}

export interface RefreshTokenClaims {
  sub: MongoObjectIdString;
  sid: MongoObjectIdString;
  tokenType: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface AuthContext {
  userId: MongoObjectIdString;
  sessionId: MongoObjectIdString;
  scope: AuthScope[];
  tenantId?: MongoObjectIdString;
  membershipId?: MongoObjectIdString;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  context?: ExecutionContext;
}

export interface LoginInput {
  email: string;
  password: string;
  twoFactorCode?: string;
  recoveryCode?: string;
  userAgent?: string;
  ipAddress?: string;
  context?: ExecutionContext;
}

export interface RefreshBrowserInput {
  refreshToken: string;
  context?: ExecutionContext;
}

export interface RefreshHeadlessInput {
  refreshToken: string;
  context?: ExecutionContext;
}

export interface LogoutInput {
  sessionId: string;
  context?: ExecutionContext;
}

export interface LogoutAllInput {
  userId: string;
  context?: ExecutionContext;
}

export interface VerifyEmailInput {
  email: string;
  token: string;
  context?: ExecutionContext;
}

export interface SetupTwoFactorInput {
  userId: string;
  context?: ExecutionContext;
}

export interface ConfirmTwoFactorInput {
  userId: string;
  code: string;
  context?: ExecutionContext;
}

export interface TwoFactorChallengeInput {
  userId: string;
  code?: string;
  recoveryCode?: string;
  context?: ExecutionContext;
}

export interface RegisterResult {
  user: AuthenticatedUserView;
  verification: {
    required: true;
    expiresAt: string;
  };
}

export interface AuthResult {
  user: AuthenticatedUserView;
  session: AuthSessionView;
  tokens: AuthTokens;
}

export interface LogoutResult {
  revokedSessionIds: string[];
}

export interface VerifyEmailResult {
  user: AuthenticatedUserView;
}

export interface SetupTwoFactorResult {
  pending: true;
}

export interface ConfirmTwoFactorResult {
  enabled: true;
}

export interface DisableTwoFactorResult {
  disabled: true;
}

export interface RegenerateRecoveryCodesResult {
  regenerated: true;
}

export interface AuthServiceContract {
  register: (input: RegisterInput) => Promise<RegisterResult>;
  login: (input: LoginInput) => Promise<AuthResult>;
  refresh: (input: RefreshBrowserInput | RefreshHeadlessInput) => Promise<AuthResult>;
  logout: (input: LogoutInput) => Promise<LogoutResult>;
  logoutAll: (input: LogoutAllInput) => Promise<LogoutResult>;
  verifyEmail: (input: VerifyEmailInput) => Promise<VerifyEmailResult>;
  setupTwoFactor: (input: SetupTwoFactorInput) => Promise<SetupTwoFactorResult>;
  confirmTwoFactor: (input: ConfirmTwoFactorInput) => Promise<ConfirmTwoFactorResult>;
  disableTwoFactor: (input: TwoFactorChallengeInput) => Promise<DisableTwoFactorResult>;
  regenerateRecoveryCodes: (input: TwoFactorChallengeInput) => Promise<RegenerateRecoveryCodesResult>;
}

export const DEFAULT_AUTH_SCOPE = [AUTH_SCOPES.PLATFORM_SELF] as const satisfies readonly AuthScope[];
