import { env } from '@/config/env';

export const PRODUCTION_DELIVERY_CONFIG_KEYS = [
  'AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL',
  'AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL',
  'TENANT_INVITATION_DELIVERY_WEBHOOK_URL'
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

  if (!hasValue(appEnv.AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL)) {
    missingKeys.push('AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL');
  }

  if (!hasValue(appEnv.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL)) {
    missingKeys.push('AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL');
  }

  if (!hasValue(appEnv.TENANT_INVITATION_DELIVERY_WEBHOOK_URL)) {
    missingKeys.push('TENANT_INVITATION_DELIVERY_WEBHOOK_URL');
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
