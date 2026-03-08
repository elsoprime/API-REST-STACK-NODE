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

describe('AuthService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers the verification token through the configured delivery port on register', async () => {
    const deliveryAdapter = new InMemoryEmailVerificationDeliveryAdapter();
    const audit = createAuditStub();
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

    const result = await service.register({
      email: 'john@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe'
    });

    const delivery = deliveryAdapter.peekLatestByEmail('john@example.com');

    expect(result.verification).toMatchObject({
      required: true
    });
    expect(delivery).toMatchObject({
      email: 'john@example.com'
    });
    expect(delivery?.token).toBeDefined();
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
});
