import mongoose, { Types } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import {
  platformSettingsService
} from '@/core/platform/settings/services/platform-settings.service';
import { type PlatformSettingsServiceContract } from '@/core/platform/settings/types/platform-settings.types';
import { rbacService } from '@/core/platform/rbac/services/rbac.service';
import { type RbacServiceContract } from '@/core/platform/rbac/types/rbac.types';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TenantSettingsModel } from '@/core/tenant/settings/models/tenant-settings.model';
import {
  TENANT_SETTINGS_SINGLETON_KEY,
  type GetEffectiveTenantSettingsInput,
  type GetTenantSettingsInput,
  type TenantSettingsEffectiveView,
  type TenantSettingsServiceContract,
  type TenantSettingsView,
  type UpdateTenantSettingsInput,
  type UpdateTenantSettingsPatch
} from '@/core/tenant/settings/types/tenant-settings.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function buildTenantSettingsError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function toTenantSettingsView(settings: {
  id?: string;
  _id?: { toString: () => string };
  tenantId: Types.ObjectId | string;
  branding?: {
    displayName?: string | null;
    supportEmail?: string | null;
    supportUrl?: string | null;
  } | null;
  localization?: {
    defaultTimezone?: string | null;
    defaultCurrency?: string | null;
    defaultLanguage?: string | null;
  } | null;
  contact?: {
    primaryEmail?: string | null;
    phone?: string | null;
    websiteUrl?: string | null;
  } | null;
  billing?: {
    billingEmail?: string | null;
    legalName?: string | null;
    taxId?: string | null;
  } | null;
}): TenantSettingsView {
  return {
    id: settings.id ?? settings._id?.toString() ?? '',
    tenantId:
      typeof settings.tenantId === 'string' ? settings.tenantId : settings.tenantId.toString(),
    singletonKey: TENANT_SETTINGS_SINGLETON_KEY,
    branding: {
      displayName: settings.branding?.displayName ?? null,
      supportEmail: settings.branding?.supportEmail ?? null,
      supportUrl: settings.branding?.supportUrl ?? null
    },
    localization: {
      defaultTimezone: settings.localization?.defaultTimezone ?? null,
      defaultCurrency: settings.localization?.defaultCurrency ?? null,
      defaultLanguage: settings.localization?.defaultLanguage ?? null
    },
    contact: {
      primaryEmail: settings.contact?.primaryEmail ?? null,
      phone: settings.contact?.phone ?? null,
      websiteUrl: settings.contact?.websiteUrl ?? null
    },
    billing: {
      billingEmail: settings.billing?.billingEmail ?? null,
      legalName: settings.billing?.legalName ?? null,
      taxId: settings.billing?.taxId ?? null
    }
  };
}

function buildDefaultTenantSettingsSnapshot(tenantId: string) {
  return {
    tenantId: new Types.ObjectId(tenantId),
    singletonKey: TENANT_SETTINGS_SINGLETON_KEY,
    branding: {
      displayName: null,
      supportEmail: null,
      supportUrl: null
    },
    localization: {
      defaultTimezone: null,
      defaultCurrency: null,
      defaultLanguage: null
    },
    contact: {
      primaryEmail: null,
      phone: null,
      websiteUrl: null
    },
    billing: {
      billingEmail: null,
      legalName: null,
      taxId: null
    }
  };
}

