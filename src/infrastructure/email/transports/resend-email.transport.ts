import { type TransactionalEmailPort } from '@/core/communications/email/ports/transactional-email.port';
import {
  type TransactionalEmailDeliveryResult,
  type TransactionalEmailMessage
} from '@/core/communications/email/types/email.types';

interface ResendEmailTransportOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

function resolveMessageId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === 'string' ? candidate.id : null;
}

export class ResendEmailTransport implements TransactionalEmailPort {
  constructor(private readonly options: ResendEmailTransportOptions) {}

  async send(message: TransactionalEmailMessage): Promise<TransactionalEmailDeliveryResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(new URL('/emails', this.options.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Resend email delivery failed with status ${response.status}.`);
      }

      const body = await response.json().catch(() => null);

      return {
        provider: 'resend',
        messageId: resolveMessageId(body),
        acceptedRecipients: [...message.to]
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Resend email delivery timed out after ${this.options.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
