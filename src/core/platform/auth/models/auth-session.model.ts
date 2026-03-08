import { model, Schema, type InferSchemaType } from 'mongoose';

import { AUTH_SESSION_STATUS } from '@/constants/security';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const authSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    refreshTokenHash: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(AUTH_SESSION_STATUS),
      default: AUTH_SESSION_STATUS.ACTIVE,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    activeTenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null
    },
    activeMembershipId: {
      type: Schema.Types.ObjectId,
      ref: 'Membership',
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },
    replacedBySessionId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthSession',
      default: null
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'auth_sessions'
  }
);

authSessionSchema.plugin(baseDocumentPlugin);

export type AuthSessionDocument = InferSchemaType<typeof authSessionSchema>;

export const AuthSessionModel = model<AuthSessionDocument>('AuthSession', authSessionSchema);
