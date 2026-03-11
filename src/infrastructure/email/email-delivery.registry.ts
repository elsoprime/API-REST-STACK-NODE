import { env } from '@/config/env';
import { type TransactionalEmailPort } from '@/core/communications/email/ports/transactional-email.port';
import { MailpitEmailTransport } from '@/infrastructure/email/transports/mailpit-email.transport';
import { ResendEmailTransport } from '@/infrastructure/email/transports/resend-email.transport';

class MissingEmailProviderTransport implements TransactionalEmailPort {
  async send(): Promise<never> {
    throw new Error(
      'Transactional email transport is not configured. Configure EMAIL_PROVIDER and its provider credentials.'
    );
  }
}

export interface EmailDeliveryRegistry {
  transactionalEmailPort: TransactionalEmailPort;
}

export function createEmailDeliveryRegistry(): EmailDeliveryRegistry {
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.EMAIL_RESEND_API_KEY) {
      return {
        transactionalEmailPort: new MissingEmailProviderTransport()
      };
    }

    return {
      transactionalEmailPort: new ResendEmailTransport({
        apiKey: env.EMAIL_RESEND_API_KEY,
        baseUrl: env.EMAIL_RESEND_API_BASE_URL,
        timeoutMs: env.EMAIL_DELIVERY_TIMEOUT_MS
      })
    };
  }

  return {
    transactionalEmailPort: new MailpitEmailTransport({
      host: env.EMAIL_MAILPIT_SMTP_HOST,
      port: env.EMAIL_MAILPIT_SMTP_PORT,
      timeoutMs: env.EMAIL_DELIVERY_TIMEOUT_MS
    })
  };
}

export const emailDeliveryRegistry = createEmailDeliveryRegistry();
