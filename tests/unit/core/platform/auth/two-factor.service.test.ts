import { TwoFactorService } from '@/core/platform/auth/services/two-factor.service';

describe('TwoFactorService', () => {
  it('generates and verifies TOTP codes', () => {
    const service = new TwoFactorService();
    const secret = service.generateSecret();
    const code = service.generateCode(secret, 1_700_000_000_000);

    expect(service.verifyCode(secret, code, 1_700_000_000_000)).toBe(true);
    expect(service.verifyCode(secret, '000000', 1_700_000_000_000)).toBe(false);
  });

  it('encrypts and decrypts secrets without losing data', () => {
    const service = new TwoFactorService();
    const encryptedSecret = service.encryptSecret('MYSECRET123');

    expect(encryptedSecret).not.toContain('MYSECRET123');
    expect(service.decryptSecret(encryptedSecret)).toBe('MYSECRET123');
  });

  it('generates recovery codes and verifies hashed recovery codes', () => {
    const service = new TwoFactorService();
    const recoveryCodes = service.generateRecoveryCodes();
    const hashes = recoveryCodes.map((code) => service.hashRecoveryCode(code));

    expect(recoveryCodes).toHaveLength(8);
    expect(service.verifyRecoveryCode(recoveryCodes[0], hashes)).toBe(true);
    expect(service.verifyRecoveryCode('wrong-code', hashes)).toBe(false);
  });
});
