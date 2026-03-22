export const EMAIL_TEMPLATE_KEYS = [
  'verify-email',
  'reset-password',
  'tenant-invitation',
  'expense-status-update'
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface VerifyEmailTemplateVariables {
  applicationName: string;
  recipientEmail: string;
  recipientFirstName?: string | null;
  verificationUrl: string;
  expiresAt: string;
  supportEmail: string | null;
}

export interface TenantInvitationTemplateVariables {
  applicationName: string;
  recipientEmail: string;
  tenantName: string;
  invitationUrl: string;
  roleLabel: string;
  expiresAt: string;
  supportEmail: string | null;
}

export interface ResetPasswordTemplateVariables {
  applicationName: string;
  recipientEmail: string;
  recipientFirstName?: string | null;
  resetPasswordUrl: string;
  expiresAt: string;
  supportEmail: string | null;
}

export interface ExpenseStatusUpdateTemplateVariables {
  applicationName: string;
  recipientEmail: string;
  recipientFirstName?: string | null;
  requestNumber: string;
  status: string;
  amount: number;
  currency: string;
  comment?: string | null;
  supportEmail: string | null;
}

export interface EmailTemplateVariablesMap {
  'verify-email': VerifyEmailTemplateVariables;
  'reset-password': ResetPasswordTemplateVariables;
  'tenant-invitation': TenantInvitationTemplateVariables;
  'expense-status-update': ExpenseStatusUpdateTemplateVariables;
}

export interface EmailTemplateDefinition<TKey extends EmailTemplateKey> {
  key: TKey;
  version: string;
  renderSubject: (variables: EmailTemplateVariablesMap[TKey]) => string;
  renderHtml: (variables: EmailTemplateVariablesMap[TKey]) => string;
  renderText: (variables: EmailTemplateVariablesMap[TKey]) => string;
}

export type EmailTemplateRegistry = {
  [TKey in EmailTemplateKey]: EmailTemplateDefinition<TKey>;
};

export interface RenderedEmailTemplate<TKey extends EmailTemplateKey = EmailTemplateKey> {
  key: TKey;
  version: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendTransactionalTemplateInput<TKey extends EmailTemplateKey> {
  templateKey: TKey;
  to: string;
  semantic: string;
  variables: EmailTemplateVariablesMap[TKey];
}

export type TransactionalEmailProvider = 'mailpit' | 'resend';

export interface TransactionalEmailMetadata {
  semantic: string;
  templateKey: EmailTemplateKey;
  templateVersion: string;
}

export interface TransactionalEmailMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  metadata: TransactionalEmailMetadata;
}

export interface TransactionalEmailDeliveryResult {
  provider: TransactionalEmailProvider;
  messageId: string | null;
  acceptedRecipients: string[];
}
