import { LOGGER_REDACT_PATHS } from '@/infrastructure/logger/logger';

describe('logger redaction policy', () => {
  it('covers auth secrets, request payload secrets and auditable before/after diffs', () => {
    expect(LOGGER_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.refreshToken',
        'req.body.recoveryCode',
        'error.details.csrfToken',
        'changes.before.password',
        'changes.after.refreshToken',
        'changes.before.otpauthUrl',
        'changes.after.recoveryCode'
      ])
    );
  });
});
