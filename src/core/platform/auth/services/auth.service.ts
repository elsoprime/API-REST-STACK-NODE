import { randomBytes } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http';
import { AUTH_SECURITY_POLICY, AUTH_SESSION_STATUS, type AuthScope } from '@/constants/security';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type RecordAuditLogOptions,
  type AuditResource,
  type AuditSeverity
} from '@/core/platform/audit/types/audit.types';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import {
  type EmailVerificationDeliveryPort
} from '@/core/platform/auth/ports/email-verification-delivery.port';
import {
  type PasswordResetDeliveryPort
} from '@/core/platform/auth/ports/password-reset-delivery.port';
import {
  type TwoFactorProvisioningPort
} from '@/core/platform/auth/ports/two-factor-provisioning.port';
import { passwordService, type PasswordService } from '@/core/platform/auth/services/password.service';
import { tokenService, type TokenService } from '@/core/platform/auth/services/token.service';
import {
  platformScopeGrantService,
  type PlatformScopeGrantServiceContract
} from '@/core/platform/auth/services/platform-scope-grant.service';
import {
  twoFactorService,
  type TwoFactorService
} from '@/core/platform/auth/services/two-factor.service';
import {
  DEFAULT_AUTH_SCOPE,
  type AuthResult,
  type AuthServiceContract,
  type AuthenticatedUserView,
  type ConfirmTwoFactorInput,
  type ConfirmTwoFactorResult,
  type DisableTwoFactorResult,
  type EmailVerificationDispatchResult,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type PasswordResetResult,
  type ChangePasswordInput,
  type ChangePasswordResult,
  type LoginInput,
  type LogoutInput,
  type LogoutAllInput,
  type LogoutResult,
  type RegenerateRecoveryCodesResult,
  type RefreshBrowserInput,
  type RefreshHeadlessInput,
  type RegisterInput,
  type ResendVerificationInput,
  type SetupTwoFactorInput,
  type SetupTwoFactorResult,
  type TwoFactorChallengeInput,
  type VerifyEmailInput,
  type VerifyEmailResult
} from '@/core/platform/auth/types/auth.types';
import { UserModel } from '@/core/platform/users/models/user.model';
import {
  UserSecurityModel,
  type UserSecurityDocument
} from '@/core/platform/users/models/user-security.model';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES, type ErrorCode } from '@/infrastructure/errors/error-codes';
import { authDeliveryRegistry } from '@/infrastructure/security/auth-delivery.registry';

function ensureObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function toIsoDateString(value: Date): string {
  return value.toISOString();
}

function toMilliseconds(tokenDuration: string): number {
  const match = tokenDuration.match(/^(\d+)([smhd])$/);

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const multipliers = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  } as const;
  const unit = match[2] as keyof typeof multipliers;

  return amount * multipliers[unit];
}

function buildAuthError(code: ErrorCode, message: string, statusCode: number): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function generateOpaqueToken(): string {
  return randomBytes(24).toString('base64url');
}

function buildEmailVerificationDispatchResult(): EmailVerificationDispatchResult {
  return {
    accepted: true
  };
}

function hasEmailVerificationCooldown(
  securityRecord: Pick<UserSecurityDocument, 'emailVerificationLastSentAt'>
): boolean {
  return Boolean(
    securityRecord.emailVerificationLastSentAt &&
      securityRecord.emailVerificationLastSentAt.getTime() +
        AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS >
        Date.now()
  );
}

function isAccountLocked(securityRecord: Pick<UserSecurityDocument, 'lockoutUntil'>): boolean {
  return Boolean(securityRecord.lockoutUntil && securityRecord.lockoutUntil.getTime() > Date.now());
}

function resolveTwoFactorCode(
  input: Pick<LoginInput, 'twoFactorCode' | 'recoveryCode'> | TwoFactorChallengeInput
): string | undefined {
  const candidate = input as {
    code?: string;
    twoFactorCode?: string;
  };

  return candidate.code ?? candidate.twoFactorCode;
}

function toUserView(
  user: {
    id?: string;
    _id?: Types.ObjectId;
    email: string;
    firstName: string;
    lastName?: string | null;
    status: 'active' | 'pending_verification';
  },
  isEmailVerified: boolean
): AuthenticatedUserView {
  const id = user.id ?? user._id?.toString() ?? '';

  return {
    id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? null,
    status: user.status,
    isEmailVerified
  };
}

