import { env } from '@/config/env';
import { transactionalEmailService } from '@/core/communications/email/services/transactional-email.service';
import {
  type EmailVerificationDeliveryPort
} from '@/core/platform/auth/ports/email-verification-delivery.port';
import {
  type PasswordResetDeliveryPort
} from '@/core/platform/auth/ports/password-reset-delivery.port';
import {
  type TwoFactorProvisioningPort
} from '@/core/platform/auth/ports/two-factor-provisioning.port';
import { InMemoryTwoFactorProvisioningAdapter } from '@/infrastructure/security/two-factor-provisioning.memory';
import { postDeliveryWebhook } from '@/infrastructure/security/webhook-delivery';

function buildPublicUrl(baseUrl: string, parameters: Record<string, string>): string {
  const resolvedUrl = new URL(baseUrl);

  for (const [key, value] of Object.entries(parameters)) {
    resolvedUrl.searchParams.set(key, value);
  }

  return resolvedUrl.toString();
}

class TransactionalEmailVerificationDeliveryAdapter implements EmailVerificationDeliveryPort {
  async deliver(payload: Parameters<EmailVerificationDeliveryPort['deliver']>[0]): Promise<void> {
    await transactionalEmailService.sendTemplate({
      templateKey: 'verify-email',
      semantic: 'auth.email_verification',
      to: payload.email,
      variables: {
        applicationName: env.APP_NAME,
        recipientEmail: payload.email,
        recipientFirstName: payload.firstName ?? null,
        verificationUrl: buildPublicUrl(env.AUTH_VERIFY_EMAIL_URL, {
          email: payload.email,
          token: payload.token
        }),
        expiresAt: payload.expiresAt,
        supportEmail: env.EMAIL_FROM
      }
    });
  }
}

class TransactionalPasswordResetDeliveryAdapter implements PasswordResetDeliveryPort {
  async deliver(payload: Parameters<PasswordResetDeliveryPort['deliver']>[0]): Promise<void> {
    await transactionalEmailService.sendTemplate({
      templateKey: 'reset-password',
      semantic: 'auth.password_reset',
      to: payload.email,
      variables: {
        applicationName: env.APP_NAME,
        recipientEmail: payload.email,
        recipientFirstName: payload.firstName ?? null,
        resetPasswordUrl: buildPublicUrl(env.AUTH_RESET_PASSWORD_URL, {
          email: payload.email,
          token: payload.token
        }),
        expiresAt: payload.expiresAt,
        supportEmail: env.EMAIL_FROM
      }
    });
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
  passwordResetDeliveryPort: PasswordResetDeliveryPort;
  twoFactorProvisioningPort: TwoFactorProvisioningPort;
}

export const inMemoryTwoFactorProvisioningAdapter =
  new InMemoryTwoFactorProvisioningAdapter();

export function createAuthDeliveryRegistry(): AuthDeliveryRegistry {
  if (env.NODE_ENV === 'production') {
    const twoFactorProvisioningWebhookUrl = env.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL;

    return {
      emailVerificationDeliveryPort: new TransactionalEmailVerificationDeliveryAdapter(),
      passwordResetDeliveryPort: new TransactionalPasswordResetDeliveryAdapter(),
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
    emailVerificationDeliveryPort: new TransactionalEmailVerificationDeliveryAdapter(),
    passwordResetDeliveryPort: new TransactionalPasswordResetDeliveryAdapter(),
    twoFactorProvisioningPort: inMemoryTwoFactorProvisioningAdapter
  };
}

export const authDeliveryRegistry = createAuthDeliveryRegistry();
