import { env } from '@/config/env';
import { type TenantInvitationDeliveryPort } from '@/core/tenant/ports/tenant-invitation-delivery.port';
import { InMemoryTenantInvitationDeliveryAdapter } from '@/infrastructure/tenant/tenant-invitation-delivery.memory';
import { postDeliveryWebhook } from '@/infrastructure/security/webhook-delivery';

class WebhookTenantInvitationDeliveryAdapter implements TenantInvitationDeliveryPort {
  constructor(
    private readonly webhookUrl: string,
    private readonly timeoutMs: number,
    private readonly bearerToken?: string
  ) {}

  async deliver(payload: Parameters<TenantInvitationDeliveryPort['deliver']>[0]): Promise<void> {
    await postDeliveryWebhook({
      webhookUrl: this.webhookUrl,
      payload: {
        event: 'tenant.invitation',
        payload
      },
      timeoutMs: this.timeoutMs,
      bearerToken: this.bearerToken
    });
  }
}

class MissingProductionTenantInvitationDeliveryAdapter implements TenantInvitationDeliveryPort {
  async deliver(): Promise<void> {
    throw new Error(
      'Tenant invitation delivery adapter is not configured for production. Configure TENANT_INVITATION_DELIVERY_WEBHOOK_URL.'
    );
  }
}

export interface TenantInvitationRegistry {
  tenantInvitationDeliveryPort: TenantInvitationDeliveryPort;
}

export const inMemoryTenantInvitationDeliveryAdapter =
  new InMemoryTenantInvitationDeliveryAdapter();

export function createTenantInvitationRegistry(): TenantInvitationRegistry {
  if (env.NODE_ENV === 'production') {
    if (!env.TENANT_INVITATION_DELIVERY_WEBHOOK_URL) {
      return {
        tenantInvitationDeliveryPort: new MissingProductionTenantInvitationDeliveryAdapter()
      };
    }

    return {
      tenantInvitationDeliveryPort: new WebhookTenantInvitationDeliveryAdapter(
        env.TENANT_INVITATION_DELIVERY_WEBHOOK_URL,
        env.DELIVERY_WEBHOOK_TIMEOUT_MS,
        env.DELIVERY_WEBHOOK_AUTH_TOKEN
      )
    };
  }

  return {
    tenantInvitationDeliveryPort: inMemoryTenantInvitationDeliveryAdapter
  };
}

export const tenantInvitationRegistry = createTenantInvitationRegistry();
