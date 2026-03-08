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
  CORS_ORIGINS: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.enum(['true', 'false']).transform((value) => value === 'true'),
  GO_LIVE_ENFORCE_PROD_DELIVERY_ADAPTERS: z.enum(['true', 'false']).transform((value) => value === 'true')
    .default(String(goLiveEnforceProdDeliveryAdaptersDefaultsByEnv[runtimeNodeEnv]) as 'true' | 'false'),
  AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL: optionalHttpUrlSchema,
  AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL: optionalHttpUrlSchema,
  TENANT_INVITATION_DELIVERY_WEBHOOK_URL: optionalHttpUrlSchema,
  DELIVERY_WEBHOOK_AUTH_TOKEN: optionalStringSchema,
  DELIVERY_WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_CONNECT_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .default(dbConnectMaxRetriesDefaultsByEnv[runtimeNodeEnv]),
  DB_CONNECT_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(dbConnectRetryDelayDefaultsByEnv[runtimeNodeEnv])
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`
  );
}

const parsedAndValidatedEnv = parsedEnv.data;

if (parsedAndValidatedEnv.NODE_ENV === 'production') {
  const nonHttpsDeliveryKeys = [
    ['AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL', parsedAndValidatedEnv.AUTH_EMAIL_VERIFICATION_DELIVERY_WEBHOOK_URL],
    ['AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL', parsedAndValidatedEnv.AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL],
    ['TENANT_INVITATION_DELIVERY_WEBHOOK_URL', parsedAndValidatedEnv.TENANT_INVITATION_DELIVERY_WEBHOOK_URL]
  ].filter(([, value]) => typeof value === 'string' && value.startsWith('http://'));

  if (nonHttpsDeliveryKeys.length > 0) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify({
        deliveryWebhookUrls: nonHttpsDeliveryKeys.map(([key]) => `${key} must use https:// in production`)
      })}`
    );
  }
}

export const env = parsedAndValidatedEnv;
