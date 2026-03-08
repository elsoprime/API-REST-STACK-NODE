import { PasswordService } from '@/core/platform/auth/services/password.service';

describe('PasswordService', () => {
  it('hashes and verifies passwords', async () => {
    const service = new PasswordService();
    const password = 'Password123!';
    const passwordHash = await service.hash(password);

    expect(passwordHash).not.toBe(password);
    await expect(service.verify(password, passwordHash)).resolves.toBe(true);
    await expect(service.verify('wrong-password', passwordHash)).resolves.toBe(false);
  });
});