function mergeTenantSettingsView(
  current: TenantSettingsView,
  patch: UpdateTenantSettingsPatch
): Omit<TenantSettingsView, 'id'> {
  return {
    tenantId: current.tenantId,
    singletonKey: current.singletonKey,
    branding: {
      displayName:
        typeof patch.branding?.displayName === 'undefined'
          ? current.branding.displayName
          : patch.branding.displayName,
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
      defaultTimezone:
        typeof patch.localization?.defaultTimezone === 'undefined'
          ? current.localization.defaultTimezone
          : patch.localization.defaultTimezone,
      defaultCurrency:
        typeof patch.localization?.defaultCurrency === 'undefined'
          ? current.localization.defaultCurrency
          : patch.localization.defaultCurrency,
      defaultLanguage:
        typeof patch.localization?.defaultLanguage === 'undefined'
          ? current.localization.defaultLanguage
          : patch.localization.defaultLanguage
    },
    contact: {
      primaryEmail:
        typeof patch.contact?.primaryEmail === 'undefined'
          ? current.contact.primaryEmail
          : patch.contact.primaryEmail,
      phone:
        typeof patch.contact?.phone === 'undefined'
          ? current.contact.phone
          : patch.contact.phone,
      websiteUrl:
        typeof patch.contact?.websiteUrl === 'undefined'
          ? current.contact.websiteUrl
          : patch.contact.websiteUrl
    },
    billing: {
      billingEmail:
        typeof patch.billing?.billingEmail === 'undefined'
          ? current.billing.billingEmail
          : patch.billing.billingEmail,
      legalName:
        typeof patch.billing?.legalName === 'undefined'
          ? current.billing.legalName
          : patch.billing.legalName,
      taxId:
        typeof patch.billing?.taxId === 'undefined'
          ? current.billing.taxId
          : patch.billing.taxId
    }
  };
}

function toAuditSettingsSnapshot(view: TenantSettingsView): AuditJsonObject {
  return {
    branding: {
      displayName: view.branding.displayName,
      supportEmail: view.branding.supportEmail,
      supportUrl: view.branding.supportUrl
    },
    localization: {
      defaultTimezone: view.localization.defaultTimezone,
      defaultCurrency: view.localization.defaultCurrency,
      defaultLanguage: view.localization.defaultLanguage
    },
    contact: {
      primaryEmail: view.contact.primaryEmail,
      phone: view.contact.phone,
      websiteUrl: view.contact.websiteUrl
    },
    billing: {
      billingEmail: view.billing.billingEmail,
      legalName: view.billing.legalName,
      taxId: view.billing.taxId
    }
  };
}

export class TenantSettingsService implements TenantSettingsServiceContract {
  constructor(
    private readonly platformSettings: PlatformSettingsServiceContract = platformSettingsService,
    private readonly authorization: RbacServiceContract = rbacService,
    private readonly audit: AuditService = auditService
  ) {}

