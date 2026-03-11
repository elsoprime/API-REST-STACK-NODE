import { createHash } from 'node:crypto';

import { env } from '@/config/env';
import { type TransactionalEmailPort } from '@/core/communications/email/ports/transactional-email.port';
import {
  EmailTemplateService,
  emailTemplateService
} from '@/core/communications/email/services/email-template.service';
import {
  type EmailTemplateKey,
  type EmailTemplateVariablesMap,
  type SendTransactionalTemplateInput,
  type TransactionalEmailDeliveryResult,
  type TransactionalEmailMessage
} from '@/core/communications/email/types/email.types';
import {
  buildSafeTransactionalEmailLogContext,
  toSafeEmailErrorLog
} from '@/infrastructure/email/email-logger.redaction';
import { emailDeliveryRegistry } from '@/infrastructure/email/email-delivery.registry';
import { type AppLogger, logger } from '@/infrastructure/logger/logger';

function buildFromAddress(email: string, name?: string): string {
  const trimmedName = name?.trim();

  return trimmedName && trimmedName.length > 0 ? `${trimmedName} <${email}>` : email;
}

function buildIdempotencyKey(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

export class TransactionalEmailService {
  constructor(
    private readonly transport: TransactionalEmailPort = emailDeliveryRegistry.transactionalEmailPort,
    private readonly templates: EmailTemplateService = emailTemplateService,
    private readonly appLogger: AppLogger = logger
  ) {}

  async sendTemplate<TKey extends EmailTemplateKey>(
    input: SendTransactionalTemplateInput<TKey>
  ): Promise<TransactionalEmailDeliveryResult> {
    const rendered = this.templates.render({
      key: input.templateKey,
      variables: input.variables as EmailTemplateVariablesMap[TKey]
    });
    const message: TransactionalEmailMessage = {
      from: buildFromAddress(env.EMAIL_FROM, env.EMAIL_FROM_NAME),
      to: [input.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: buildIdempotencyKey(
        [
          input.semantic,
          input.to.toLowerCase(),
          rendered.subject,
          rendered.html,
          rendered.text
        ].join('|')
      ),
      metadata: {
        semantic: input.semantic,
        templateKey: input.templateKey,
        templateVersion: rendered.version
      }
    };

    try {
      const result = await this.transport.send(message);

      this.appLogger.info(
        buildSafeTransactionalEmailLogContext(message, result),
        'Transactional email delivered.'
      );

      return result;
    } catch (error) {
      this.appLogger.error(
        {
          ...buildSafeTransactionalEmailLogContext(message),
          ...toSafeEmailErrorLog(error)
        },
        'Transactional email delivery failed.'
      );

      throw error;
    }
  }
}

export const transactionalEmailService = new TransactionalEmailService();
