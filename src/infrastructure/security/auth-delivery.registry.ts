import { env } from '@/config/env';
import {
  type EmailVerificationDeliveryPort
} from '@/core/platform/auth/ports/email-verification-delivery.port';
import {
  type TwoFactorProvisioningPort
} from '@/core/platform/auth/ports/two-factor-provisioning.port';
import { InMemoryEmailVerificationDeliveryAdapter } from '@/infrastructure/security/email-verification-delivery.memory';
import { InMemoryTwoFactorProvisioningAdapter } from '@/infrastructure/security/two-factor-provisioning.memory';
import { postDeliveryWebhook } from '@/infrastructure/security/webhook-delivery';

class WebhookEmailVerificationDeliveryAdapter implements EmailVerificationDeliveryPort {
  constructor(
    private readonly webhookUrl: string,
    private readonly timeoutMs: number,
    private readonly bearerToken?: string
  ) {}

  async deliver(payload: Parameters<EmailVerificationDeliveryPort['deliver']>[0]): Promise<void> {
    await postDeliveryWebhook({
      webhookUrl: this.webhookUrl,
      payload: {
        event: 'auth.email_verification',
        payload
      },
      timeoutMs: this.timeoutMs,
      bearerToken: this.bearerToken
    });
  }
}

class MissingProductionEmailVerificationDeliveryAdapter implements EmailVerificationDeliveryPort {
  async deliver(): Promise<void> {
    throw new Error(
      'Email verification delivery adapter is not configured for production. Configure AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL.'
    );
  }
}

class WebhookTwoFactorProvisioningAdapter implements TwoFactorProvisioningPort {
  constructor(
    private readonly webhookUrl: string,
    private readonly timeoutMs: number,
    private readonly bearerToken?: string
  ) {}

  async deliver(payload: Parameters<TwoFactorProvisioningPort['deliver']>[0]): Promise<void> {
    await postDeliveryWebhook({
      webhookUrl: this.webhookUrl,
      payload: {
        event: 'auth.two_factor_provisioning',
        payload
      },
      timeoutMs: this.timeoutMs,
      bearerToken: this.bearerToken
    });
  }
}

class MissingProductionTwoFactorProvisioningAdapter implements TwoFactorProvisioningPort {
  async deliver(): Promise<void> {
    throw new Error(
      'Two-factor provisioning adapter is not configured for production. Configure AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL.'
    );
  }
}

export interface AuthDeliveryRegistry {
  emailVerificationDeliveryPort: EmailVerificationDeliveryPort;
  twoFactorProvisioningPort: TwoFactorProvisioningPort;
}

export const inMemoryEmailVerificationDeliveryAdapter =
  new InMemoryEmailVerificationDeliveryAdapter();

export const inMemoryTwoFactorProvisioningAdapter =
  new InMemoryTwoFactorProvisioningAdapter();

export function createAuthDeliveryRegistry(): AuthDeliveryRegistry {
  if (env.NODE_ENV === 'production') {
    const emailVerificationWebhookUrl = env.AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL;
    const twoFactorProvisioningWebhookUrl = env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL;

    if (!emailVerificationWebhookUrl || !twoFactorProvisioningWebhookUrl) {
      return {
        emailVerificationDeliveryPort: emailVerificationWebhookUrl
          ? new WebhookEmailVerificationDeliveryAdapter(
              emailVerificationWebhookUrl,
              env.DELIVERY_WEBHOOK_TIMEOUT_MS,
              env.DELIVERY_WEBHOOK_AUTH_TOKEN
            )
          : new MissingProductionEmailVerificationDeliveryAdapter(),
        twoFactorProvisioningPort: twoFactorProvisioningWebhookUrl
          ? new WebhookTwoFactorProvisioningAdapter(
              twoFactorProvisioningWebhookUrl,
              env.DELIVERY_WEBHOOK_TIMEOUT_MS,
              env.DELIVERY_WEBHOOK_AUTH_TOKEN
            )
          : new MissingProductionTwoFactorProvisioningAdapter()
      };
    }

    return {
      emailVerificationDeliveryPort: new WebhookEmailVerificationDeliveryAdapter(
        emailVerificationWebhookUrl,
        env.DELIVERY_WEBHOOK_TIMEOUT_MS,
        env.DELIVERY_WEBHOOK_AUTH_TOKEN
      ),
      twoFactorProvisioningPort: new WebhookTwoFactorProvisioningAdapter(
        twoFactorProvisioningWebhookUrl,
        env.DELIVERY_WEBHOOK_TIMEOUT_MS,
        env.DELIVERY_WEBHOOK_AUTH_TOKEN
      )
    };
  }

  return {
    emailVerificationDeliveryPort: inMemoryEmailVerificationDeliveryAdapter,
    twoFactorProvisioningPort: inMemoryTwoFactorProvisioningAdapter
  };
}

export const authDeliveryRegistry = createAuthDeliveryRegistry();
