import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const TENANT_SETTINGS_SINGLETON_KEY = 'tenant_settings';

export interface TenantSettingsBranding {
  displayName: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
}

export interface TenantSettingsLocalization {
  defaultTimezone: string | null;
  defaultCurrency: string | null;
  defaultLanguage: string | null;
}

export interface TenantSettingsContact {
  primaryEmail: string | null;
  phone: string | null;
  websiteUrl: string | null;
}

export interface TenantSettingsBilling {
  billingEmail: string | null;
  legalName: string | null;
  taxId: string | null;
}

export interface TenantSettingsView {
  id: string;
  tenantId: string;
  singletonKey: typeof TENANT_SETTINGS_SINGLETON_KEY;
  branding: TenantSettingsBranding;
  localization: TenantSettingsLocalization;
  contact: TenantSettingsContact;
  billing: TenantSettingsBilling;
}

export interface TenantSettingsEffectiveBranding {
  displayName: string;
  supportEmail: string | null;
  supportUrl: string | null;
}

export interface TenantSettingsEffectiveLocalization {
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
}

export interface TenantSettingsRuntime {
  planId: string | null;
  activeModuleKeys: string[];
  enabledModuleKeys: string[];
  featureFlagKeys: string[];
}

export interface TenantSettingsEffectiveView {
  tenantId: string;
  branding: TenantSettingsEffectiveBranding;
  localization: TenantSettingsEffectiveLocalization;
  contact: TenantSettingsContact;
  billing: TenantSettingsBilling;
  runtime: TenantSettingsRuntime;
}

export interface GetTenantSettingsInput {
  tenantId: string;
  context?: ExecutionContext;
}

export interface UpdateTenantSettingsPatch {
  branding?: Partial<TenantSettingsBranding>;
  localization?: Partial<TenantSettingsLocalization>;
  contact?: Partial<TenantSettingsContact>;
  billing?: Partial<TenantSettingsBilling>;
}

export interface UpdateTenantSettingsInput {
  tenantId: string;
  patch: UpdateTenantSettingsPatch;
  context?: ExecutionContext;
}

export interface GetEffectiveTenantSettingsInput {
  tenantId: string;
  context?: ExecutionContext;
}

export interface TenantSettingsServiceContract {
  getSettings: (input: GetTenantSettingsInput) => Promise<TenantSettingsView>;
  updateSettings: (input: UpdateTenantSettingsInput) => Promise<TenantSettingsView>;
  getEffectiveSettings: (
    input: GetEffectiveTenantSettingsInput
  ) => Promise<TenantSettingsEffectiveView>;
}
