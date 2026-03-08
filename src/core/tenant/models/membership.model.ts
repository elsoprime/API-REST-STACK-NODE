import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { MEMBERSHIP_STATUS } from '@/constants/tenant';
import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const membershipSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    roleKey: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.ACTIVE,
      index: true
    },
    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    joinedAt: {
      type: Date,
      default: () => new Date()
    }
  },
  {
    collection: 'memberships'
  }
);

membershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
membershipSchema.plugin(baseDocumentPlugin);

export type MembershipDocument = HydratedDocument<InferSchemaType<typeof membershipSchema>>;

export const MembershipModel = model<MembershipDocument>('Membership', membershipSchema);
