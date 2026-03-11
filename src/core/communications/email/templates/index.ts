import { resetPasswordTemplate } from '@/core/communications/email/templates/reset-password.template';
import { tenantInvitationTemplate } from '@/core/communications/email/templates/tenant-invitation.template';
import { verifyEmailTemplate } from '@/core/communications/email/templates/verify-email.template';
import {
  type EmailTemplateRegistry
} from '@/core/communications/email/types/email.types';

export const emailTemplates = {
  'verify-email': verifyEmailTemplate,
  'reset-password': resetPasswordTemplate,
  'tenant-invitation': tenantInvitationTemplate
} satisfies EmailTemplateRegistry;
