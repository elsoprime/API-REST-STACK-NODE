import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import {
  AUDIT_OUTBOX_STATUS_VALUES,
  AUDIT_SCOPE_VALUES,
  AUDIT_SEVERITY_VALUES
} from '@/core/platform/audit/types/audit.types';

function transformDocument(_doc: unknown, ret: Record<string, unknown>) {
  const normalized = { ...ret };

  if (normalized._id) {
    normalized.id =
      typeof normalized._id === 'string'
        ? normalized._id
        : (normalized._id as { toString: () => string }).toString();
    delete normalized._id;
  }

  return normalized;
}

const auditOutboxSchema = new Schema(
  {
    scope: {
      type: String,
      enum: AUDIT_SCOPE_VALUES,
      required: true,
      index: true
    },
    traceId: {
      type: String,
      required: true,
      trim: true
    },
    actor: {
      kind: {
        type: String,
        enum: ['user', 'system', 'unknown'],
        required: true
      },
      userId: {
        type: String,
        default: null
      },
      sessionId: {
        type: String,
        default: null
      },
      scope: {
        type: [String],
        default: []
      },
      systemId: {
        type: String,
        default: null
      },
      label: {
        type: String,
        default: null
      },
      reason: {
        type: String,
        default: null
      }
    },
    tenant: {
      tenantId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null,
        index: true
      },
      membershipId: {
        type: Schema.Types.ObjectId,
        ref: 'Membership',
        default: null
      },
      roleKey: {
        type: String,
        default: null
      },
      isOwner: {
        type: Boolean,
        default: null
      },
      effectiveRoleKeys: {
        type: [String],
        default: []
      }
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    resource: {
      type: {
        type: String,
        required: true,
        trim: true
      },
      id: {
        type: String,
        default: null
      },
      label: {
        type: String,
        default: null
      }
    },
    severity: {
      type: String,
      enum: AUDIT_SEVERITY_VALUES,
      required: true
    },
    changes: {
      before: {
        type: Schema.Types.Mixed,
        default: null
      },
      after: {
        type: Schema.Types.Mixed,
        default: null
      },
      fields: {
        type: [String],
        default: []
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null
    },
    delivery: {
      status: {
        type: String,
        enum: AUDIT_OUTBOX_STATUS_VALUES,
        required: true,
        default: 'pending',
        index: true
      },
      attempts: {
        type: Number,
        required: true,
        default: 0
      },
      auditLogId: {
        type: Schema.Types.ObjectId,
        ref: 'AuditLog',
        default: null
      },
      deliveredAt: {
        type: Date,
        default: null
      },
      lastError: {
        type: String,
        default: null
      }
    }
  },
  {
    collection: 'audit_outbox',
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: transformDocument
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform: transformDocument
    }
  }
);

auditOutboxSchema.index({ 'delivery.status': 1, createdAt: 1 });
auditOutboxSchema.index({ scope: 1, 'delivery.status': 1, createdAt: 1 });
auditOutboxSchema.index({ 'tenant.tenantId': 1, 'delivery.status': 1, createdAt: 1 });

export type AuditOutboxDocument = HydratedDocument<InferSchemaType<typeof auditOutboxSchema>>;

export const AuditOutboxModel = model<AuditOutboxDocument>('AuditOutbox', auditOutboxSchema);
