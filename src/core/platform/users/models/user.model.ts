import { model, Schema, type InferSchemaType } from 'mongoose';

import { baseDocumentPlugin } from '@/infrastructure/database/plugins/baseDocument.plugin';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      default: null,
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'pending_verification'],
      default: 'pending_verification'
    }
  },
  {
    collection: 'users'
  }
);

userSchema.plugin(baseDocumentPlugin);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel = model<UserDocument>('User', userSchema);
