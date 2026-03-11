import { env } from '@/config/env';

export const PRODUCTION_DELIVERY_CONFIG_KEYS = [
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'AUTH_VERIFY_EMAIL_URL',
  'AUTH_RESET_PASSWORD_URL',
  'TENANT_INVITATION_ACCEPT_URL',
  'EMAIL_RESEND_API_KEY',
  'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
] as const;

export type ProductionDeliveryConfigKey = (typeof PRODUCTION_DELIVERY_CONFIG_KEYS)[number];

export interface GoLiveReadinessChecks {
  readonly database: boolean;
  readonly productionDeliveryAdapters: boolean;
}

export interface GoLiveConfigurationReadiness {
  readonly ready: boolean;
  readonly checks: Omit<GoLiveReadinessChecks, 'database'>;
  readonly missingProductionDeliveryConfigKeys: readonly ProductionDeliveryConfigKey[];
}

export interface GoLiveReadinessSnapshot {
  readonly ready: boolean;
  readonly checks: GoLiveReadinessChecks;
}

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveMissingProductionDeliveryConfigKeys(
  appEnv: typeof env = env
): readonly ProductionDeliveryConfigKey[] {
  const missingKeys: ProductionDeliveryConfigKey[] = [];
  const provider = hasValue(appEnv.EMAIL_PROVIDER) ? appEnv.EMAIL_PROVIDER.trim() : undefined;

  if (provider !== 'resend') {
    missingKeys.push('EMAIL_PROVIDER');
  }

  if (!hasValue(appEnv.EMAIL_FROM)) {
    missingKeys.push('EMAIL_FROM');
  }

  if (!hasValue(appEnv.AUTH_VERIFY_EMAIL_URL)) {
    missingKeys.push('AUTH_VERIFY_EMAIL_URL');
  }

  if (!hasValue(appEnv.AUTH_RESET_PASSWORD_URL)) {
    missingKeys.push('AUTH_RESET_PASSWORD_URL');
  }

  if (!hasValue(appEnv.TENANT_INVITATION_ACCEPT_URL)) {
    missingKeys.push('TENANT_INVITATION_ACCEPT_URL');
  }

  if (!hasValue(appEnv.EMAIL_RESEND_API_KEY)) {
    missingKeys.push('EMAIL_RESEND_API_KEY');
  }

  if (!hasValue(appEnv.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL)) {
    missingKeys.push('AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL');
  }

  return missingKeys;
}

export function hasProductionDeliveryAdaptersConfigured(appEnv: typeof env = env): boolean {
  return resolveMissingProductionDeliveryConfigKeys(appEnv).length === 0;
}

export function buildGoLiveConfigurationReadiness(
  appEnv: typeof env = env
): GoLiveConfigurationReadiness {
  const isProduction = appEnv.NODE_ENV === 'production';
  const missingProductionDeliveryConfigKeys = isProduction
    ? resolveMissingProductionDeliveryConfigKeys(appEnv)
    : [];
  const productionDeliveryAdapters = isProduction
    ? missingProductionDeliveryConfigKeys.length === 0
    : true;

  return {
    ready: productionDeliveryAdapters,
    checks: {
      productionDeliveryAdapters
    },
    missingProductionDeliveryConfigKeys
  };
}

export function buildGoLiveReadinessSnapshot(
  databaseReady: boolean,
  appEnv: typeof env = env
): GoLiveReadinessSnapshot {
  const configurationReadiness = buildGoLiveConfigurationReadiness(appEnv);

  return {
    ready: databaseReady && configurationReadiness.ready,
    checks: {
      database: databaseReady,
      productionDeliveryAdapters: configurationReadiness.checks.productionDeliveryAdapters
    }
  };
}
