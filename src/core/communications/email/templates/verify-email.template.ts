import {
  type EmailTemplateDefinition,
  type VerifyEmailTemplateVariables
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

export const verifyEmailTemplate: EmailTemplateDefinition<'verify-email'> = {
  key: 'verify-email',
  version: '1.1.0',
  renderSubject: (variables: VerifyEmailTemplateVariables) =>
    `Verifica tu correo en ${variables.applicationName}`,
  renderHtml: (variables: VerifyEmailTemplateVariables) => {
    const expiration = formatExpiration(variables.expiresAt);

    return renderCorporateEmailLayout({
      applicationName: variables.applicationName,
      previewText: `Verifica tu correo y activa tu acceso a ${variables.applicationName}.`,
      eyebrow: 'Verificacion de cuenta',
      title: 'Confirma tu correo electronico',
      greeting: resolveGreeting(variables.recipientFirstName),
      introParagraphs: [
        `Recibimos una solicitud para verificar el correo asociado a tu cuenta en ${variables.applicationName}.`,
        'Para activar tu acceso de forma segura, usa el boton que aparece a continuacion.'
      ],
      actionLabel: 'Verificar correo',
      actionUrl: variables.verificationUrl,
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
        'Si no realizaste esta solicitud, puedes ignorar este mensaje sin realizar cambios en tu cuenta.',
        'Por seguridad, no compartas este enlace con terceros.'
      ],
      supportLine: renderSupportLine(variables.supportEmail),
      disclaimer: `Mensaje transaccional enviado por ${variables.applicationName}.`
    });
  },
  renderText: (variables: VerifyEmailTemplateVariables) => {
    const greeting = resolveGreeting(variables.recipientFirstName);
    const expiration = formatExpiration(variables.expiresAt);

    return [
      greeting,
      '',
      `Recibimos una solicitud para verificar el correo asociado a tu cuenta en ${variables.applicationName}.`,
      'Para activar tu acceso de forma segura, abre el siguiente enlace:',
      '',
      variables.verificationUrl,
      '',
      `Correo registrado: ${variables.recipientEmail}`,
      `Enlace valido hasta: ${expiration}`,
      '',
      'Si el enlace no abre al hacer clic, copia y pegalo en tu navegador.',
      'Si no realizaste esta solicitud, puedes ignorar este mensaje sin realizar cambios en tu cuenta.',
      'Por seguridad, no compartas este enlace con terceros.',
      renderSupportLine(variables.supportEmail)
    ].join('\n');
  }
};
