import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';
import { PLATFORM_SETTINGS_SINGLETON_KEY } from '@/core/platform/settings/types/platform-settings.types';

const platformSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: PLATFORM_SETTINGS_SINGLETON_KEY
    },
    branding: {
      applicationName: {
        type: String,
        required: true,
        trim: true
      },
      supportEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
      },
      supportUrl: {
        type: String,
        default: null,
        trim: true
      }
    },
    localization: {
      defaultTimezone: {
        type: String,
        required: true,
        trim: true
      },
      defaultCurrency: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
      },
      defaultLanguage: {
        type: String,
        required: true,
        trim: true
      }
    },
    security: {
      allowUserRegistration: {
        type: Boolean,
        required: true
      },
      requireEmailVerification: {
        type: Boolean,
        required: true
      }
    },
    operations: {
      maintenanceMode: {
        type: Boolean,
        required: true
      }
    },
    modules: {
      disabledModuleKeys: {
        type: [String],
        default: []
      }
    },
    featureFlags: {
      disabledFeatureFlagKeys: {
        type: [String],
        default: []
      }
    }
  },
  {
    collection: 'platform_settings'
  }
);

platformSettingsSchema.plugin(baseDocumentPlugin);

export type PlatformSettingsDocument = HydratedDocument<InferSchemaType<typeof platformSettingsSchema>>;

export const PlatformSettingsModel = model<PlatformSettingsDocument>(
  'PlatformSettings',
  platformSettingsSchema
);
