import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { toErrorResponse } from '@/infrastructure/middleware/errorHandler.middleware';

describe('toErrorResponse', () => {
  it('maps controlled application errors to the official envelope', () => {
    const error = new AppError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      statusCode: 400,
      details: {
        email: ['Invalid email']
      }
    });

    const response = toErrorResponse(error, 'trace-123');

    expect(response).toEqual({
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'GEN_VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            email: ['Invalid email']
          }
        },
        traceId: 'trace-123'
      }
    });
  });

  it('maps unexpected errors to a stable internal error envelope', () => {
    const response = toErrorResponse(new Error('boom'), 'trace-456');

    expect(response).toEqual({
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'GEN_INTERNAL_ERROR',
          message: 'Internal server error'
        },
        traceId: 'trace-456'
      }
    });
  });
});
