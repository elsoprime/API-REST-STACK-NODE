import { ERROR_CODES, type ErrorCode } from '@/infrastructure/errors/error-codes';

export type ErrorDetails = Record<string, string[]>;

interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: ErrorDetails;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetails;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });

    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Route not found', details?: ErrorDetails) {
    super({
      code: ERROR_CODES.NOT_FOUND,
      message,
      statusCode: 404,
      details
    });

    this.name = 'NotFoundError';
  }
}
