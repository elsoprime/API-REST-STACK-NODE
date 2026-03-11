import { emailTemplates } from '@/core/communications/email/templates';
import {
  type EmailTemplateKey,
  type EmailTemplateVariablesMap,
  type RenderedEmailTemplate
} from '@/core/communications/email/types/email.types';

export class EmailTemplateService {
  render<TKey extends EmailTemplateKey>(input: {
    key: TKey;
    variables: EmailTemplateVariablesMap[TKey];
  }): RenderedEmailTemplate<TKey> {
    if (input.key === 'verify-email') {
      const template = emailTemplates['verify-email'];
      const variables = input.variables as EmailTemplateVariablesMap['verify-email'];

      return {
        key: template.key as TKey,
        version: template.version,
        subject: template.renderSubject(variables),
        html: template.renderHtml(variables),
        text: template.renderText(variables)
      };
    }

    if (input.key === 'reset-password') {
      const template = emailTemplates['reset-password'];
      const variables = input.variables as EmailTemplateVariablesMap['reset-password'];

      return {
        key: template.key as TKey,
        version: template.version,
        subject: template.renderSubject(variables),
        html: template.renderHtml(variables),
        text: template.renderText(variables)
      };
    }

    const template = emailTemplates['tenant-invitation'];
    const variables = input.variables as EmailTemplateVariablesMap['tenant-invitation'];

    return {
      key: template.key as TKey,
      version: template.version,
      subject: template.renderSubject(variables),
      html: template.renderHtml(variables),
      text: template.renderText(variables)
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
