import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const userSecuritySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationTokenHash: {
      type: String,
      default: null
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecretEncrypted: {
      type: String,
      default: null
    },
    twoFactorPendingSecretEncrypted: {
      type: String,
      default: null
    },
    recoveryCodeHashes: {
      type: [String],
      default: []
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockoutUntil: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'user_security'
  }
);

userSecuritySchema.plugin(baseDocumentPlugin);

export type UserSecurityDocument = HydratedDocument<InferSchemaType<typeof userSecuritySchema>>;

export const UserSecurityModel = model<UserSecurityDocument>('UserSecurity', userSecuritySchema);