  async getSettings(input: GetTenantSettingsInput): Promise<TenantSettingsView> {
    await this.assertTenantExists(input.tenantId);

    const existingSettings = await TenantSettingsModel.findOne({
      tenantId: new Types.ObjectId(input.tenantId)
    });

    if (existingSettings) {
      return toTenantSettingsView(existingSettings.toObject());
    }

    const session = await mongoose.startSession();

    try {
      let view: TenantSettingsView | null = null;

      try {
        await session.withTransaction(async () => {
          const [createdSettings] = await TenantSettingsModel.create(
            [buildDefaultTenantSettingsSnapshot(input.tenantId)],
            { session }
          );

          view = toTenantSettingsView(createdSettings.toObject());

          await this.recordAuditLog(
            {
              context: input.context,
              action: 'tenant.settings.bootstrap',
              resource: {
                type: 'tenant_settings',
                id: createdSettings._id.toString()
              },
              severity: 'info',
              changes: {
                after: toAuditSettingsSnapshot(view)
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

      const duplicatedSettings = await TenantSettingsModel.findOne({
        tenantId: new Types.ObjectId(input.tenantId)
      }).lean();

      if (!duplicatedSettings) {
        throw buildTenantSettingsError(
          ERROR_CODES.INTERNAL_ERROR,
          'Tenant settings bootstrap did not produce a singleton',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return toTenantSettingsView(duplicatedSettings);
    } finally {
      await session.endSession();
    }
  }

  async updateSettings(input: UpdateTenantSettingsInput): Promise<TenantSettingsView> {
    await this.assertTenantExists(input.tenantId);

    const session = await mongoose.startSession();

    try {
      let nextView: TenantSettingsView | null = null;

      await session.withTransaction(async () => {
        let settings = await TenantSettingsModel.findOne({
          tenantId: new Types.ObjectId(input.tenantId)
        }).session(session);

        if (!settings) {
          const createdSettings = await TenantSettingsModel.create(
            [buildDefaultTenantSettingsSnapshot(input.tenantId)],
            { session }
          );
          settings = createdSettings[0];
        }

        if (!settings) {
          throw buildTenantSettingsError(
            ERROR_CODES.INTERNAL_ERROR,
            'Tenant settings singleton could not be created for update',
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        const before = toTenantSettingsView(settings.toObject());
        const merged = mergeTenantSettingsView(before, input.patch);

        settings.branding = merged.branding;
        settings.localization = merged.localization;
        settings.contact = merged.contact;
        settings.billing = merged.billing;
        await settings.save({ session });

        nextView = toTenantSettingsView(settings.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            action: 'tenant.settings.update',
            resource: {
              type: 'tenant_settings',
              id: settings._id.toString()
            },
            severity: 'info',
            changes: {
              before: toAuditSettingsSnapshot(before),
              after: toAuditSettingsSnapshot(nextView),
              fields: Object.keys(input.patch)
            }
          },
          { session }
        );
      });

      if (!nextView) {
        throw buildTenantSettingsError(
          ERROR_CODES.INTERNAL_ERROR,
          'Tenant settings update did not produce a singleton view',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return nextView;
    } finally {
      await session.endSession();
    }
  }

  async getEffectiveSettings(
    input: GetEffectiveTenantSettingsInput
  ): Promise<TenantSettingsEffectiveView> {
    const tenant = await TenantModel.findById(input.tenantId).lean();

    if (!tenant) {
      throw buildTenantSettingsError(
        ERROR_CODES.TENANT_NOT_FOUND,
        'Tenant not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const [tenantSettings, platformSettingsSnapshot] = await Promise.all([
      this.getSettings({
        tenantId: input.tenantId,
        context: input.context
      }),
      this.platformSettings.getSettingsSnapshot()
    ]);

    if (!platformSettingsSnapshot) {
      throw buildTenantSettingsError(
        ERROR_CODES.INTERNAL_ERROR,
        'Platform settings must be initialized before resolving effective tenant settings',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const resolvedRuntime = await this.authorization.resolveTenantRuntime({
      planId: tenant.planId ?? null,
      activeModuleKeys: tenant.activeModuleKeys ?? [],
      disabledModuleKeys: platformSettingsSnapshot.modules.disabledModuleKeys,
      disabledFeatureFlagKeys: platformSettingsSnapshot.featureFlags.disabledFeatureFlagKeys
    });

    return {
      tenantId: tenant._id.toString(),
      branding: {
        displayName: tenantSettings.branding.displayName ?? tenant.name,
        supportEmail:
          tenantSettings.branding.supportEmail ?? platformSettingsSnapshot.branding.supportEmail,
        supportUrl:
          tenantSettings.branding.supportUrl ?? platformSettingsSnapshot.branding.supportUrl
      },
      localization: {
        defaultTimezone:
          tenantSettings.localization.defaultTimezone ??
          platformSettingsSnapshot.localization.defaultTimezone,
        defaultCurrency:
          tenantSettings.localization.defaultCurrency ??
          platformSettingsSnapshot.localization.defaultCurrency,
        defaultLanguage:
          tenantSettings.localization.defaultLanguage ??
          platformSettingsSnapshot.localization.defaultLanguage
      },
      contact: {
        ...tenantSettings.contact
      },
      billing: {
        ...tenantSettings.billing
      },
      runtime: {
        planId: resolvedRuntime.plan?.key ?? null,
        activeModuleKeys: resolvedRuntime.activeModuleKeys,
        enabledModuleKeys: resolvedRuntime.enabledModuleKeys,
        featureFlagKeys: resolvedRuntime.featureFlagKeys
      }
    };
  }

  private async assertTenantExists(tenantId: string): Promise<void> {
    if (!Types.ObjectId.isValid(tenantId)) {
      throw buildTenantSettingsError(
        ERROR_CODES.TENANT_NOT_FOUND,
        'Tenant not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const tenant = await TenantModel.findById(tenantId).lean();

    if (!tenant) {
      throw buildTenantSettingsError(
        ERROR_CODES.TENANT_NOT_FOUND,
        'Tenant not found',
        HTTP_STATUS.NOT_FOUND
      );
    }
  }
  private async recordAuditLog(
    input: {
      context?: GetTenantSettingsInput['context'];
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
}

export const tenantSettingsService = new TenantSettingsService();