export class AuthService implements AuthServiceContract {
  private readonly refreshInFlightByTokenHash = new Map<string, Promise<AuthResult>>();
  private readonly refreshReplayCacheByTokenHash = new Map<string, {
    result: AuthResult;
    expiresAt: number;
  }>();

  constructor(
    private readonly tokens: TokenService = tokenService,
    private readonly passwords: PasswordService = passwordService,
    private readonly twoFactor: TwoFactorService = twoFactorService,
    private readonly emailVerificationDelivery: EmailVerificationDeliveryPort =
      authDeliveryRegistry.emailVerificationDeliveryPort,
    private readonly twoFactorProvisioning: TwoFactorProvisioningPort =
      authDeliveryRegistry.twoFactorProvisioningPort,
    private readonly audit: AuditService = auditService,
    private readonly platformScopeGrants: PlatformScopeGrantServiceContract = platformScopeGrantService,
    private readonly passwordResetDelivery: PasswordResetDeliveryPort =
      authDeliveryRegistry.passwordResetDeliveryPort
  ) {}

  async register(input: RegisterInput): Promise<EmailVerificationDispatchResult> {
    const normalizedEmail = input.email.toLowerCase();
    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();

    if (existingUser) {
      return buildEmailVerificationDispatchResult();
    }

    const verificationToken = generateOpaqueToken();
    const verificationExpiresAt = new Date(
      Date.now() + AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_TOKEN_TTL_MS
    );
    const verificationTokenHash = this.tokens.hashToken(verificationToken);
    const session = await mongoose.startSession();

    try {
      let createdUserView: AuthenticatedUserView | null = null;

      await session.withTransaction(async () => {
        const [createdUser] = await UserModel.create(
          [
            {
              email: normalizedEmail,
              firstName: input.firstName,
              lastName: input.lastName ?? null,
              status: 'pending_verification'
            }
          ],
          { session }
        );

        const passwordHash = await this.passwords.hash(input.password);

        await UserSecurityModel.create(
          [
            {
              userId: createdUser._id,
              passwordHash,
              isEmailVerified: false,
              emailVerificationTokenHash: verificationTokenHash,
              emailVerificationExpiresAt: verificationExpiresAt,
              emailVerificationLastSentAt: null
            }
          ],
          { session }
        );

        createdUserView = toUserView(createdUser.toObject(), false);

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.register',
            resource: {
              type: 'user',
              id: createdUser._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                email: createdUser.email,
                status: createdUser.status,
                isEmailVerified: false
              }
            }
          },
          { session }
        );
      });

      if (!createdUserView) {
        throw new Error('User registration transaction did not produce a user.');
      }

      const registeredUser = createdUserView as AuthenticatedUserView;

      await this.emailVerificationDelivery.deliver({
        userId: registeredUser.id,
        email: registeredUser.email,
        firstName: registeredUser.firstName,
        token: verificationToken,
        expiresAt: toIsoDateString(verificationExpiresAt)
      });

      await UserSecurityModel.updateOne(
        {
          userId: ensureObjectId(registeredUser.id)
        },
        {
          $set: {
            emailVerificationLastSentAt: new Date()
          }
        }
      );

      return buildEmailVerificationDispatchResult();
    } finally {
      await session.endSession();
    }
  }

  async resendVerification(
    input: ResendVerificationInput
  ): Promise<EmailVerificationDispatchResult> {
    const normalizedEmail = input.email.toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return buildEmailVerificationDispatchResult();
    }

    const securityRecord = await UserSecurityModel.findOne({ userId: user._id });

    if (
      !securityRecord ||
      user.status !== 'pending_verification' ||
      securityRecord.isEmailVerified ||
      hasEmailVerificationCooldown(securityRecord)
    ) {
      return buildEmailVerificationDispatchResult();
    }

    const previousTokenHash = securityRecord.emailVerificationTokenHash;
    const previousExpiresAt = securityRecord.emailVerificationExpiresAt;
    const previousLastSentAt = securityRecord.emailVerificationLastSentAt;
    const verificationToken = generateOpaqueToken();
    const verificationExpiresAt = new Date(
      Date.now() + AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_TOKEN_TTL_MS
    );

    securityRecord.emailVerificationTokenHash = this.tokens.hashToken(verificationToken);
    securityRecord.emailVerificationExpiresAt = verificationExpiresAt;
    await securityRecord.save();

    try {
      await this.emailVerificationDelivery.deliver({
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        token: verificationToken,
        expiresAt: toIsoDateString(verificationExpiresAt)
      });
    } catch (error) {
      securityRecord.emailVerificationTokenHash = previousTokenHash;
      securityRecord.emailVerificationExpiresAt = previousExpiresAt;
      securityRecord.emailVerificationLastSentAt = previousLastSentAt;
      await securityRecord.save();

      throw error;
    }

    securityRecord.emailVerificationLastSentAt = new Date();
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.verification_resent',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                email: user.email,
                status: user.status,
                isEmailVerified: false
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return buildEmailVerificationDispatchResult();
  }

  async forgotPassword(
    input: ForgotPasswordInput
  ): Promise<EmailVerificationDispatchResult> {
    const normalizedEmail = input.email.toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return buildEmailVerificationDispatchResult();
    }

    const securityRecord = await UserSecurityModel.findOne({ userId: user._id });

    if (
      !securityRecord ||
      !securityRecord.isEmailVerified ||
      user.status !== 'active'
    ) {
      return buildEmailVerificationDispatchResult();
    }

    const previousTokenHash = securityRecord.passwordResetTokenHash;
    const previousExpiresAt = securityRecord.passwordResetExpiresAt;
    const resetToken = generateOpaqueToken();
    const resetExpiresAt = new Date(
      Date.now() + AUTH_SECURITY_POLICY.PASSWORD_RESET_TOKEN_TTL_MS
    );

    securityRecord.passwordResetTokenHash = this.tokens.hashToken(resetToken);
    securityRecord.passwordResetExpiresAt = resetExpiresAt;
    await securityRecord.save();

    try {
      await this.passwordResetDelivery.deliver({
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        token: resetToken,
        expiresAt: toIsoDateString(resetExpiresAt)
      });
    } catch {
      securityRecord.passwordResetTokenHash = previousTokenHash;
      securityRecord.passwordResetExpiresAt = previousExpiresAt;
      await securityRecord.save();

      return buildEmailVerificationDispatchResult();
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.password_reset.requested',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'warning'
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return buildEmailVerificationDispatchResult();
  }

  async resetPassword(input: ResetPasswordInput): Promise<PasswordResetResult> {
    const normalizedEmail = input.email.toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      throw buildAuthError(
        ERROR_CODES.AUTH_PASSWORD_RESET_INVALID,
        'Invalid password reset token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const securityRecord = await UserSecurityModel.findOne({ userId: user._id });

    if (!securityRecord || !securityRecord.passwordResetExpiresAt || !securityRecord.passwordResetTokenHash) {
      throw buildAuthError(
        ERROR_CODES.AUTH_PASSWORD_RESET_INVALID,
        'Invalid password reset token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const tokenIsValid =
      securityRecord.passwordResetExpiresAt.getTime() > Date.now() &&
      securityRecord.passwordResetTokenHash === this.tokens.hashToken(input.token) &&
      securityRecord.isEmailVerified &&
      user.status === 'active';

    if (!tokenIsValid) {
      throw buildAuthError(
        ERROR_CODES.AUTH_PASSWORD_RESET_INVALID,
        'Invalid password reset token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const nextPasswordHash = await this.passwords.hash(input.newPassword);
    const activeSessions = await AuthSessionModel.find({
      userId: user._id,
      status: AUTH_SESSION_STATUS.ACTIVE
    });
    const revokedSessionIds = activeSessions.map((session) => session._id.toString());
    const transactionSession = await mongoose.startSession();

    try {
      await transactionSession.withTransaction(async () => {
        securityRecord.passwordHash = nextPasswordHash;
        securityRecord.passwordResetTokenHash = null;
        securityRecord.passwordResetExpiresAt = null;
        securityRecord.failedLoginAttempts = 0;
        securityRecord.lockoutUntil = null;
        await securityRecord.save({ session: transactionSession });

        const revokedAt = new Date();

        for (const authSession of activeSessions) {
          authSession.status = AUTH_SESSION_STATUS.REVOKED;
          authSession.revokedAt = revokedAt;
          await authSession.save({ session: transactionSession });
        }

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.password_reset.completed',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'warning',
            changes: {
              after: {
                revokedSessionIds
              }
            }
          },
          { session: transactionSession }
        );
      });
    } finally {
      await transactionSession.endSession();
    }

    return {
      reset: true,
      revokedSessionIds
    };
  }

  async changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
    const securityRecord = await this.loadUserSecurityRecord(input.userId);
    const currentPasswordMatches = await this.passwords.verify(
      input.currentPassword,
      securityRecord.passwordHash
    );

    if (!currentPasswordMatches) {
      throw buildAuthError(
        ERROR_CODES.AUTH_PASSWORD_CHANGE_CURRENT_INVALID,
        'Current password is invalid',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const nextPasswordMatchesCurrent = await this.passwords.verify(
      input.newPassword,
      securityRecord.passwordHash
    );

    if (nextPasswordMatchesCurrent) {
      throw buildAuthError(
        ERROR_CODES.AUTH_PASSWORD_CHANGE_REUSED,
        'New password must be different from the current password',
        HTTP_STATUS.CONFLICT
      );
    }

    const nextPasswordHash = await this.passwords.hash(input.newPassword);
    const activeSessions = await AuthSessionModel.find({
      userId: ensureObjectId(input.userId),
      status: AUTH_SESSION_STATUS.ACTIVE
    });
    const sessionsToRevoke = activeSessions.filter(
      (session) => session._id.toString() !== input.sessionId
    );
    const revokedSessionIds = sessionsToRevoke.map((session) => session._id.toString());
    const transactionSession = await mongoose.startSession();

    try {
      await transactionSession.withTransaction(async () => {
        securityRecord.passwordHash = nextPasswordHash;
        securityRecord.passwordResetTokenHash = null;
        securityRecord.passwordResetExpiresAt = null;
        await securityRecord.save({ session: transactionSession });

        const revokedAt = new Date();

        for (const authSession of sessionsToRevoke) {
          authSession.status = AUTH_SESSION_STATUS.REVOKED;
          authSession.revokedAt = revokedAt;
          await authSession.save({ session: transactionSession });
        }

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.password_change',
            resource: {
              type: 'user',
              id: input.userId
            },
            severity: 'warning',
            changes: {
              after: {
                revokedSessionIds
              }
            }
          },
          { session: transactionSession }
        );
      });
    } finally {
      await transactionSession.endSession();
    }

    return {
      changed: true,
      revokedSessionIds
    };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    const user = await UserModel.findOne({ email: input.email.toLowerCase() });

    if (!user) {
      throw buildAuthError(
        ERROR_CODES.AUTH_EMAIL_VERIFICATION_INVALID,
        'Invalid email verification token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const securityRecord = await UserSecurityModel.findOne({ userId: user._id });

    if (!securityRecord) {
      throw buildAuthError(
        ERROR_CODES.AUTH_EMAIL_VERIFICATION_INVALID,
        'Invalid email verification token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const tokenIsValid =
      securityRecord.emailVerificationTokenHash === this.tokens.hashToken(input.token) &&
      Boolean(
        securityRecord.emailVerificationExpiresAt &&
          securityRecord.emailVerificationExpiresAt.getTime() > Date.now()
      );

    if (!tokenIsValid) {
      throw buildAuthError(
        ERROR_CODES.AUTH_EMAIL_VERIFICATION_INVALID,
        'Invalid email verification token',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    securityRecord.isEmailVerified = true;
    securityRecord.emailVerificationTokenHash = null;
    securityRecord.emailVerificationExpiresAt = null;
    securityRecord.emailVerificationLastSentAt = null;
    user.status = 'active';
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });
        await user.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.verify_email',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'info',
            changes: {
              before: {
                status: 'pending_verification',
                isEmailVerified: false
              },
              after: {
                status: user.status,
                isEmailVerified: true
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      user: toUserView(user.toObject(), true)
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await UserModel.findOne({ email: input.email.toLowerCase() });

    if (!user) {
      throw buildAuthError(
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const securityRecord = await UserSecurityModel.findOne({ userId: user._id });

    if (!securityRecord) {
      throw buildAuthError(
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        'Invalid credentials',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (isAccountLocked(securityRecord)) {
      throw buildAuthError(
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        'Account temporarily locked due to failed login attempts',
        HTTP_STATUS.LOCKED
      );
    }

    const passwordMatches = await this.passwords.verify(input.password, securityRecord.passwordHash);

    if (!passwordMatches) {
      await this.registerFailedLoginAttempt(securityRecord);
      throw buildAuthError(
        isAccountLocked(securityRecord)
          ? ERROR_CODES.AUTH_ACCOUNT_LOCKED
          : ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        isAccountLocked(securityRecord)
          ? 'Account temporarily locked due to failed login attempts'
          : 'Invalid credentials',
        isAccountLocked(securityRecord) ? HTTP_STATUS.LOCKED : HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!securityRecord.isEmailVerified) {
      throw buildAuthError(
        ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED,
        'Email verification required before login',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (securityRecord.twoFactorEnabled) {
      await this.assertValidTwoFactorChallenge(securityRecord, input);
    }

    await this.resetFailedLoginAttempts(securityRecord);
    const session = await mongoose.startSession();

    try {
      let result: AuthResult | null = null;

      await session.withTransaction(async () => {
        result = await this.createSessionResult(
          {
            userId: user._id.toString(),
            user: toUserView(user.toObject(), securityRecord.isEmailVerified),
            scope: this.platformScopeGrants.resolveScopesForEmail(user.email),
            userAgent: input.userAgent,
            ipAddress: input.ipAddress
          },
          session
        );

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.login',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                sessionId: result.session.id
              }
            }
          },
          { session }
        );
      });

      if (!result) {
        throw new Error('Login transaction did not produce an auth result.');
      }

      return result;
    } finally {
      await session.endSession();
    }
  }

  async refresh(input: RefreshBrowserInput | RefreshHeadlessInput): Promise<AuthResult> {
    const refreshTokenHash = this.tokens.hashToken(input.refreshToken);
    this.pruneRefreshReplayCache();

    const cachedResult = this.getCachedRefreshReplay(refreshTokenHash);

    if (cachedResult) {
      return cachedResult;
    }

    const existingInFlightRefresh = this.refreshInFlightByTokenHash.get(refreshTokenHash);

    if (existingInFlightRefresh) {
      return existingInFlightRefresh;
    }

    const inFlightRefresh = this.performRefresh(input, refreshTokenHash).finally(() => {
      this.refreshInFlightByTokenHash.delete(refreshTokenHash);
    });

    this.refreshInFlightByTokenHash.set(refreshTokenHash, inFlightRefresh);

    return inFlightRefresh;
  }

  private async performRefresh(
    input: RefreshBrowserInput | RefreshHeadlessInput,
    refreshTokenHash: string
  ): Promise<AuthResult> {
    let claims;

    try {
      claims = this.tokens.verifyRefreshToken(input.refreshToken);
    } catch {
      throw buildAuthError(
        ERROR_CODES.AUTH_INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const existingSession = await AuthSessionModel.findById(claims.sid);

    if (
      !existingSession ||
      existingSession.status !== AUTH_SESSION_STATUS.ACTIVE ||
      existingSession.refreshTokenHash !== refreshTokenHash ||
      existingSession.expiresAt.getTime() <= Date.now()
    ) {
      throw buildAuthError(
        ERROR_CODES.AUTH_INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const user = await UserModel.findById(claims.sub);
    const securityRecord = await UserSecurityModel.findOne({ userId: ensureObjectId(claims.sub) });

    if (!user || !securityRecord) {
      throw buildAuthError(
        ERROR_CODES.AUTH_INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const session = await mongoose.startSession();

    try {
      let nextSessionResult: AuthResult | null = null;

      await session.withTransaction(async () => {
        nextSessionResult = await this.createSessionResult(
          {
            userId: user._id.toString(),
            user: toUserView(user.toObject(), securityRecord.isEmailVerified),
            scope: this.platformScopeGrants.resolveScopesForEmail(user.email),
            userAgent: existingSession.userAgent ?? undefined,
            ipAddress: existingSession.ipAddress ?? undefined,
            activeTenantId: existingSession.activeTenantId?.toString() ?? undefined,
            activeMembershipId: existingSession.activeMembershipId?.toString() ?? undefined
          },
          session
        );

        existingSession.status = AUTH_SESSION_STATUS.REVOKED;
        existingSession.revokedAt = new Date();
        existingSession.replacedBySessionId = new Types.ObjectId(nextSessionResult.session.id);
        existingSession.lastUsedAt = new Date();
        await existingSession.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.refresh',
            resource: {
              type: 'auth_session',
              id: nextSessionResult.session.id
            },
            severity: 'info',
            changes: {
              before: {
                replacedSessionId: existingSession._id.toString(),
                status: AUTH_SESSION_STATUS.ACTIVE
              },
              after: {
                sessionId: nextSessionResult.session.id,
                replacedSessionId: existingSession._id.toString(),
                status: AUTH_SESSION_STATUS.ACTIVE
              }
            }
          },
          { session }
        );
      });

      if (!nextSessionResult) {
        throw new Error('Refresh transaction did not produce a session result.');
      }

      this.cacheRefreshReplay(refreshTokenHash, nextSessionResult);
      return nextSessionResult;
    } finally {
      await session.endSession();
    }
  }

  private getCachedRefreshReplay(refreshTokenHash: string): AuthResult | null {
    const cachedReplay = this.refreshReplayCacheByTokenHash.get(refreshTokenHash);

    if (!cachedReplay) {
      return null;
    }

    if (cachedReplay.expiresAt <= Date.now()) {
      this.refreshReplayCacheByTokenHash.delete(refreshTokenHash);
      return null;
    }

    return cachedReplay.result;
  }

  private cacheRefreshReplay(refreshTokenHash: string, result: AuthResult): void {
    this.refreshReplayCacheByTokenHash.set(refreshTokenHash, {
      result,
      expiresAt: Date.now() + AUTH_SECURITY_POLICY.REFRESH_REPLAY_WINDOW_MS
    });
  }

  private pruneRefreshReplayCache(): void {
    const now = Date.now();

    for (const [refreshTokenHash, replay] of this.refreshReplayCacheByTokenHash) {
      if (replay.expiresAt <= now) {
        this.refreshReplayCacheByTokenHash.delete(refreshTokenHash);
      }
    }
  }

  async logout(input: LogoutInput): Promise<LogoutResult> {
    const session = await AuthSessionModel.findById(input.sessionId);

    if (!session) {
      return {
        revokedSessionIds: []
      };
    }
    const transactionSession = await mongoose.startSession();

    try {
      await transactionSession.withTransaction(async () => {
        session.status = AUTH_SESSION_STATUS.REVOKED;
        session.revokedAt = new Date();
        await session.save({ session: transactionSession });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.logout',
            resource: {
              type: 'auth_session',
              id: input.sessionId
            },
            severity: 'info',
            changes: {
              before: {
                status: AUTH_SESSION_STATUS.ACTIVE
              },
              after: {
                status: session.status,
                revokedAt: toIsoDateString(session.revokedAt as Date)
              }
            }
          },
          { session: transactionSession }
        );
      });
    } finally {
      await transactionSession.endSession();
    }

    return {
      revokedSessionIds: [input.sessionId]
    };
  }

  async logoutAll(input: LogoutAllInput): Promise<LogoutResult> {
    const activeSessions = await AuthSessionModel.find({
      userId: ensureObjectId(input.userId),
      status: AUTH_SESSION_STATUS.ACTIVE
    });

    const revokedSessionIds = activeSessions.map((session) => session._id.toString());

    if (revokedSessionIds.length === 0) {
      return {
        revokedSessionIds
      };
    }
    const transactionSession = await mongoose.startSession();

    try {
      await transactionSession.withTransaction(async () => {
        const revokedAt = new Date();

        for (const session of activeSessions) {
          session.status = AUTH_SESSION_STATUS.REVOKED;
          session.revokedAt = revokedAt;
          await session.save({ session: transactionSession });
        }

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.logout_all',
            resource: {
              type: 'user',
              id: input.userId
            },
            severity: 'info',
            changes: {
              after: {
                revokedSessionIds
              }
            }
          },
          { session: transactionSession }
        );
      });
    } finally {
      await transactionSession.endSession();
    }

    return {
      revokedSessionIds
    };
  }

  async setupTwoFactor(input: SetupTwoFactorInput): Promise<SetupTwoFactorResult> {
    const user = await UserModel.findById(input.userId);
    const securityRecord = await this.loadUserSecurityRecord(input.userId);

    if (!user) {
      throw buildAuthError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (securityRecord.twoFactorEnabled) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_ALREADY_ENABLED,
        'Two-factor authentication is already enabled',
        HTTP_STATUS.CONFLICT
      );
    }

    const secret = this.twoFactor.generateSecret();
    const otpauthUrl = this.twoFactor.buildOtpAuthUrl(user.email, secret);
    securityRecord.twoFactorPendingSecretEncrypted = this.twoFactor.encryptSecret(secret);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.2fa.setup',
            resource: {
              type: 'user',
              id: user._id.toString()
            },
            severity: 'warning',
            changes: {
              after: {
                twoFactorPending: true
              }
            },
            metadata: {
              otpauthUrl
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    await this.twoFactorProvisioning.deliver({
      userId: user._id.toString(),
      email: user.email,
      secret,
      otpauthUrl
    });

    return {
      pending: true
    };
  }

  async confirmTwoFactor(input: ConfirmTwoFactorInput): Promise<ConfirmTwoFactorResult> {
    const securityRecord = await this.loadUserSecurityRecord(input.userId);

    if (!securityRecord.twoFactorPendingSecretEncrypted) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_NOT_ENABLED,
        'No pending two-factor setup found',
        HTTP_STATUS.CONFLICT
      );
    }

    const secret = this.twoFactor.decryptSecret(securityRecord.twoFactorPendingSecretEncrypted);

    if (!this.twoFactor.verifyCode(secret, input.code)) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_INVALID,
        'Invalid two-factor code',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const recoveryCodes = this.twoFactor.generateRecoveryCodes();

    securityRecord.twoFactorEnabled = true;
    securityRecord.twoFactorSecretEncrypted = this.twoFactor.encryptSecret(secret);
    securityRecord.twoFactorPendingSecretEncrypted = null;
    securityRecord.recoveryCodeHashes = recoveryCodes.map((code) =>
      this.twoFactor.hashRecoveryCode(code)
    );
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.2fa.confirm',
            resource: {
              type: 'user',
              id: input.userId
            },
            severity: 'warning',
            changes: {
              before: {
                twoFactorEnabled: false
              },
              after: {
                twoFactorEnabled: true
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      enabled: true
    };
  }

  async disableTwoFactor(input: TwoFactorChallengeInput): Promise<DisableTwoFactorResult> {
    const securityRecord = await this.loadUserSecurityRecord(input.userId);

    if (!securityRecord.twoFactorEnabled || !securityRecord.twoFactorSecretEncrypted) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_NOT_ENABLED,
        'Two-factor authentication is not enabled',
        HTTP_STATUS.CONFLICT
      );
    }

    await this.assertValidTwoFactorChallenge(securityRecord, input);

    securityRecord.twoFactorEnabled = false;
    securityRecord.twoFactorSecretEncrypted = null;
    securityRecord.twoFactorPendingSecretEncrypted = null;
    securityRecord.recoveryCodeHashes = [];
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.2fa.disable',
            resource: {
              type: 'user',
              id: input.userId
            },
            severity: 'warning',
            changes: {
              before: {
                twoFactorEnabled: true
              },
              after: {
                twoFactorEnabled: false
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      disabled: true
    };
  }

  async regenerateRecoveryCodes(
    input: TwoFactorChallengeInput
  ): Promise<RegenerateRecoveryCodesResult> {
    const securityRecord = await this.loadUserSecurityRecord(input.userId);

    if (!securityRecord.twoFactorEnabled || !securityRecord.twoFactorSecretEncrypted) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_NOT_ENABLED,
        'Two-factor authentication is not enabled',
        HTTP_STATUS.CONFLICT
      );
    }

    await this.assertValidTwoFactorChallenge(securityRecord, input);

    const recoveryCodes = this.twoFactor.generateRecoveryCodes();
    securityRecord.recoveryCodeHashes = recoveryCodes.map((code) =>
      this.twoFactor.hashRecoveryCode(code)
    );
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await securityRecord.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'auth.recovery_codes.regenerate',
            resource: {
              type: 'user',
              id: input.userId
            },
            severity: 'warning',
            changes: {
              after: {
                regenerated: true
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      regenerated: true
    };
  }

  private async createSessionResult(
    input: {
      userId: string;
      user: AuthenticatedUserView;
      scope?: AuthScope[];
      userAgent?: string;
      ipAddress?: string;
      activeTenantId?: string;
      activeMembershipId?: string;
    },
    transactionSession?: mongoose.ClientSession
  ): Promise<AuthResult> {
    const expiresAt = new Date(Date.now() + toMilliseconds(env.REFRESH_TOKEN_EXPIRES_IN));
    const [authSession] = await AuthSessionModel.create(
      [
        {
          userId: ensureObjectId(input.userId),
          refreshTokenHash: 'pending',
          expiresAt,
          activeTenantId: input.activeTenantId ? ensureObjectId(input.activeTenantId) : null,
          activeMembershipId: input.activeMembershipId
            ? ensureObjectId(input.activeMembershipId)
            : null,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null
        }
      ],
      transactionSession ? { session: transactionSession } : undefined
    );

    const accessToken = this.tokens.signAccessToken({
      sub: input.userId,
      sid: authSession._id.toString(),
      scope: input.scope && input.scope.length > 0 ? [...input.scope] : [...DEFAULT_AUTH_SCOPE],
      tenantId: input.activeTenantId,
      membershipId: input.activeMembershipId
    });
    const refreshToken = this.tokens.signRefreshToken({
      sub: input.userId,
      sid: authSession._id.toString()
    });

    authSession.refreshTokenHash = this.tokens.hashToken(refreshToken);
    await authSession.save(transactionSession ? { session: transactionSession } : undefined);

    return {
      user: input.user,
      session: {
        id: authSession._id.toString(),
        userId: input.userId,
        expiresAt: toIsoDateString(expiresAt)
      },
      tokens: {
        accessToken,
        refreshToken,
        csrfToken: this.tokens.generateCsrfToken()
      }
    };
  }

  private async loadUserSecurityRecord(userId: string): Promise<UserSecurityDocument> {
    const securityRecord = await UserSecurityModel.findOne({ userId: ensureObjectId(userId) });

    if (!securityRecord) {
      throw buildAuthError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    return securityRecord;
  }

  private async registerFailedLoginAttempt(securityRecord: UserSecurityDocument): Promise<void> {
    securityRecord.failedLoginAttempts += 1;

    if (securityRecord.failedLoginAttempts >= AUTH_SECURITY_POLICY.MAX_FAILED_LOGIN_ATTEMPTS) {
      securityRecord.lockoutUntil = new Date(Date.now() + AUTH_SECURITY_POLICY.LOCKOUT_WINDOW_MS);
      securityRecord.failedLoginAttempts = 0;
    }

    await securityRecord.save();
  }

  private async resetFailedLoginAttempts(securityRecord: UserSecurityDocument): Promise<void> {
    if (securityRecord.failedLoginAttempts === 0 && !securityRecord.lockoutUntil) {
      return;
    }

    securityRecord.failedLoginAttempts = 0;
    securityRecord.lockoutUntil = null;
    await securityRecord.save();
  }

  private async assertValidTwoFactorChallenge(
    securityRecord: UserSecurityDocument,
    input: Pick<LoginInput, 'twoFactorCode' | 'recoveryCode'> | TwoFactorChallengeInput
  ): Promise<void> {
    const code = resolveTwoFactorCode(input);

    if (!code && !input.recoveryCode) {
      throw buildAuthError(
        ERROR_CODES.AUTH_TWO_FACTOR_REQUIRED,
        'Two-factor authentication code required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (code && securityRecord.twoFactorSecretEncrypted) {
      const secret = this.twoFactor.decryptSecret(securityRecord.twoFactorSecretEncrypted);

      if (this.twoFactor.verifyCode(secret, code)) {
        return;
      }
    }

    if (
      input.recoveryCode &&
      this.twoFactor.verifyRecoveryCode(input.recoveryCode, securityRecord.recoveryCodeHashes)
    ) {
      securityRecord.recoveryCodeHashes = securityRecord.recoveryCodeHashes.filter(
        (hash) => hash !== this.twoFactor.hashRecoveryCode(input.recoveryCode as string)
      );
      await securityRecord.save();
      return;
    }

    throw buildAuthError(
      ERROR_CODES.AUTH_TWO_FACTOR_INVALID,
      'Invalid two-factor challenge',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  private async recordAuditLog(input: {
    context?: LoginInput['context'];
    action: string;
    resource: AuditResource;
    severity?: AuditSeverity;
    changes?: {
      before?: AuditJsonObject | null;
      after?: AuditJsonObject | null;
      fields?: string[];
    };
    metadata?: AuditJsonObject;
  }, options: RecordAuditLogOptions = {}): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const authService = new AuthService();`r`n