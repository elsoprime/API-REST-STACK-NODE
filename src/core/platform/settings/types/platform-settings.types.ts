import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const PLATFORM_SETTINGS_SINGLETON_KEY = 'platform_settings';

export interface PlatformSettingsBranding {
  applicationName: string;
  supportEmail: string | null;
  supportUrl: string | null;
}

export interface PlatformSettingsLocalization {
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
}

export interface PlatformSettingsPasswordPolicy {
  minLength: number;
  preventReuseCount: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
}

export interface PlatformSettingsSessionPolicy {
  browserSessionTtlMinutes: number;
  idleTimeoutMinutes: number | null;
}

export interface PlatformSettingsRiskControls {
  allowRecoveryCodes: boolean;
  enforceVerifiedEmailForPrivilegedAccess: boolean;
}

export interface PlatformSettingsSecurity {
  allowUserRegistration: boolean;
  requireEmailVerification: boolean;
  requireTwoFactorForPrivilegedUsers: boolean;
  passwordPolicy: PlatformSettingsPasswordPolicy;
  sessionPolicy: PlatformSettingsSessionPolicy;
  riskControls: PlatformSettingsRiskControls;
}

export interface PlatformSettingsOperations {
  maintenanceMode: boolean;
}

export interface PlatformSettingsModules {
  disabledModuleKeys: string[];
}

export interface PlatformSettingsFeatureFlags {
  disabledFeatureFlagKeys: string[];
}

export interface PlatformSettingsView {
  id: string;
  singletonKey: typeof PLATFORM_SETTINGS_SINGLETON_KEY;
  branding: PlatformSettingsBranding;
  localization: PlatformSettingsLocalization;
  security: PlatformSettingsSecurity;
  operations: PlatformSettingsOperations;
  modules: PlatformSettingsModules;
  featureFlags: PlatformSettingsFeatureFlags;
}

export interface GetPlatformSettingsInput {
  context?: ExecutionContext;
}

export interface GetPlatformSettingsSnapshotInput {
  context?: ExecutionContext;
}

export interface UpdatePlatformSettingsPatch {
  branding?: Partial<PlatformSettingsBranding>;
  localization?: Partial<PlatformSettingsLocalization>;
  security?: {
    allowUserRegistration?: boolean;
    requireEmailVerification?: boolean;
    requireTwoFactorForPrivilegedUsers?: boolean;
    passwordPolicy?: Partial<PlatformSettingsPasswordPolicy>;
    sessionPolicy?: Partial<PlatformSettingsSessionPolicy>;
    riskControls?: Partial<PlatformSettingsRiskControls>;
  };
  operations?: Partial<PlatformSettingsOperations>;
  modules?: {
    disabledModuleKeys?: string[];
  };
  featureFlags?: {
    disabledFeatureFlagKeys?: string[];
  };
}

export interface UpdatePlatformSettingsInput {
  patch: UpdatePlatformSettingsPatch;
  context?: ExecutionContext;
}

export interface PlatformSettingsServiceContract {
  getSettings: (input?: GetPlatformSettingsInput) => Promise<PlatformSettingsView>;
  getSettingsSnapshot: (
    input?: GetPlatformSettingsSnapshotInput
  ) => Promise<PlatformSettingsView | null>;
  updateSettings: (input: UpdatePlatformSettingsInput) => Promise<PlatformSettingsView>;
}
