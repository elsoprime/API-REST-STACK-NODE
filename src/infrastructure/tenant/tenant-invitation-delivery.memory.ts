import {
  type TenantInvitationDeliveryPayload,
  type TenantInvitationDeliveryPort
} from '@/core/tenant/ports/tenant-invitation-delivery.port';

export class InMemoryTenantInvitationDeliveryAdapter implements TenantInvitationDeliveryPort {
  private readonly deliveries = new Map<string, TenantInvitationDeliveryPayload[]>();

  async deliver(payload: TenantInvitationDeliveryPayload): Promise<void> {
    const deliveries = this.deliveries.get(payload.email) ?? [];

    deliveries.push(payload);
    this.deliveries.set(payload.email, deliveries);
  }

  peekLatestByEmail(email: string): TenantInvitationDeliveryPayload | undefined {
    const deliveries = this.deliveries.get(email.toLowerCase()) ?? [];

    return deliveries.at(-1);
  }

  reset(): void {
    this.deliveries.clear();
  }
}
