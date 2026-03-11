import {
  type EmailTemplateDefinition,
  type ResetPasswordTemplateVariables
} from '@/core/communications/email/types/email.types';
import {
  formatExpiration,
  renderCorporateEmailLayout
} from '@/core/communications/email/templates/template.utils';

function resolveGreeting(firstName?: string | null): string {
  const trimmed = firstName?.trim();

  return trimmed && trimmed.length > 0 ? `Hola ${trimmed},` : 'Hola,';
}

function renderSupportLine(supportEmail: string | null): string {
  return supportEmail ? `Necesitas ayuda? Escribenos a ${supportEmail}.` : 'Necesitas ayuda? Contacta al equipo de soporte.';
}

export const resetPasswordTemplate: EmailTemplateDefinition<'reset-password'> = {
  key: 'reset-password',
  version: '1.0.0',
  renderSubject: (variables: ResetPasswordTemplateVariables) =>
    `Restablece tu clave en ${variables.applicationName}`,
  renderHtml: (variables: ResetPasswordTemplateVariables) => {
    const expiration = formatExpiration(variables.expiresAt);

    return renderCorporateEmailLayout({
      applicationName: variables.applicationName,
      previewText: `Restablece tu clave de acceso en ${variables.applicationName}.`,
      eyebrow: 'Seguridad de cuenta',
      title: 'Restablecer clave',
      greeting: resolveGreeting(variables.recipientFirstName),
      introParagraphs: [
        `Recibimos una solicitud para restablecer la clave de tu cuenta en ${variables.applicationName}.`,
        'Si fuiste tu, usa el siguiente boton para definir una nueva clave segura.'
      ],
      actionLabel: 'Restablecer clave',
      actionUrl: variables.resetPasswordUrl,
      detailRows: [
        {
          label: 'Correo registrado',
          value: variables.recipientEmail
        },
        {
          label: 'Enlace valido hasta',
          value: expiration
        }
      ],
      outroParagraphs: [
        'Si no realizaste esta solicitud, ignora este mensaje y revisa la seguridad de tu cuenta.',
        'Por seguridad, no compartas este enlace con terceros.'
      ],
      supportLine: renderSupportLine(variables.supportEmail),
      disclaimer: `Mensaje transaccional enviado por ${variables.applicationName}.`
    });
  },
  renderText: (variables: ResetPasswordTemplateVariables) => {
    const greeting = resolveGreeting(variables.recipientFirstName);
    const expiration = formatExpiration(variables.expiresAt);

    return [
      greeting,
      '',
      `Recibimos una solicitud para restablecer la clave de tu cuenta en ${variables.applicationName}.`,
      'Si fuiste tu, abre el siguiente enlace para definir una nueva clave segura:',
      '',
      variables.resetPasswordUrl,
      '',
      `Correo registrado: ${variables.recipientEmail}`,
      `Enlace valido hasta: ${expiration}`,
      '',
      'Si no realizaste esta solicitud, ignora este mensaje y revisa la seguridad de tu cuenta.',
      'Por seguridad, no compartas este enlace con terceros.',
      renderSupportLine(variables.supportEmail)
    ].join('\n');
  }
};
