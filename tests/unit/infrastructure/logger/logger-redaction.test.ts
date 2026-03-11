import { LOGGER_REDACT_PATHS } from '@/infrastructure/logger/logger';

describe('logger redaction policy', () => {
  it('covers auth secrets, request payload secrets and auditable before/after diffs', () => {
    expect(LOGGER_REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.x-api-key',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.clientSecret',
        'req.body.privateKey',
        'req.body.refreshToken',
        'req.body.accessToken',
        'req.body.recoveryCode',
        'error.details.newPassword',
        'error.details.clientSecret',
        'error.details.csrfToken',
        'metadata.apiKey',
        'metadata.smtpPassword',
        'changes.before.password',
        'changes.after.refreshToken',
        'changes.before.otpauthUrl',
        'changes.after.recoveryCode'
      ])
    );
  });
});
