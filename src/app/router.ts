import { Router } from 'express';

import { APP_CONFIG } from '@/config/app';
import { auditRouter } from '@/core/platform/audit/routes/audit.routes';
import { authRouter } from '@/core/platform/auth/routes/auth.routes';
import { platformSettingsRouter } from '@/core/platform/settings/routes/platform-settings.routes';
import { healthRouter } from '@/core/shared/routes/health.routes';
import { tenantRouter } from '@/core/tenant/routes/tenant.routes';
import { modulesRouter } from '@/modules/routes/modules.routes';

export const rootRouter = Router();
export const apiV1Router = Router();

rootRouter.use(APP_CONFIG.HEALTH_PATH, healthRouter);
rootRouter.use(APP_CONFIG.API_PREFIX, apiV1Router);
apiV1Router.use(APP_CONFIG.AUTH_BASE_PATH, authRouter);
apiV1Router.use(APP_CONFIG.AUDIT_BASE_PATH, auditRouter);
apiV1Router.use(APP_CONFIG.MODULES_BASE_PATH, modulesRouter);
apiV1Router.use(APP_CONFIG.PLATFORM_BASE_PATH, platformSettingsRouter);
apiV1Router.use(APP_CONFIG.TENANT_BASE_PATH, tenantRouter);
