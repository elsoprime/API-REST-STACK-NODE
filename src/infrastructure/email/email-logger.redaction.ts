import {
  type TransactionalEmailDeliveryResult,
  type TransactionalEmailMessage
} from '@/core/communications/email/types/email.types';

export const EMAIL_LOGGER_REDACT_PATHS = [
  'email.message.to',
  'email.message.subject',
  'email.message.html',
  'email.message.text',
  'email.rendered.subject',
  'email.rendered.html',
  'email.rendered.text',
  'email.variables.recipientEmail',
  'email.variables.verificationUrl',
  'email.variables.invitationUrl',
  'email.variables.token'
] as const;

export function buildSafeTransactionalEmailLogContext(
  message: TransactionalEmailMessage,
  result?: TransactionalEmailDeliveryResult
) {
  return {
    scope: 'email.delivery',
    provider: result?.provider ?? 'unknown',
    semantic: message.metadata.semantic,
    templateKey: message.metadata.templateKey,
    templateVersion: message.metadata.templateVersion,
    recipientCount: message.to.length,
    messageId: result?.messageId ?? null
  };
}

export function toSafeEmailErrorLog(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message
    };
  }

  return {
    errorName: 'NonErrorThrow',
    errorMessage: 'Unknown transactional email error'
  };
}
