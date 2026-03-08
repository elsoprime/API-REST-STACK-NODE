import {
  type EmailVerificationDeliveryPayload,
  type EmailVerificationDeliveryPort
} from '@/core/platform/auth/ports/email-verification-delivery.port';

export class InMemoryEmailVerificationDeliveryAdapter implements EmailVerificationDeliveryPort {
  private readonly deliveries: EmailVerificationDeliveryPayload[] = [];

  async deliver(payload: EmailVerificationDeliveryPayload): Promise<void> {
    this.deliveries.push(payload);
  }

  peekLatestByEmail(email: string): EmailVerificationDeliveryPayload | undefined {
    return [...this.deliveries].reverse().find((delivery) => delivery.email === email);
  }

  reset(): void {
    this.deliveries.length = 0;
  }
}
