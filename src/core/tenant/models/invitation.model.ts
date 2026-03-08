import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { INVITATION_STATUS } from '@/constants/tenant';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const invitationSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    roleKey: {
      type: String,
      required: true,
      trim: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.PENDING,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    acceptedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    collection: 'invitations'
  }
);

invitationSchema.index(
  { tenantId: 1, email: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: INVITATION_STATUS.PENDING
    }
  }
);
invitationSchema.plugin(baseDocumentPlugin);

export type InvitationDocument = HydratedDocument<InferSchemaType<typeof invitationSchema>>;

export const InvitationModel = model<InvitationDocument>('Invitation', invitationSchema);
