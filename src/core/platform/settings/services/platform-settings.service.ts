import mongoose from 'mongoose';

import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import { systemRbacCatalog } from '@/core/platform/rbac/catalog/system-rbac.catalog';
import { FeatureFlagModel } from '@/core/platform/rbac/models/feature-flag.model';
import { ModuleModel } from '@/core/platform/rbac/models/module.model';
import { PlatformSettingsModel } from '@/core/platform/settings/models/platform-settings.model';
import {
  PLATFORM_SETTINGS_SINGLETON_KEY,
  type GetPlatformSettingsInput,
  type GetPlatformSettingsSnapshotInput,
  type PlatformSettingsServiceContract,
  type PlatformSettingsView,
  type UpdatePlatformSettingsInput,
  type UpdatePlatformSettingsPatch
} from '@/core/platform/settings/types/platform-settings.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function buildPlatformSettingsError(message: string, statusCode: number): AppError {
  return new AppError({
    code:
      statusCode === HTTP_STATUS.NOT_FOUND ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL_ERROR,
    message,
    statusCode
  });
}

function buildPlatformSettingsValidationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
    statusCode: HTTP_STATUS.BAD_REQUEST
  });
}

function buildPlatformScopeMismatchError(): AppError {
  return new AppError({
    code: ERROR_CODES.TENANT_SCOPE_MISMATCH,
    message: 'Platform settings do not accept tenant-scoped context.',
    statusCode: HTTP_STATUS.BAD_REQUEST
  });
}

