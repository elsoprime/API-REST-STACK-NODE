import mongoose, { Types } from 'mongoose';

import { AUTH_SECURITY_POLICY } from '@/constants/security';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { AuthService } from '@/core/platform/auth/services/auth.service';
import { InMemoryEmailVerificationDeliveryAdapter } from '@/infrastructure/security/email-verification-delivery.memory';
import { InMemoryTwoFactorProvisioningAdapter } from '@/infrastructure/security/two-factor-provisioning.memory';
import { UserModel } from '@/core/platform/users/models/user.model';
import { UserSecurityModel } from '@/core/platform/users/models/user-security.model';

function createAuditStub() {
  return {
    record: vi.fn().mockResolvedValue({
      id: 'audit-1'
    }),
    list: vi.fn()
  };
}

function createTransactionalSaveGuard(label: string, state: { active: boolean; trace: string[] }) {
  return vi.fn().mockImplementation(async () => {
    if (state.active) {
      throw new Error(`Concurrent transactional save detected: ${label}`);
    }

    state.active = true;
    state.trace.push(`${label}:start`);
    await Promise.resolve();
    state.trace.push(`${label}:end`);
    state.active = false;
  });
}

describe('AuthService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers the verification token through the configured delivery port on register', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const audit = createAuditStub();
    const updateOne = vi.fn().mockResolvedValue({
      acknowledged: true
    });
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      {
        hash: vi.fn().mockResolvedValue('password-hash')
      } as never,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      audit as never
    );
    const fakeUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(UserModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as never);
    vi.spyOn(UserModel, 'create').mockResolvedValue([
      {
        _id: fakeUserId,
        toObject: () => ({
          _id: fakeUserId,
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          status: 'pending_verification'
        })
      }
    ] as never);
    vi.spyOn(UserSecurityModel, 'create').mockResolvedValue([] as never);
    vi.spyOn(UserSecurityModel, 'updateOne').mockImplementation(updateOne as never);

    const result = await service.register({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    });

    const delivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(result).toEqual({
      accepted: true
    });
    expect(delivery).toMatchObject({
      email: 'john@example.com'
    });
    expect(delivery?.token).toBeDefined();
    expect(updateOne).toHaveBeenCalledWith(
      {
        userId: expect.any(Types.ObjectId)
      },
      {
        $set: {
          emailVerificationLastSentAt: expect.any(Date)
        }
      }
    );
  });

  it('returns an accepted response without mutating an existing pending account on register', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const passwordHash = vi.fn();
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      {
        hash: passwordHash
      } as never,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      createAuditStub() as never
    );
    const existingUserId = new Types.ObjectId();

    vi.spyOn(UserModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: existingUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'pending_verification'
      })
    } as never);

    const result = await service.register({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    });

    const delivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(result).toEqual({
      accepted: true
    });
    expect(passwordHash).not.toHaveBeenCalled();
    expect(delivery).toBeUndefined();
  });

  it('resends verification through the explicit resend-verification flow', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const securitySave = vi.fn().mockResolvedValue(undefined);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      createAuditStub() as never
    );
    const existingUserId = new Types.ObjectId();

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: existingUserId,
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      status: 'pending_verification'
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      isEmailVerified: false,
      emailVerificationTokenHash: 'old-hash',
      emailVerificationExpiresAt: new Date(Date.now() - 1_000),
      emailVerificationLastSentAt: new Date(Date.now() - AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - 1_000),
      save: securitySave
    } as never);

    const result = await service.resendVerification({
      email: 'john@example.com'
    });

    const delivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(result).toEqual({
      accepted: true
    });
    expect(securitySave).toHaveBeenCalledTimes(2);
    expect(delivery?.token).toBeDefined();
  });

  it('suppresses resend-verification while the cooldown is active', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const securitySave = vi.fn().mockResolvedValue(undefined);
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      createAuditStub() as never
    );
    const existingUserId = new Types.ObjectId();

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: existingUserId,
      email: 'john@example.com',
      firstName: 'John',
      status: 'pending_verification'
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      isEmailVerified: false,
      emailVerificationTokenHash: 'old-hash',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      emailVerificationLastSentAt: new Date(),
      save: securitySave
    } as never);

    const result = await service.resendVerification({
      email: 'john@example.com'
    });

    expect(result).toEqual({
      accepted: true
    });
    expect(securitySave).not.toHaveBeenCalled();
    expect(deliveryAdapter.peekLatestByEmail('john@example.com')).toBeUndefined();
  });

  it('restores the previous verification token when resend delivery fails', async () => {
    const deliveryError = new Error('delivery failed');
    const failingDeliveryPort = {
      deliver: vi.fn().mockRejectedValue(deliveryError)
    };
    const securitySave = vi.fn().mockResolvedValue(undefined);
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      failingDeliveryPort as never,
      new InMemoryTwoFactorProvisioningAdapter(),
      createAuditStub() as never
    );
    const existingUserId = new Types.ObjectId();
    const securityRecord = {
      isEmailVerified: false,
      emailVerificationTokenHash: 'old-hash',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      emailVerificationLastSentAt: new Date(Date.now() - AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - 1_000),
      save: securitySave
    };

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: existingUserId,
      email: 'john@example.com',
      firstName: 'John',
      status: 'pending_verification'
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue(securityRecord as never);

    await expect(
      service.resendVerification({
        email: 'john@example.com'
      })
    ).rejects.toThrow('delivery failed');

    expect(securitySave).toHaveBeenCalledTimes(2);
    expect(securityRecord.emailVerificationTokenHash).toBe('old-hash');
  });

  it('invalidates the previous verification token after a successful resend', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const securitySave = vi.fn().mockResolvedValue(undefined);
    const userSave = vi.fn().mockResolvedValue(undefined);
    const resendSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const verifySession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const audit = createAuditStub();
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      deliveryAdapter,
      new InMemoryTwoFactorProvisioningAdapter(),
      audit as never
    );
    const fakeUserId = new Types.ObjectId();
    const user = {
      _id: fakeUserId,
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      status: 'pending_verification' as const,
      save: userSave,
      toObject: () => ({
        _id: fakeUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: user.status
      })
    };
    const securityRecord = {
      isEmailVerified: false,
      emailVerificationTokenHash: 'hash:old-token',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      emailVerificationLastSentAt: new Date(Date.now() - AUTH_SECURITY_POLICY.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - 1_000),
      save: securitySave
    };

    vi.spyOn(mongoose, 'startSession')
      .mockResolvedValueOnce(resendSession as never)
      .mockResolvedValueOnce(verifySession as never);
    vi.spyOn(UserModel, 'findOne')
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce(user as never);
    vi.spyOn(UserSecurityModel, 'findOne')
      .mockResolvedValueOnce(securityRecord as never)
      .mockResolvedValueOnce(securityRecord as never)
      .mockResolvedValueOnce(securityRecord as never);

    const resendResult = await service.resendVerification({
      email: 'john@example.com'
    });
    const latestDelivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(resendResult).toEqual({
      accepted: true
    });
    expect(latestDelivery?.token).toBeDefined();

    await expect(
      service.verifyEmail({
        email: 'john@example.com',
        token: 'old-token'
      })
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_VERIFICATION_INVALID',
      statusCode: 400
    });

    const verificationResult = await service.verifyEmail({
      email: 'john@example.com',
      token: latestDelivery?.token ?? ''
    });

    expect(verificationResult.user).toMatchObject({
      email: 'john@example.com',
      status: 'active',
      isEmailVerified: true
    });
  });

  it('locks the account after the configured number of failed login attempts', async () => {
    const service = new AuthService(
      {
        hashToken: vi.fn(),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      {
        verify: vi.fn().mockResolvedValue(false)
      } as never,
      {
        verifyCode: vi.fn(),
        verifyRecoveryCode: vi.fn()
      } as never,
      undefined,
      undefined,
      createAuditStub() as never
    );
    const fakeUserId = new Types.ObjectId();
    const fakeSecurityRecord = {
      passwordHash: 'hash',
      isEmailVerified: true,
      twoFactorEnabled: false,
      recoveryCodeHashes: [],
      failedLoginAttempts: AUTH_SECURITY_POLICY.MAX_FAILED_LOGIN_ATTEMPTS - 1,
      lockoutUntil: null,
      save: vi.fn().mockResolvedValue(undefined)
    };

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: fakeUserId
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue(fakeSecurityRecord as never);

    await expect(
      service.login({
        email: 'john@example.com',
        password: 'Password123!'
      })
    ).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_LOCKED',
      statusCode: 423
    });

    expect(fakeSecurityRecord.failedLoginAttempts).toBe(0);
    expect(fakeSecurityRecord.lockoutUntil).toBeInstanceOf(Date);
    expect(fakeSecurityRecord.save).toHaveBeenCalled();
  });

  it('requires a second factor when the account has TOTP enabled', async () => {
    const service = new AuthService(
      {
        hashToken: vi.fn(),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      {
        verify: vi.fn().mockResolvedValue(true)
      } as never,
      {
        decryptSecret: vi.fn().mockReturnValue('secret'),
        verifyCode: vi.fn().mockReturnValue(false),
        verifyRecoveryCode: vi.fn().mockReturnValue(false)
      } as never,
      undefined,
      undefined,
      createAuditStub() as never
    );
    const fakeUserId = new Types.ObjectId();

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: fakeUserId,
      toObject: () => ({
        _id: fakeUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active'
      })
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      passwordHash: 'hash',
      isEmailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: 'encrypted-secret',
      recoveryCodeHashes: [],
      failedLoginAttempts: 0,
      lockoutUntil: null
    } as never);

    await expect(
      service.login({
        email: 'john@example.com',
        password: 'Password123!'
      })
    ).rejects.toMatchObject({
      code: 'AUTH_TWO_FACTOR_REQUIRED',
      statusCode: 401
    });
  });

  it('verifies the email token and activates the user', async () => {
    const fakeUserId = new Types.ObjectId();
    const userSave = vi.fn().mockResolvedValue(undefined);
    const securitySave = vi.fn().mockResolvedValue(undefined);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const audit = createAuditStub();
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      audit as never
    );

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: fakeUserId,
      status: 'pending_verification',
      save: userSave,
      toObject: () => ({
        _id: fakeUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active'
      })
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      isEmailVerified: false,
      emailVerificationTokenHash: 'hash:token-123',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      save: securitySave
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.verifyEmail({
      email: 'john@example.com',
      token: 'token-123'
    });

    expect(result.user).toMatchObject({
      email: 'john@example.com',
      status: 'active',
      isEmailVerified: true
    });
    expect(userSave).toHaveBeenCalled();
    expect(securitySave).toHaveBeenCalled();
  });

  it('serializes verify-email writes within the transaction', async () => {
    const fakeUserId = new Types.ObjectId();
    const saveState = {
      active: false,
      trace: [] as string[]
    };
    const userSave = createTransactionalSaveGuard('user', saveState);
    const securitySave = createTransactionalSaveGuard('security', saveState);
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      createAuditStub() as never
    );
    const user = {
      _id: fakeUserId,
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      status: 'pending_verification' as const,
      save: userSave,
      toObject: () => ({
        _id: fakeUserId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: user.status
      })
    };

    vi.spyOn(UserModel, 'findOne').mockResolvedValue(user as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      isEmailVerified: false,
      emailVerificationTokenHash: 'hash:token-123',
      emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      emailVerificationLastSentAt: new Date(),
      save: securitySave
    } as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);

    const result = await service.verifyEmail({
      email: 'john@example.com',
      token: 'token-123'
    });

    expect(result.user).toMatchObject({
      email: 'john@example.com',
      status: 'active',
      isEmailVerified: true
    });
    expect(saveState.trace).toEqual([
      'security:start',
      'security:end',
      'user:start',
      'user:end'
    ]);
  });

  it('rejects verify-email when the account is already verified and no valid token exists', async () => {
    const fakeUserId = new Types.ObjectId();
    const audit = createAuditStub();
    const service = new AuthService(
      {
        hashToken: vi.fn().mockImplementation((value: string) => `hash:${value}`),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      audit as never
    );

    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: fakeUserId
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      isEmailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null
    } as never);

    await expect(
      service.verifyEmail({
        email: 'john@example.com',
        token: 'invalid-token'
      })
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_VERIFICATION_INVALID',
      statusCode: 400
    });
  });

  it('emits platform-scoped permissions for configured platform admin users on login', async () => {
    const fakeUserId = new Types.ObjectId();
    const sessionMock = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const signAccessToken = vi.fn().mockReturnValue('access-token');
    const signRefreshToken = vi.fn().mockReturnValue('refresh-token');
    const service = new AuthService(
      {
        hashToken: vi.fn().mockReturnValue('refresh-hash'),
        signAccessToken,
        signRefreshToken,
        generateCsrfToken: vi.fn().mockReturnValue('csrf-token'),
        verifyRefreshToken: vi.fn()
      } as never,
      {
        verify: vi.fn().mockResolvedValue(true)
      } as never,
      {
        verifyCode: vi.fn(),
        verifyRecoveryCode: vi.fn()
      } as never,
      undefined,
      undefined,
      createAuditStub() as never,
      {
        resolveScopesForEmail: vi.fn().mockReturnValue([
          'platform:self',
          'platform:settings:read',
          'platform:settings:update'
        ])
      } as never
    );

    vi.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock as never);
    vi.spyOn(UserModel, 'findOne').mockResolvedValue({
      _id: fakeUserId,
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      status: 'active',
      toObject: () => ({
        _id: fakeUserId,
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        status: 'active'
      })
    } as never);
    vi.spyOn(UserSecurityModel, 'findOne').mockResolvedValue({
      passwordHash: 'hash',
      isEmailVerified: true,
      twoFactorEnabled: false,
      recoveryCodeHashes: [],
      failedLoginAttempts: 0,
      lockoutUntil: null,
      save: vi.fn().mockResolvedValue(undefined)
    } as never);
    vi.spyOn(AuthSessionModel, 'create').mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        refreshTokenHash: 'pending',
        save: vi.fn().mockResolvedValue(undefined)
      }
    ] as never);

    await service.login({
      email: 'admin@example.com',
      password: 'Password123!'
    });

    expect(signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ['platform:self', 'platform:settings:read', 'platform:settings:update']
      })
    );
  });

  it('serializes logout-all session revocations within the transaction', async () => {
    const fakeUserId = new Types.ObjectId();
    const saveState = {
      active: false,
      trace: [] as string[]
    };
    const sessionAMock = {
      _id: new Types.ObjectId(),
      status: 'active',
      revokedAt: null,
      save: createTransactionalSaveGuard('session-a', saveState)
    };
    const sessionBMock = {
      _id: new Types.ObjectId(),
      status: 'active',
      revokedAt: null,
      save: createTransactionalSaveGuard('session-b', saveState)
    };
    const transactionSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined)
    };
    const service = new AuthService(
      {
        hashToken: vi.fn(),
        signAccessToken: vi.fn(),
        signRefreshToken: vi.fn(),
        generateCsrfToken: vi.fn(),
        verifyRefreshToken: vi.fn()
      } as never,
      undefined,
      undefined,
      undefined,
      undefined,
      createAuditStub() as never
    );

    vi.spyOn(AuthSessionModel, 'find').mockResolvedValue([sessionAMock, sessionBMock] as never);
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(transactionSession as never);

    const result = await service.logoutAll({
      userId: fakeUserId.toString()
    });

    expect(result.revokedSessionIds).toEqual([
      sessionAMock._id.toString(),
      sessionBMock._id.toString()
    ]);
    expect(saveState.trace).toEqual([
      'session-a:start',
      'session-a:end',
      'session-b:start',
      'session-b:end'
    ]);
  });
});
