import {
  type EmailTemplateDefinition,
  type TenantInvitationTemplateVariables
} from '@/core/communications/email/types/email.types';
import {
  formatExpiration,
  renderCorporateEmailLayout
} from '@/core/communications/email/templates/template.utils';

function renderSupportLine(supportEmail: string | null): string {
  return supportEmail ? `Necesitas ayuda? Escribenos a ${supportEmail}.` : 'Necesitas ayuda? Contacta al equipo de soporte.';
}

export const tenantInvitationTemplate: EmailTemplateDefinition<'tenant-invitation'> = {
  key: 'tenant-invitation',
  version: '1.1.0',
  renderSubject: (variables: TenantInvitationTemplateVariables) =>
    `Invitacion para unirte a ${variables.tenantName} en ${variables.applicationName}`,
  renderHtml: (variables: TenantInvitationTemplateVariables) => {
    const expiration = formatExpiration(variables.expiresAt);

    return renderCorporateEmailLayout({
      applicationName: variables.applicationName,
      previewText: `Tienes una invitacion para acceder a ${variables.tenantName} en ${variables.applicationName}.`,
      eyebrow: 'Invitacion tenant',
      title: 'Acepta tu invitacion de acceso',
      introParagraphs: [
        `Has sido invitado a unirte a ${variables.tenantName} dentro de ${variables.applicationName}.`,
        'Usa el boton a continuacion para aceptar la invitacion y completar tu acceso.'
      ],
      actionLabel: 'Aceptar invitacion',
      actionUrl: variables.invitationUrl,
      detailRows: [
        {
          label: 'Organizacion',
          value: variables.tenantName
        },
        {
          label: 'Rol asignado',
          value: variables.roleLabel
        },
        {
          label: 'Invitacion valida hasta',
          value: expiration
        }
      ],
      outroParagraphs: [
        'Si no esperabas esta invitacion, puedes ignorar este mensaje sin aceptar el acceso.',
        'Te recomendamos completar el proceso antes del vencimiento para evitar generar una nueva invitacion.'
      ],
      supportLine: renderSupportLine(variables.supportEmail),
      disclaimer: `Mensaje transaccional enviado por ${variables.applicationName}.`
    });
  },
  renderText: (variables: TenantInvitationTemplateVariables) => {
    const expiration = formatExpiration(variables.expiresAt);

    return [
      `Has sido invitado a unirte a ${variables.tenantName} en ${variables.applicationName}.`,
      `Rol asignado: ${variables.roleLabel}`,
      '',
      'Acepta tu invitacion en el siguiente enlace:',
      variables.invitationUrl,
      '',
      `Invitacion valida hasta: ${expiration}`,
      '',
      'Si el enlace no abre al hacer clic, copia y pegalo en tu navegador.',
      'Si no esperabas esta invitacion, puedes ignorar este mensaje sin aceptar el acceso.',
      renderSupportLine(variables.supportEmail)
    ].join('\n');
  }
};