function assertPlatformOnlyContext(
  context:
    | GetPlatformSettingsInput['context']
    | GetPlatformSettingsSnapshotInput['context']
    | UpdatePlatformSettingsInput['context']
): void {
  if (context?.tenant?.tenantId) {
    throw buildPlatformScopeMismatchError();
  }
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function ensureUniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function canQueryModel(model: { db?: { readyState?: number }; findOne?: unknown }): boolean {
  const findOne = model.findOne as { mock?: unknown } | undefined;

  return model.db?.readyState === 1 || typeof findOne?.mock !== 'undefined';
}

function toPlatformSettingsView(settings: {
  id?: string;
  _id?: { toString: () => string };
  singletonKey: string;
  branding?: {
    applicationName: string;
    supportEmail?: string | null;
    supportUrl?: string | null;
  } | null;
  localization?: {
    defaultTimezone: string;
    defaultCurrency: string;
    defaultLanguage: string;
  } | null;
  security?: {
    allowUserRegistration: boolean;
    requireEmailVerification: boolean;
    requireTwoFactorForPrivilegedUsers?: boolean;
    passwordPolicy?: {
      minLength?: number;
      preventReuseCount?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumber?: boolean;
      requireSpecialChar?: boolean;
    } | null;
    sessionPolicy?: {
      browserSessionTtlMinutes?: number;
      idleTimeoutMinutes?: number | null;
    } | null;
    riskControls?: {
      allowRecoveryCodes?: boolean;
      enforceVerifiedEmailForPrivilegedAccess?: boolean;
    } | null;
  } | null;
  operations?: {
    maintenanceMode: boolean;
  } | null;
  modules?: {
    disabledModuleKeys?: string[];
  } | null;
  featureFlags?: {
    disabledFeatureFlagKeys?: string[];
  } | null;
}): PlatformSettingsView {
  return {
    id: settings.id ?? settings._id?.toString() ?? '',
    singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY,
    branding: {
      applicationName: settings.branding?.applicationName ?? env.APP_NAME,
      supportEmail: settings.branding?.supportEmail ?? null,
      supportUrl: settings.branding?.supportUrl ?? env.FRONTEND_URL
    },
    localization: {
      defaultTimezone: settings.localization?.defaultTimezone ?? 'UTC',
      defaultCurrency: settings.localization?.defaultCurrency ?? 'USD',
      defaultLanguage: settings.localization?.defaultLanguage ?? 'en'
    },
    security: {
      allowUserRegistration: settings.security?.allowUserRegistration ?? true,
      requireEmailVerification: settings.security?.requireEmailVerification ?? true,
      requireTwoFactorForPrivilegedUsers:
        settings.security?.requireTwoFactorForPrivilegedUsers ?? false,
      passwordPolicy: {
        minLength: settings.security?.passwordPolicy?.minLength ?? 12,
        preventReuseCount: settings.security?.passwordPolicy?.preventReuseCount ?? 5,
        requireUppercase: settings.security?.passwordPolicy?.requireUppercase ?? true,
        requireLowercase: settings.security?.passwordPolicy?.requireLowercase ?? true,
        requireNumber: settings.security?.passwordPolicy?.requireNumber ?? true,
        requireSpecialChar: settings.security?.passwordPolicy?.requireSpecialChar ?? false
      },
      sessionPolicy: {
        browserSessionTtlMinutes:
          settings.security?.sessionPolicy?.browserSessionTtlMinutes ?? 1440,
        idleTimeoutMinutes: settings.security?.sessionPolicy?.idleTimeoutMinutes ?? null
      },
      riskControls: {
        allowRecoveryCodes: settings.security?.riskControls?.allowRecoveryCodes ?? true,
        enforceVerifiedEmailForPrivilegedAccess:
          settings.security?.riskControls?.enforceVerifiedEmailForPrivilegedAccess ?? true
      }
    },
    operations: {
      maintenanceMode: settings.operations?.maintenanceMode ?? false
    },
    modules: {
      disabledModuleKeys: ensureUniqueStrings(settings.modules?.disabledModuleKeys ?? [])
    },
    featureFlags: {
      disabledFeatureFlagKeys: ensureUniqueStrings(settings.featureFlags?.disabledFeatureFlagKeys ?? [])
    }
  };
}

function buildDefaultPlatformSettingsSnapshot() {
  return {
    singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY,
    branding: {
      applicationName: env.APP_NAME,
      supportEmail: null,
      supportUrl: env.FRONTEND_URL
    },
    localization: {
      defaultTimezone: 'UTC',
      defaultCurrency: 'USD',
      defaultLanguage: 'en'
    },
    security: {
      allowUserRegistration: true,
      requireEmailVerification: true,
      requireTwoFactorForPrivilegedUsers: false,
      passwordPolicy: {
        minLength: 12,
        preventReuseCount: 5,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: false
      },
      sessionPolicy: {
        browserSessionTtlMinutes: 1440,
        idleTimeoutMinutes: null
      },
      riskControls: {
        allowRecoveryCodes: true,
        enforceVerifiedEmailForPrivilegedAccess: true
      }
    },
    operations: {
      maintenanceMode: false
    },
    modules: {
      disabledModuleKeys: []
    },
    featureFlags: {
      disabledFeatureFlagKeys: []
    }
  };
}

function mergePlatformSettingsView(
  current: PlatformSettingsView,
  patch: UpdatePlatformSettingsPatch
): Omit<PlatformSettingsView, 'id'> {
  return {
    singletonKey: current.singletonKey,
    branding: {
      applicationName: patch.branding?.applicationName ?? current.branding.applicationName,
      supportEmail:
        typeof patch.branding?.supportEmail === 'undefined'
          ? current.branding.supportEmail
          : patch.branding.supportEmail,
      supportUrl:
        typeof patch.branding?.supportUrl === 'undefined'
          ? current.branding.supportUrl
          : patch.branding.supportUrl
    },
    localization: {
      defaultTimezone: patch.localization?.defaultTimezone ?? current.localization.defaultTimezone,
      defaultCurrency: patch.localization?.defaultCurrency ?? current.localization.defaultCurrency,
      defaultLanguage: patch.localization?.defaultLanguage ?? current.localization.defaultLanguage
    },
    security: {
      allowUserRegistration:
        patch.security?.allowUserRegistration ?? current.security.allowUserRegistration,
      requireEmailVerification:
        patch.security?.requireEmailVerification ?? current.security.requireEmailVerification,
      requireTwoFactorForPrivilegedUsers:
        patch.security?.requireTwoFactorForPrivilegedUsers ??
        current.security.requireTwoFactorForPrivilegedUsers,
      passwordPolicy: {
        minLength:
          patch.security?.passwordPolicy?.minLength ?? current.security.passwordPolicy.minLength,
        preventReuseCount:
          patch.security?.passwordPolicy?.preventReuseCount ??
          current.security.passwordPolicy.preventReuseCount,
        requireUppercase:
          patch.security?.passwordPolicy?.requireUppercase ??
          current.security.passwordPolicy.requireUppercase,
        requireLowercase:
          patch.security?.passwordPolicy?.requireLowercase ??
          current.security.passwordPolicy.requireLowercase,
        requireNumber:
          patch.security?.passwordPolicy?.requireNumber ??
          current.security.passwordPolicy.requireNumber,
        requireSpecialChar:
          patch.security?.passwordPolicy?.requireSpecialChar ??
          current.security.passwordPolicy.requireSpecialChar
      },
      sessionPolicy: {
        browserSessionTtlMinutes:
          patch.security?.sessionPolicy?.browserSessionTtlMinutes ??
          current.security.sessionPolicy.browserSessionTtlMinutes,
        idleTimeoutMinutes:
          typeof patch.security?.sessionPolicy?.idleTimeoutMinutes === 'undefined'
            ? current.security.sessionPolicy.idleTimeoutMinutes
            : patch.security.sessionPolicy.idleTimeoutMinutes
      },
      riskControls: {
        allowRecoveryCodes:
          patch.security?.riskControls?.allowRecoveryCodes ??
          current.security.riskControls.allowRecoveryCodes,
        enforceVerifiedEmailForPrivilegedAccess:
          patch.security?.riskControls?.enforceVerifiedEmailForPrivilegedAccess ??
          current.security.riskControls.enforceVerifiedEmailForPrivilegedAccess
      }
    },
    operations: {
      maintenanceMode: patch.operations?.maintenanceMode ?? current.operations.maintenanceMode
    },
    modules: {
      disabledModuleKeys:
        patch.modules?.disabledModuleKeys
          ? ensureUniqueStrings(patch.modules.disabledModuleKeys)
          : current.modules.disabledModuleKeys
    },
    featureFlags: {
      disabledFeatureFlagKeys:
        patch.featureFlags?.disabledFeatureFlagKeys
          ? ensureUniqueStrings(patch.featureFlags.disabledFeatureFlagKeys)
          : current.featureFlags.disabledFeatureFlagKeys
    }
  };
}

function assertSecurityRanges(security: PlatformSettingsView['security']): void {
  if (security.passwordPolicy.minLength < 8 || security.passwordPolicy.minLength > 128) {
    throw buildPlatformSettingsValidationError('security.passwordPolicy.minLength must be between 8 and 128');
  }

  if (security.passwordPolicy.preventReuseCount < 0 || security.passwordPolicy.preventReuseCount > 24) {
    throw buildPlatformSettingsValidationError('security.passwordPolicy.preventReuseCount must be between 0 and 24');
  }

  if (security.sessionPolicy.browserSessionTtlMinutes < 5 || security.sessionPolicy.browserSessionTtlMinutes > 43200) {
    throw buildPlatformSettingsValidationError('security.sessionPolicy.browserSessionTtlMinutes must be between 5 and 43200');
  }

  if (
    security.sessionPolicy.idleTimeoutMinutes !== null &&
    (security.sessionPolicy.idleTimeoutMinutes < 1 || security.sessionPolicy.idleTimeoutMinutes > 43200)
  ) {
    throw buildPlatformSettingsValidationError('security.sessionPolicy.idleTimeoutMinutes must be null or between 1 and 43200');
  }
}

export class PlatformSettingsService implements PlatformSettingsServiceContract {
  constructor(private readonly audit: AuditService = auditService) {}

  async getSettings(input: GetPlatformSettingsInput = {}): Promise<PlatformSettingsView> {
    assertPlatformOnlyContext(input.context);

    const existingSettings = await this.getSettingsSnapshot(input);

    if (existingSettings) {
      return existingSettings;
    }

    const session = await mongoose.startSession();

    try {
      let view: PlatformSettingsView | null = null;

      try {
        await session.withTransaction(async () => {
          const [createdSettings] = await PlatformSettingsModel.create(
            [buildDefaultPlatformSettingsSnapshot()],
            { session }
          );

          view = toPlatformSettingsView(createdSettings.toObject());

          await this.recordAuditLog(
            {
              context: input.context,
              action: 'platform.settings.bootstrap',
              resource: {
                type: 'platform_settings',
                id: createdSettings._id.toString()
              },
              severity: 'warning',
              changes: {
                after: this.toAuditSettingsSnapshot(view)
              }
            },
            { session }
          );
        });
      } catch (error) {
        if (!isMongoDuplicateKeyError(error)) {
          throw error;
        }
      }

      if (view) {
        return view;
      }

      const duplicatedSettings = await PlatformSettingsModel.findOne({
        singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY
      }).lean();

      if (!duplicatedSettings) {
        throw buildPlatformSettingsError(
          'Platform settings bootstrap did not produce a singleton',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return toPlatformSettingsView(duplicatedSettings);
    } finally {
      await session.endSession();
    }
  }

  async getSettingsSnapshot(
    input: GetPlatformSettingsSnapshotInput = {}
  ): Promise<PlatformSettingsView | null> {
    assertPlatformOnlyContext(input.context);

    const existingSettings = await PlatformSettingsModel.findOne({
      singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY
    });

    if (!existingSettings) {
      return null;
    }

    return toPlatformSettingsView(existingSettings.toObject());
  }

  async updateSettings(input: UpdatePlatformSettingsInput): Promise<PlatformSettingsView> {
    assertPlatformOnlyContext(input.context);

    const session = await mongoose.startSession();

    try {
      let nextView: PlatformSettingsView | null = null;

      await session.withTransaction(async () => {
        let settings = await PlatformSettingsModel.findOne({
          singletonKey: PLATFORM_SETTINGS_SINGLETON_KEY
        }).session(session);

        if (!settings) {
          const createdSettings = await PlatformSettingsModel.create(
            [buildDefaultPlatformSettingsSnapshot()],
            { session }
          );
          settings = createdSettings[0];
        }

        if (!settings) {
          throw buildPlatformSettingsError(
            'Platform settings singleton could not be created for update',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        const before = toPlatformSettingsView(settings.toObject());
        const merged = mergePlatformSettingsView(before, input.patch);
        assertSecurityRanges(merged.security);

        await Promise.all([
          this.assertValidModuleKeys(merged.modules.disabledModuleKeys),
          this.assertValidFeatureFlagKeys(merged.featureFlags.disabledFeatureFlagKeys)
        ]);

        settings.branding = merged.branding;
        settings.localization = merged.localization;
        settings.security = merged.security;
        settings.operations = merged.operations;
        settings.modules = merged.modules;
        settings.featureFlags = merged.featureFlags;
        await settings.save({ session });

        nextView = toPlatformSettingsView(settings.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'platform.settings.update',
            resource: {
              type: 'platform_settings',
              id: settings._id.toString()
            },
            severity: 'warning',
            changes: {
              before: this.toAuditSettingsSnapshot(before),
              after: this.toAuditSettingsSnapshot(nextView),
              fields: Object.keys(input.patch)
            }
          },
          { session }
        );
      });

      if (!nextView) {
        throw buildPlatformSettingsError(
          'Platform settings update did not produce a singleton view',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return nextView;
    } finally {
      await session.endSession();
    }
  }

  private toAuditSettingsSnapshot(view: PlatformSettingsView): AuditJsonObject {
    return {
      branding: {
        applicationName: view.branding.applicationName,
        supportEmail: view.branding.supportEmail,
        supportUrl: view.branding.supportUrl
      },
      localization: {
        defaultTimezone: view.localization.defaultTimezone,
        defaultCurrency: view.localization.defaultCurrency,
        defaultLanguage: view.localization.defaultLanguage
      },
      security: {
        allowUserRegistration: view.security.allowUserRegistration,
        requireEmailVerification: view.security.requireEmailVerification,
        requireTwoFactorForPrivilegedUsers: view.security.requireTwoFactorForPrivilegedUsers,
        passwordPolicy: { ...view.security.passwordPolicy },
        sessionPolicy: { ...view.security.sessionPolicy },
        riskControls: { ...view.security.riskControls }
      },
      operations: {
        maintenanceMode: view.operations.maintenanceMode
      },
      modules: {
        disabledModuleKeys: [...view.modules.disabledModuleKeys]
      },
      featureFlags: {
        disabledFeatureFlagKeys: [...view.featureFlags.disabledFeatureFlagKeys]
      }
    };
  }

  private async recordAuditLog(
    input: {
      context?: GetPlatformSettingsInput['context'];
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }

  private async assertValidModuleKeys(moduleKeys: string[]): Promise<void> {
    const invalidKeys = (
      await Promise.all(
        ensureUniqueStrings(moduleKeys).map(async (moduleKey) => {
          const systemModule = systemRbacCatalog.getModule(moduleKey);

          if (systemModule) {
            return null;
          }

          if (!canQueryModel(ModuleModel)) {
            return moduleKey;
          }

          const module = await ModuleModel.findOne({ key: moduleKey }).lean();

          return module ? null : moduleKey;
        })
      )
    ).filter((moduleKey): moduleKey is string => Boolean(moduleKey));

    if (invalidKeys.length > 0) {
      throw buildPlatformSettingsValidationError(
        `Unknown platform module keys: ${invalidKeys.join(', ')}`
      );
    }
  }

  private async assertValidFeatureFlagKeys(featureFlagKeys: string[]): Promise<void> {
    const invalidKeys = (
      await Promise.all(
        ensureUniqueStrings(featureFlagKeys).map(async (featureFlagKey) => {
          const systemFeatureFlag = systemRbacCatalog.getFeatureFlag(featureFlagKey);

          if (systemFeatureFlag) {
            return null;
          }

          if (!canQueryModel(FeatureFlagModel)) {
            return featureFlagKey;
          }

          const featureFlag = await FeatureFlagModel.findOne({ key: featureFlagKey }).lean();

          return featureFlag ? null : featureFlagKey;
        })
      )
    ).filter((featureFlagKey): featureFlagKey is string => Boolean(featureFlagKey));

    if (invalidKeys.length > 0) {
      throw buildPlatformSettingsValidationError(
        `Unknown platform feature flag keys: ${invalidKeys.join(', ')}`
      );
    }
  }
}

export const platformSettingsService = new PlatformSettingsService();
