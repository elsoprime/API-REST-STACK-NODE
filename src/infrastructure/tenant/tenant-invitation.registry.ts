import { env } from '@/config/env';
import { transactionalEmailService } from '@/core/communications/email/services/transactional-email.service';
import { type TenantInvitationDeliveryPort } from '@/core/tenant/ports/tenant-invitation-delivery.port';
function buildPublicUrl(baseUrl: string, parameters: Record<string, string>): string {
  const resolvedUrl = new URL(baseUrl);

  for (const [key, value] of Object.entries(parameters)) {
    resolvedUrl.searchParams.set(key, value);
  }

  return resolvedUrl.toString();
}

function resolveRoleLabel(roleKey: string): string {
  switch (roleKey) {
    case 'tenant:owner':
      return 'Owner';
    case 'tenant:member':
      return 'Member';
    default:
      return roleKey;
  }
}

class TransactionalTenantInvitationDeliveryAdapter implements TenantInvitationDeliveryPort {
  async deliver(payload: Parameters<TenantInvitationDeliveryPort['deliver']>[0]): Promise<void> {
    await transactionalEmailService.sendTemplate({
      templateKey: 'tenant-invitation',
      semantic: 'tenant.invitation',
      to: payload.email,
      variables: {
        applicationName: env.APP_NAME,
        recipientEmail: payload.email,
        tenantName: payload.tenantName?.trim() || 'your tenant workspace',
        invitationUrl: buildPublicUrl(env.TENANT_INVITATION_ACCEPT_URL, {
          token: payload.token,
          tenantId: payload.tenantId
        }),
        roleLabel: resolveRoleLabel(payload.roleKey),
        expiresAt: payload.expiresAt,
        supportEmail: env.EMAIL_FROM
      }
    });
  }
}

export interface TenantInvitationRegistry {
  tenantInvitationDeliveryPort: TenantInvitationDeliveryPort;
}

export function createTenantInvitationRegistry(): TenantInvitationRegistry {
  return {
    tenantInvitationDeliveryPort: new TransactionalTenantInvitationDeliveryAdapter()
  };
}

export const tenantInvitationRegistry = createTenantInvitationRegistry();
