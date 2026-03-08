import {
  type TwoFactorProvisioningPayload,
  type TwoFactorProvisioningPort
} from '@/core/platform/auth/ports/two-factor-provisioning.port';

export class InMemoryTwoFactorProvisioningAdapter implements TwoFactorProvisioningPort {
  private readonly deliveries: TwoFactorProvisioningPayload[] = [];

  async deliver(payload: TwoFactorProvisioningPayload): Promise<void> {
    this.deliveries.push(payload);
  }

  peekLatestByUserId(userId: string): TwoFactorProvisioningPayload | undefined {
    return [...this.deliveries].reverse().find((delivery) => delivery.userId === userId);
  }

  reset(): void {
    this.deliveries.length = 0;
  }
}
