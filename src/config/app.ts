export const APP_CONFIG = {
  API_PREFIX: '/api/v1',
  AUTH_BASE_PATH: '/auth',
  AUDIT_BASE_PATH: '/audit',
  BILLING_BASE_PATH: '/billing',
  MODULES_BASE_PATH: '/modules',
  PLATFORM_BASE_PATH: '/platform',
  TENANT_BASE_PATH: '/tenant',
  HEALTH_PATH: '/health',
  TRACE_ID_HEADER: 'X-Trace-Id',
  CSRF_HEADER: 'X-CSRF-Token',
  TENANT_ID_HEADER: 'X-Tenant-Id'
} as const;
