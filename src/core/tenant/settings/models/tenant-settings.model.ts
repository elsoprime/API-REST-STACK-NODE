import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { TENANT_SETTINGS_SINGLETON_KEY } from '@/core/tenant/settings/types/tenant-settings.types';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const tenantSettingsSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true
    },
    singletonKey: {
      type: String,
      required: true,
      default: TENANT_SETTINGS_SINGLETON_KEY
    },
    branding: {
      displayName: {
        type: String,
        default: null,
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
        default: null,
        trim: true
      },
      defaultCurrency: {
        type: String,
        default: null,
        trim: true,
        uppercase: true
      },
      defaultLanguage: {
        type: String,
        default: null,
        trim: true
      }
    },
    contact: {
      primaryEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
      },
      phone: {
        type: String,
        default: null,
        trim: true
      },
      websiteUrl: {
        type: String,
        default: null,
        trim: true
      }
    },
    billing: {
      billingEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
      },
      legalName: {
        type: String,
        default: null,
        trim: true
      },
      taxId: {
        type: String,
        default: null,
        trim: true
      }
    }
  },
  {
    collection: 'tenant_settings'
  }
);

tenantSettingsSchema.plugin(baseDocumentPlugin);

export type TenantSettingsDocument = HydratedDocument<InferSchemaType<typeof tenantSettingsSchema>>;

export const TenantSettingsModel = model<TenantSettingsDocument>(
  'TenantSettings',
  tenantSettingsSchema
);
