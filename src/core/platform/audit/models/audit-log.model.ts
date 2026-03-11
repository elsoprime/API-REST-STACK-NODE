import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { AUDIT_SCOPE_VALUES, AUDIT_SEVERITY_VALUES } from '@/core/platform/audit/types/audit.types';

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

const auditLogSchema = new Schema(
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
      trim: true,
      index: true
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
      trim: true,
      index: true
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
      required: true,
      index: true
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
    sourceOutboxId: {
      type: Schema.Types.ObjectId,
      ref: 'AuditOutbox'
    }
  },
  {
    collection: 'audit_logs',
    timestamps: {
      createdAt: true,
      updatedAt: false
    },
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

auditLogSchema.index({ 'tenant.tenantId': 1, createdAt: -1 });
auditLogSchema.index({ scope: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'resource.type': 1, createdAt: -1 });
auditLogSchema.index(
  { sourceOutboxId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceOutboxId: {
        $type: 'objectId'
      }
    }
  }
);

export type AuditLogDocument = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;

export const AuditLogModel = model<AuditLogDocument>('AuditLog', auditLogSchema);
