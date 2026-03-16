import { z } from 'zod';

import { loadEnvironmentVariables } from '@/config/load-env';

loadEnvironmentVariables();

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export type AppEnvironment = z.infer<typeof nodeEnvSchema>;

const dbConnectMaxRetriesDefaultsByEnv = {
  development: 3,
  test: 0,
  production: 0
} as const satisfies Record<AppEnvironment, number>;

const dbConnectRetryDelayDefaultsByEnv = {
  development: 1000,
  test: 250,
  production: 250
} as const satisfies Record<AppEnvironment, number>;

const goLiveEnforceProdDeliveryAdaptersDefaultsByEnv = {
  development: false,
  test: false,
  production: true
} as const satisfies Record<AppEnvironment, boolean>;

const emailProviderDefaultsByEnv = {
  development: 'mailpit',
  test: 'mailpit',
  production: 'resend'
} as const satisfies Record<AppEnvironment, 'mailpit' | 'resend'>;

const billingProviderDefaultsByEnv = {
  development: 'simulated',
  test: 'simulated',
  production: 'stripe'
} as const satisfies Record<AppEnvironment, 'simulated' | 'stripe'>;

const inventoryReconciliationMonitorEnabledDefaultsByEnv = {
  development: false,
  test: false,
  production: false
} as const satisfies Record<AppEnvironment, boolean>;

const inventoryReconciliationAlertDriftConsecutiveThresholdDefaultsByEnv = {
  development: 3,
  test: 3,
  production: 3
} as const satisfies Record<AppEnvironment, number>;

const inventoryReconciliationAlertFailureConsecutiveThresholdDefaultsByEnv = {
  development: 2,
  test: 2,
  production: 2
} as const satisfies Record<AppEnvironment, number>;

const inventoryReconciliationAlertSkippedTicksThresholdDefaultsByEnv = {
  development: 3,
  test: 3,
  production: 3
} as const satisfies Record<AppEnvironment, number>;

const runtimeNodeEnv = nodeEnvSchema.parse(process.env.NODE_ENV);

const optionalHttpUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z
    .string()
    .url()
    .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
      message: 'Must be an http:// or https:// URL'
    })
    .optional()
);

const optionalRedisUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z
    .string()
    .url()
    .refine((value) => value.startsWith('redis://') || value.startsWith('rediss://'), {
      message: 'Must be a redis:// or rediss:// URL'
    })
    .optional()
);
const optionalStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1),
  APP_VERSION: z.string().min(1),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  MONGODB_URI: z.string().min(1),
  MONGODB_URI_TEST: z.string().min(1),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),
  AUTH_ACCESS_COOKIE_NAME: z.string().min(1),
  REFRESH_TOKEN_COOKIE_NAME: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).transform((value) => value === 'true'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']),
  PLATFORM_ADMIN_EMAILS: z.string().default(''),
  CSRF_SECRET: z.string().min(16),
  CSRF_COOKIE_NAME: z.string().min(1),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_GLOBAL: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_MAX_AUTH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_MAX_SENSITIVE: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_REDIS_PREFIX: z.string().min(1).default('rl'),
  REDIS_URL: optionalRedisUrlSchema,
  CORS_ORIGINS: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).transform((value) => value === 'true'),
  GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(String(goLiveEnforceProdDeliveryAdaptersDefaultsByEnv[runtimeNodeEnv]) as 'true' | 'false'),
  EMAIL_PROVIDER: z
    .enum(['mailpit', 'resend'])
    .default(emailProviderDefaultsByEnv[runtimeNodeEnv]),
  EMAIL_FROM: z.string().trim().email(),
  EMAIL_FROM_NAME: optionalStringSchema,
  AUTH_VERIFY_EMAIL_URL: z.string().url(),
  AUTH_RESET_PASSWORD_URL: z.string().url(),
  TENANT_INVITATION_ACCEPT_URL: z.string().url(),
  EMAIL_MAILPIT_SMTP_HOST: z.string().trim().min(1).default('127.0.0.1'),
  EMAIL_MAILPIT_SMTP_PORT: z.coerce.number().int().positive().default(1025),
  EMAIL_RESEND_API_KEY: optionalStringSchema,
  EMAIL_RESEND_API_BASE_URL: z.string().url().default('https://api.resend.com'),
  EMAIL_DELIVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: optionalHttpUrlSchema,
  DELIVERY_WEBHOOK_AUTH_TOKEN: optionalStringSchema,
  DELIVERY_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BILLING_PROVIDER: z.enum(['simulated', 'stripe']).default(billingProviderDefaultsByEnv[runtimeNodeEnv]),
  BILLING_WEBHOOK_SECRET: z.string().min(16).default('dev-billing-webhook-secret'),
  BILLING_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  BILLING_GRACE_PERIOD_DAYS: z.coerce.number().int().min(1).max(60).default(7),
  DB_CONNECT_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(dbConnectMaxRetriesDefaultsByEnv[runtimeNodeEnv]),
  DB_CONNECT_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(dbConnectRetryDelayDefaultsByEnv[runtimeNodeEnv]),
  INVENTORY_RECONCILIATION_MONITOR_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(String(inventoryReconciliationMonitorEnabledDefaultsByEnv[runtimeNodeEnv]) as 'true' | 'false'),
  INVENTORY_RECONCILIATION_MONITOR_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
  INVENTORY_RECONCILIATION_MONITOR_SINCE_DAYS: z.coerce.number().int().min(1).max(30).default(1),
  INVENTORY_RECONCILIATION_MONITOR_TENANT_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  INVENTORY_RECONCILIATION_ALERT_DRIFT_CONSECUTIVE_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(inventoryReconciliationAlertDriftConsecutiveThresholdDefaultsByEnv[runtimeNodeEnv]),
  INVENTORY_RECONCILIATION_ALERT_FAILURE_CONSECUTIVE_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(inventoryReconciliationAlertFailureConsecutiveThresholdDefaultsByEnv[runtimeNodeEnv]),
  INVENTORY_RECONCILIATION_ALERT_SKIPPED_TICKS_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(inventoryReconciliationAlertSkippedTicksThresholdDefaultsByEnv[runtimeNodeEnv])
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`
  );
}

const parsedAndValidatedEnv = parsedEnv.data;

if (parsedAndValidatedEnv.NODE_ENV === 'production') {
  if (parsedAndValidatedEnv.EMAIL_PROVIDER !== 'resend') {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        EMAIL_PROVIDER: ['EMAIL_PROVIDER must be resend in production']
      })}`
    );
  }

  if (parsedAndValidatedEnv.BILLING_PROVIDER !== 'stripe') {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        BILLING_PROVIDER: ['BILLING_PROVIDER must be stripe in production']
      })}`
    );
  }

  if (parsedAndValidatedEnv.BILLING_WEBHOOK_SECRET === 'dev-billing-webhook-secret') {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        BILLING_WEBHOOK_SECRET: ['BILLING_WEBHOOK_SECRET must be customized in production']
      })}`
    );
  }

  if (!parsedAndValidatedEnv.REDIS_URL) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        REDIS_URL: ['REDIS_URL must be configured in production']
      })}`
    );
  }

  const nonHttpsDeliveryKeys = [
    ['AUTH_VERIFY_EMAIL_URL', parsedAndValidatedEnv.AUTH_VERIFY_EMAIL_URL],
    ['AUTH_RESET_PASSWORD_URL', parsedAndValidatedEnv.AUTH_RESET_PASSWORD_URL],
    ['TENANT_INVITATION_ACCEPT_URL', parsedAndValidatedEnv.TENANT_INVITATION_ACCEPT_URL],
    ['AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL', parsedAndValidatedEnv.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL],
    ['EMAIL_RESEND_API_BASE_URL', parsedAndValidatedEnv.EMAIL_RESEND_API_BASE_URL]
  ].filter(([, value]) => typeof value === 'string' && value.startsWith('http://'));

  if (nonHttpsDeliveryKeys.length > 0) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        deliveryUrls: nonHttpsDeliveryKeys.map(([key]) => `${key} must use https:// in production`)
      })}`
    );
  }
}

export const env = parsedAndValidatedEnv;
