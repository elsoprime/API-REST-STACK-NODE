import mongoose, { Types, type PipelineStage } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
import { TENANT_ROLE_KEYS } from '@/constants/tenant';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type AuditTenantScope,
  type RecordAuditLogOptions
} from '@/core/platform/audit/types/audit.types';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';
import { rbacService, type RbacService } from '@/core/platform/rbac/services/rbac.service';
import { UserModel } from '@/core/platform/users/models/user.model';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import {
  type DeleteTenantMembershipInput,
  type ListTenantMembershipsInput,
  type TenantMembershipListItem,
  type TenantMembershipListResult,
  type TenantMembershipsServiceContract,
  type UpdateTenantMembershipInput
} from '@/core/tenant/memberships/types/tenant-memberships.types';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';

function buildTenantMembershipsError(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  statusCode: number
): AppError {
  return new AppError({
    code,
    message,
    statusCode
  });
}

function assertTenantContextConsistency(tenantId: string, context?: ExecutionContext): void {
  const contextTenantId = context?.tenant?.tenantId;

  if (!contextTenantId) {
    return;
  }

  if (!Types.ObjectId.isValid(tenantId) || !Types.ObjectId.isValid(contextTenantId)) {
    throw buildTenantMembershipsError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Types.ObjectId(tenantId).toString() !== new Types.ObjectId(contextTenantId).toString()) {
    throw buildTenantMembershipsError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toIsoDateString(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toTenantAuditScope(tenantId: string, context?: ExecutionContext): AuditTenantScope {
  return {
    tenantId,
    membershipId: context?.tenant?.membershipId,
    roleKey: context?.tenant?.roleKey,
    isOwner: context?.tenant?.isOwner,
    effectiveRoleKeys: context?.tenant?.effectiveRoleKeys
  };
}

function toMembershipListItem(
  membership: {
    membershipId?: Types.ObjectId | string;
    _id?: Types.ObjectId | string;
    userId: Types.ObjectId | string;
    fullName: string;
    email: string;
    roleKey: string;
    status: 'active' | 'suspended';
    joinedAt?: Date | null;
    createdAt?: Date | null;
    isEffectiveOwner: boolean;
  }
): TenantMembershipListItem {
  return {
    membershipId:
      typeof membership.membershipId !== 'undefined'
        ? membership.membershipId.toString()
        : membership._id?.toString() ?? '',
    userId: typeof membership.userId === 'string' ? membership.userId : membership.userId.toString(),
    fullName: membership.fullName,
    email: membership.email,
    roleKey: membership.roleKey,
    status: membership.status,
    joinedAt: toIsoDateString(membership.joinedAt),
    createdAt: toIsoDateString(membership.createdAt),
    isEffectiveOwner: membership.isEffectiveOwner
  };
}

async function assertRoleResolvable(
  authorization: RbacService,
  roleKey: string,
  tenantId: string
): Promise<void> {
  try {
    await authorization.resolveRole({
      roleKey,
      tenantId
    });
  } catch {
    throw buildTenantMembershipsError(
      ERROR_CODES.VALIDATION_ERROR,
      'Membership role is not valid',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

export class TenantMembershipsService implements TenantMembershipsServiceContract {
  constructor(
    private readonly authorization: RbacService = rbacService,
    private readonly audit: AuditService = auditService
  ) {}

  async listMemberships(input: ListTenantMembershipsInput): Promise<TenantMembershipListResult> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const tenant = await TenantModel.findById(input.tenantId).lean();

    if (!tenant) {
      throw buildTenantMembershipsError(
        ERROR_CODES.TENANT_NOT_FOUND,
        'Tenant not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const tenantId = new Types.ObjectId(input.tenantId);
    const baseMatch: Record<string, unknown> = { tenantId };

    if (input.roleKey) {
      baseMatch.roleKey = input.roleKey;
    }

    if (input.status) {
      baseMatch.status = input.status;
    }

    const pipeline: PipelineStage[] = [
      { $match: baseMatch },
      {
        $lookup: {
          from: UserModel.collection.name,
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false
        }
      },
      {
        $addFields: {
          fullName: {
            $trim: {
              input: {
                $concat: ['$user.firstName', ' ', { $ifNull: ['$user.lastName', ''] }]
              }
            }
          },
          email: '$user.email',
          membershipId: '$_id',
          isEffectiveOwner: {
            $eq: ['$userId', tenant.ownerUserId]
          }
        }
      }
    ];

    if (input.search && input.search.trim().length > 0) {
      const search = escapeRegexLiteral(input.search.trim());
      pipeline.push({
        $match: {
          $or: [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      } as PipelineStage.Match);
    }

    pipeline.push({
      $facet: {
        items: [
          { $sort: { isEffectiveOwner: -1, fullName: 1, createdAt: 1 } },
          { $skip: (input.page - 1) * input.limit },
          { $limit: input.limit },
          {
            $project: {
              _id: 0,
              membershipId: 1,
              userId: 1,
              fullName: 1,
              email: 1,
              roleKey: 1,
              status: 1,
              joinedAt: 1,
              createdAt: 1,
              isEffectiveOwner: 1
            }
          }
        ],
        totalCount: [{ $count: 'value' }]
      }
    } as PipelineStage.Facet);

    const [result] = await MembershipModel.aggregate<{
      items: Array<{
        membershipId: Types.ObjectId;
        userId: Types.ObjectId;
        fullName: string;
        email: string;
        roleKey: string;
        status: 'active' | 'suspended';
        joinedAt?: Date | null;
        createdAt?: Date | null;
        isEffectiveOwner: boolean;
      }>;
      totalCount: Array<{ value: number }>;
    }>(pipeline);

    const total = result?.totalCount?.[0]?.value ?? 0;

    return {
      items: (result?.items ?? []).map((membership) => toMembershipListItem(membership)),
      page: input.page,
      limit: input.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.limit)
    };
  }

  async updateMembership(input: UpdateTenantMembershipInput): Promise<TenantMembershipListItem> {
    assertTenantContextConsistency(input.tenantId, input.context);

    if (typeof input.patch.roleKey !== 'undefined' && input.patch.roleKey === TENANT_ROLE_KEYS.OWNER) {
      throw buildTenantMembershipsError(
        ERROR_CODES.TENANT_MEMBERSHIP_OWNER_PROTECTED,
        'Effective ownership cannot be changed through tenant memberships.',
        HTTP_STATUS.CONFLICT
      );
    }

    if (input.patch.roleKey) {
      await assertRoleResolvable(this.authorization, input.patch.roleKey, input.tenantId);
    }

    const session = await mongoose.startSession();

    try {
      let view: TenantMembershipListItem | null = null;

      await session.withTransaction(async () => {
        const [tenant, membership] = await Promise.all([
          TenantModel.findById(input.tenantId).session(session),
          MembershipModel.findOne({
            _id: new Types.ObjectId(input.membershipId),
            tenantId: new Types.ObjectId(input.tenantId)
          }).session(session)
        ]);

        if (!tenant) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_NOT_FOUND,
            'Tenant not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        if (!membership) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_MEMBERSHIP_NOT_FOUND,
            'Tenant membership not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        if (tenant.ownerUserId.toString() === membership.userId.toString()) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_MEMBERSHIP_OWNER_PROTECTED,
            'Effective owner membership cannot be changed through tenant memberships.',
            HTTP_STATUS.CONFLICT
          );
        }

        const previous = {
          roleKey: membership.roleKey,
          status: membership.status
        };

        if (typeof input.patch.roleKey !== 'undefined') {
          membership.roleKey = input.patch.roleKey;
        }

        if (typeof input.patch.status !== 'undefined') {
          membership.status = input.patch.status;
        }

        await membership.save({ session });

        const user = await UserModel.findById(membership.userId).session(session).lean();

        if (!user) {
          throw buildTenantMembershipsError(
            ERROR_CODES.AUTH_UNAUTHENTICATED,
            'Membership user could not be resolved',
            HTTP_STATUS.NOT_FOUND
          );
        }

        view = toMembershipListItem({
          membershipId: membership._id,
          userId: membership.userId,
          fullName: `${user.firstName} ${user.lastName ?? ''}`.trim(),
          email: user.email,
          roleKey: membership.roleKey,
          status: membership.status,
          joinedAt: membership.joinedAt ?? null,
          createdAt: (membership as { createdAt?: Date | null }).createdAt ?? null,
          isEffectiveOwner: false
        });

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'tenant.membership.update',
            resource: {
              type: 'tenant_membership',
              id: membership._id.toString()
            },
            severity: 'warning',
            changes: {
              before: previous,
              after: {
                roleKey: membership.roleKey,
                status: membership.status
              },
              fields: Object.keys(input.patch)
            }
          },
          { session }
        );
      });

      if (!view) {
        throw buildTenantMembershipsError(
          ERROR_CODES.INTERNAL_ERROR,
          'Tenant membership update did not produce a result',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return view;
    } finally {
      await session.endSession();
    }
  }

  async deleteMembership(input: DeleteTenantMembershipInput): Promise<TenantMembershipListItem> {
    assertTenantContextConsistency(input.tenantId, input.context);

    const session = await mongoose.startSession();

    try {
      let view: TenantMembershipListItem | null = null;

      await session.withTransaction(async () => {
        const [tenant, membership] = await Promise.all([
          TenantModel.findById(input.tenantId).session(session),
          MembershipModel.findOne({
            _id: new Types.ObjectId(input.membershipId),
            tenantId: new Types.ObjectId(input.tenantId)
          }).session(session)
        ]);

        if (!tenant) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_NOT_FOUND,
            'Tenant not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        if (!membership) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_MEMBERSHIP_NOT_FOUND,
            'Tenant membership not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        if (tenant.ownerUserId.toString() === membership.userId.toString()) {
          throw buildTenantMembershipsError(
            ERROR_CODES.TENANT_MEMBERSHIP_OWNER_PROTECTED,
            'Effective owner membership cannot be removed through tenant memberships.',
            HTTP_STATUS.CONFLICT
          );
        }

        const user = await UserModel.findById(membership.userId).session(session).lean();

        if (!user) {
          throw buildTenantMembershipsError(
            ERROR_CODES.AUTH_UNAUTHENTICATED,
            'Membership user could not be resolved',
            HTTP_STATUS.NOT_FOUND
          );
        }

        view = toMembershipListItem({
          membershipId: membership._id,
          userId: membership.userId,
          fullName: `${user.firstName} ${user.lastName ?? ''}`.trim(),
          email: user.email,
          roleKey: membership.roleKey,
          status: membership.status,
          joinedAt: membership.joinedAt ?? null,
          createdAt: (membership as { createdAt?: Date | null }).createdAt ?? null,
          isEffectiveOwner: false
        });

        await MembershipModel.deleteOne({ _id: membership._id }).session(session);

        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'tenant.membership.delete',
            resource: {
              type: 'tenant_membership',
              id: membership._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                roleKey: membership.roleKey,
                status: membership.status
              },
              after: {
                deleted: true
              },
              fields: ['deleted']
            }
          },
          { session }
        );
      });

      if (!view) {
        throw buildTenantMembershipsError(
          ERROR_CODES.INTERNAL_ERROR,
          'Tenant membership deletion did not produce a result',
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }

      return view;
    } finally {
      await session.endSession();
    }
  }

  private async recordAuditLog(
    input: {
      context?: ExecutionContext;
      tenantId: string;
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: toTenantAuditScope(input.tenantId, input.context),
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes
    });

    await this.audit.record(auditContext, options);
  }
}

export const tenantMembershipsService = new TenantMembershipsService();
