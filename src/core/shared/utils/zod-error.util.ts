import { type ZodIssue } from 'zod';

import type { ErrorDetails } from '@/infrastructure/errors/app-error';

export function mapZodIssuesToErrorDetails(issues: ZodIssue[]): ErrorDetails {
  return issues.reduce<ErrorDetails>((details, issue) => {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';
    const fieldErrors = details[fieldPath] ?? [];

    return {
      ...details,
      [fieldPath]: [...fieldErrors, issue.message]
    };
  }, {});
}
