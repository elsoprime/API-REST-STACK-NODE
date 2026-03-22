import {
  type EmailTemplateDefinition,
  type ExpenseStatusUpdateTemplateVariables
} from '@/core/communications/email/types/email.types';
import { renderCorporateEmailLayout } from '@/core/communications/email/templates/template.utils';

function renderSupportLine(supportEmail: string | null): string {
  return supportEmail
    ? `Necesitas ayuda? Escribenos a ${supportEmail}.`
    : 'Necesitas ayuda? Contacta al equipo de soporte.';
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export const expenseStatusUpdateTemplate: EmailTemplateDefinition<'expense-status-update'> = {
  key: 'expense-status-update',
  version: '1.0.0',
  renderSubject: (variables: ExpenseStatusUpdateTemplateVariables) =>
    `Actualizacion de solicitud ${variables.requestNumber}: ${variables.status}`,
  renderHtml: (variables: ExpenseStatusUpdateTemplateVariables) => {
    const comment = variables.comment?.trim() ?? '';

    return renderCorporateEmailLayout({
      applicationName: variables.applicationName,
      previewText: `Tu solicitud ${variables.requestNumber} cambio a estado ${variables.status}.`,
      eyebrow: 'Expenses',
      title: 'Actualizacion de estado de solicitud',
      introParagraphs: [
        `La solicitud ${variables.requestNumber} ahora se encuentra en estado ${variables.status}.`
      ],
      actionLabel: 'Ver solicitudes',
      actionUrl: 'https://app.example.com/expenses',
      detailRows: [
        {
          label: 'Solicitud',
          value: variables.requestNumber
        },
        {
          label: 'Estado',
          value: variables.status
        },
        {
          label: 'Monto',
          value: formatAmount(variables.amount, variables.currency)
        }
      ],
      outroParagraphs: comment.length > 0 ? [`Comentario: ${comment}`] : [],
      supportLine: renderSupportLine(variables.supportEmail),
      disclaimer: `Mensaje transaccional enviado por ${variables.applicationName}.`
    });
  },
  renderText: (variables: ExpenseStatusUpdateTemplateVariables) => {
    const lines = [
      `Solicitud ${variables.requestNumber} actualizada.`,
      `Estado: ${variables.status}`,
      `Monto: ${formatAmount(variables.amount, variables.currency)}`
    ];

    if (variables.comment && variables.comment.trim().length > 0) {
      lines.push(`Comentario: ${variables.comment.trim()}`);
    }

    lines.push(renderSupportLine(variables.supportEmail));
    return lines.join('\n');
  }
};
