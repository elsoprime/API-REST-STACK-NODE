import { randomBytes } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import { BILLING_CHECKOUT_STATUS } from '@/constants/billing';
import { HTTP_STATUS } from '@/constants/http';
import { AUTH_SESSION_STATUS } from '@/constants/security';
import { auditContextFactory } from '@/core/platform/audit/services/audit-context.factory';
import { BillingCheckoutSessionModel } from '@/core/platform/billing/models/billing-checkout-session.model';
import { auditService, type AuditService } from '@/core/platform/audit/services/audit.service';
import {
  type AuditJsonObject,
  type AuditResource,
  type AuditSeverity,
  type RecordAuditLogOptions,
  type AuditTenantScope
} from '@/core/platform/audit/types/audit.types';
import { rbacService, type RbacService } from '@/core/platform/rbac/services/rbac.service';
import { DEFAULT_AUTH_SCOPE } from '@/core/platform/auth/types/auth.types';
import { tokenService, type TokenService } from '@/core/platform/auth/services/token.service';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { UserModel } from '@/core/platform/users/models/user.model';
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { type TenantInvitationDeliveryPort } from '@/core/tenant/ports/tenant-invitation-delivery.port';
import { tenantInvitationRegistry } from '@/infrastructure/tenant/tenant-invitation.registry';
import { InvitationModel, type InvitationDocument } from '@/core/tenant/models/invitation.model';
import { MembershipModel, type MembershipDocument } from '@/core/tenant/models/membership.model';
import { TenantModel, type TenantDocument } from '@/core/tenant/models/tenant.model';
import {
  INVITATION_STATUS,
  MEMBERSHIP_STATUS,
  TENANT_POLICY,
  TENANT_ROLE_KEYS,
  TENANT_STATUS,
  TENANT_SUBSCRIPTION_STATUS
} from '@/constants/tenant';
import {
  type AcceptInvitationInput,
  type AcceptInvitationResult,
  type CreateInvitationInput,
  type CreateInvitationResult,
  type CreateTenantInput,
  type CreateTenantResult,
  type InvitationView,
  type ListMyTenantsInput,
  type ListMyTenantsResult,
  type MembershipView,
  type RevokeInvitationInput,
  type RevokeInvitationResult,
  type SwitchActiveTenantInput,
  type SwitchActiveTenantResult,
  type TenantServiceContract,
  type TenantSubscriptionResult,
  type TenantView,
  type TransferOwnershipInput,
  type TransferOwnershipResult,
  type AssignTenantSubscriptionInput,
  type CancelTenantSubscriptionInput
} from '@/core/tenant/types/tenant.types';

function ensureObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function toIsoDateString(value: Date): string {
  return value.toISOString();
}

function isCurrentTenantOwner(
  tenant: Pick<TenantDocument, 'ownerUserId'>,
  userId: string
): boolean {
  return tenant.ownerUserId.toString() === userId;
}

function resolveEffectiveMemberLimit(
  tenantMemberLimit: number | null | undefined,
  planMemberLimit: number | null
): number | null {
  if (tenantMemberLimit === null || typeof tenantMemberLimit === 'undefined') {
    return planMemberLimit;
  }

  if (planMemberLimit === null) {
    return tenantMemberLimit;
  }

  return Math.min(tenantMemberLimit, planMemberLimit);
}


function resolveSubscriptionActivationStatus(previousStatus?: string | null): 'active' | 'reactivated' {
  if (
    previousStatus === TENANT_SUBSCRIPTION_STATUS.CANCELED ||
    previousStatus === TENANT_SUBSCRIPTION_STATUS.SUSPENDED ||
    previousStatus === TENANT_SUBSCRIPTION_STATUS.GRACE
  ) {
    return TENANT_SUBSCRIPTION_STATUS.REACTIVATED;
  }

  return TENANT_SUBSCRIPTION_STATUS.ACTIVE;
}

function resolveTenantSubscriptionStatus(tenant: {
  subscriptionStatus?: TenantDocument['subscriptionStatus'] | null;
  planId?: string | null;
}): (typeof TENANT_SUBSCRIPTION_STATUS)[keyof typeof TENANT_SUBSCRIPTION_STATUS] {
  if (tenant.subscriptionStatus) {
    return tenant.subscriptionStatus;
  }

  return tenant.planId
    ? TENANT_SUBSCRIPTION_STATUS.ACTIVE
    : TENANT_SUBSCRIPTION_STATUS.PENDING;
}
function slugifyTenantName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildTenantError(
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

function generateOpaqueToken(): string {
  return randomBytes(24).toString('base64url');
}

function isInvitationExpired(invitation: Pick<InvitationDocument, 'expiresAt'>): boolean {
  return invitation.expiresAt.getTime() <= Date.now();
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function toTenantView(tenant: {
  id?: string;
  _id?: Types.ObjectId;
  name: string;
  slug: string;
  status: TenantDocument['status'];
  subscriptionStatus?: TenantDocument['subscriptionStatus'] | null;
  subscriptionGraceEndsAt?: Date | null;
  ownerUserId: Types.ObjectId | string;
  planId?: string | null;
  activeModuleKeys?: string[];
  memberLimit?: number | null;
}): TenantView {
  const id = tenant.id ?? tenant._id?.toString() ?? '';

  return {
    id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    subscriptionStatus: resolveTenantSubscriptionStatus({
      subscriptionStatus: tenant.subscriptionStatus,
      planId: tenant.planId ?? null
    }),
    subscriptionGraceEndsAt: tenant.subscriptionGraceEndsAt
      ? toIsoDateString(tenant.subscriptionGraceEndsAt)
      : null,
    ownerUserId:
      typeof tenant.ownerUserId === 'string'
        ? tenant.ownerUserId
        : tenant.ownerUserId.toString(),
    planId: tenant.planId ?? null,
    activeModuleKeys: tenant.activeModuleKeys ?? [],
    memberLimit: tenant.memberLimit ?? null
  };
}

function toMembershipView(membership: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  roleKey: string;
  status: MembershipDocument['status'];
}): MembershipView {
  return {
    id: membership.id ?? membership._id?.toString() ?? '',
    tenantId:
      typeof membership.tenantId === 'string'
        ? membership.tenantId
        : membership.tenantId.toString(),
    userId:
      typeof membership.userId === 'string' ? membership.userId : membership.userId.toString(),
    roleKey: membership.roleKey,
    status: membership.status
  };
}

function toInvitationView(invitation: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  email: string;
  roleKey: string;
  status: InvitationDocument['status'];
  expiresAt: Date;
}): InvitationView {
  return {
    id: invitation.id ?? invitation._id?.toString() ?? '',
    tenantId:
      typeof invitation.tenantId === 'string'
        ? invitation.tenantId
        : invitation.tenantId.toString(),
    email: invitation.email,
    roleKey: invitation.roleKey,
    status: invitation.status,
    expiresAt: toIsoDateString(invitation.expiresAt)
  };
}

export class TenantService implements TenantServiceContract {
  constructor(
    private readonly tokens: TokenService = tokenService,
    private readonly invitationDelivery: TenantInvitationDeliveryPort =
      tenantInvitationRegistry.tenantInvitationDeliveryPort,
    private readonly authorization: RbacService = rbacService,
    private readonly audit: AuditService = auditService
  ) {}

  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const slug = slugifyTenantName(input.slug ?? input.name);

    if (!slug) {
      throw buildTenantError(
        ERROR_CODES.VALIDATION_ERROR,
        'Tenant slug could not be generated from the provided name',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const existingTenant = await TenantModel.findOne({ slug }).lean();

    if (existingTenant) {
      throw buildTenantError(
        ERROR_CODES.TENANT_SLUG_ALREADY_EXISTS,
        'Tenant slug already exists',
        HTTP_STATUS.CONFLICT
      );
    }

    const user = await UserModel.findById(input.userId).lean();

    if (!user) {
      throw buildTenantError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const session = await mongoose.startSession();

    try {
      let tenantView: TenantView | null = null;
      let membershipView: MembershipView | null = null;

      await session.withTransaction(async () => {
        const [tenant] = await TenantModel.create(
          [
            {
              name: input.name.trim(),
              slug,
              ownerUserId: ensureObjectId(input.userId),
              status: TENANT_STATUS.ACTIVE,
              subscriptionStatus: TENANT_SUBSCRIPTION_STATUS.PENDING
            }
          ],
          { session }
        );

        const [membership] = await MembershipModel.create(
          [
            {
              tenantId: tenant._id,
              userId: ensureObjectId(input.userId),
              roleKey: TENANT_ROLE_KEYS.OWNER,
              status: MEMBERSHIP_STATUS.ACTIVE,
              invitedByUserId: null
            }
          ],
          { session }
        );

        tenantView = toTenantView(tenant.toObject());
        membershipView = toMembershipView(membership.toObject());

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              membershipId: membership._id.toString(),
              roleKey: membership.roleKey,
              isOwner: true,
              effectiveRoleKeys: [membership.roleKey]
            },
            action: 'tenant.create',
            resource: {
              type: 'tenant',
              id: tenant._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                ownerUserId: input.userId,
                slug,
                roleKey: membership.roleKey
              }
            }
          },
          { session }
        );
      });

      if (!tenantView || !membershipView) {
        throw new Error('Tenant creation transaction did not produce tenant membership views.');
      }

      return {
        tenant: tenantView,
        membership: membershipView
      };
    } finally {
      await session.endSession();
    }
  }

  async listMyTenants(input: ListMyTenantsInput): Promise<ListMyTenantsResult> {
    const memberships = await MembershipModel.find({
      userId: ensureObjectId(input.userId),
      status: MEMBERSHIP_STATUS.ACTIVE
    }).lean();

    if (memberships.length === 0) {
      return {
        items: []
      };
    }

    const session = input.sessionId ? await AuthSessionModel.findById(input.sessionId).lean() : null;
    const tenants = await TenantModel.find({
      _id: {
        $in: memberships.map((membership) => membership.tenantId)
      }
    }).lean();
    const tenantsById = new Map(tenants.map((tenant) => [tenant._id.toString(), tenant]));

    return {
      items: memberships
        .map((membership) => {
          const tenant = tenantsById.get(membership.tenantId.toString());

          if (!tenant) {
            return null;
          }

          return {
            tenant: toTenantView(tenant),
            membership: toMembershipView(membership),
            isActive: session?.activeTenantId?.toString() === membership.tenantId.toString()
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    };
  }

  async switchActiveTenant(input: SwitchActiveTenantInput): Promise<SwitchActiveTenantResult> {
    const [tenant, membership, authSession] = await Promise.all([
      TenantModel.findById(input.tenantId),
      MembershipModel.findOne({
        tenantId: ensureObjectId(input.tenantId),
        userId: ensureObjectId(input.userId)
      }),
      AuthSessionModel.findById(input.sessionId)
    ]);

    if (!authSession || authSession.userId.toString() !== input.userId) {
      throw buildTenantError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (
      authSession.status !== AUTH_SESSION_STATUS.ACTIVE ||
      authSession.expiresAt.getTime() <= Date.now()
    ) {
      throw buildTenantError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    if (!membership) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_REQUIRED,
        'Active tenant membership required',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_INACTIVE,
        'Tenant membership is not active',
        HTTP_STATUS.FORBIDDEN
      );
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        authSession.activeTenantId = tenant._id;
        authSession.activeMembershipId = membership._id;
        await authSession.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              membershipId: membership._id.toString(),
              roleKey: membership.roleKey
            },
            action: 'tenant.switch_active',
            resource: {
              type: 'tenant',
              id: tenant._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                sessionId: authSession._id.toString(),
                membershipId: membership._id.toString()
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      tenant: toTenantView(tenant.toObject()),
      membership: toMembershipView(membership.toObject()),
      accessToken: this.tokens.signAccessToken({
        sub: input.userId,
        sid: authSession._id.toString(),
        scope: input.scope.length > 0 ? input.scope : [...DEFAULT_AUTH_SCOPE],
        tenantId: tenant._id.toString(),
        membershipId: membership._id.toString()
      })
    };
  }

  async createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
    const tenant = await TenantModel.findById(input.tenantId);
    const actorMembership = await MembershipModel.findOne({
      tenantId: ensureObjectId(input.tenantId),
      userId: ensureObjectId(input.userId)
    });

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    if (!actorMembership || actorMembership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_REQUIRED,
        'Active tenant membership required',
        HTTP_STATUS.FORBIDDEN
      );
    }

    this.assertCurrentOwner(
      tenant,
      actorMembership,
      input.userId,
      'Only the tenant owner can manage invitations'
    );

    const roleKey = input.roleKey ?? TENANT_ROLE_KEYS.MEMBER;
    await this.assertInvitationRoleResolvable(roleKey, tenant._id.toString());
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingPendingInvitation = await InvitationModel.findOne({
      tenantId: tenant._id,
      email: normalizedEmail,
      status: INVITATION_STATUS.PENDING
    });

    if (existingPendingInvitation) {
      const token = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + TENANT_POLICY.INVITATION_TTL_MS);

      existingPendingInvitation.roleKey = roleKey;
      existingPendingInvitation.tokenHash = this.tokens.hashToken(token);
      existingPendingInvitation.expiresAt = expiresAt;
      await existingPendingInvitation.save();

      await this.invitationDelivery.deliver({
        tenantId: tenant._id.toString(),
        email: normalizedEmail,
        tenantName: tenant.name,
        token,
        roleKey,
        expiresAt: toIsoDateString(expiresAt)
      });
      await this.recordAuditLog({
        context: input.context,
        tenant: {
          tenantId: tenant._id.toString(),
          roleKey: actorMembership.roleKey,
          isOwner: isCurrentTenantOwner(tenant, input.userId)
        },
        action: 'tenant.invitation.resent',
        resource: {
          type: 'tenant_invitation',
          id: existingPendingInvitation._id.toString()
        },
        severity: 'info',
        changes: {
          after: {
            email: normalizedEmail,
            roleKey,
            status: existingPendingInvitation.status
          }
        }
      });

      return {
        invitation: toInvitationView(existingPendingInvitation.toObject())
      };
    }

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + TENANT_POLICY.INVITATION_TTL_MS);
    const session = await mongoose.startSession();

    try {
      let invitation: InvitationDocument | null = null;

      await session.withTransaction(async () => {
        const createdInvitations = await InvitationModel.create(
          [
            {
              tenantId: tenant._id,
              email: normalizedEmail,
              roleKey,
              tokenHash: this.tokens.hashToken(token),
              status: INVITATION_STATUS.PENDING,
              expiresAt,
              invitedByUserId: ensureObjectId(input.userId)
            }
          ],
          { session }
        );
        invitation = createdInvitations[0] as InvitationDocument;

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              roleKey: actorMembership.roleKey,
              isOwner: isCurrentTenantOwner(tenant, input.userId)
            },
            action: 'tenant.invitation.create',
            resource: {
              type: 'tenant_invitation',
              id: invitation._id.toString()
            },
            severity: 'info',
            changes: {
              after: {
                email: normalizedEmail,
                roleKey: invitation.roleKey,
                status: invitation.status
              }
            }
          },
          { session }
        );
      });

      if (!invitation) {
        throw new Error('Invitation creation transaction did not produce an invitation.');
      }

      const createdInvitation = invitation as InvitationDocument;

      await this.invitationDelivery.deliver({
        tenantId: tenant._id.toString(),
        email: normalizedEmail,
        tenantName: tenant.name,
        token,
        roleKey: createdInvitation.roleKey,
        expiresAt: toIsoDateString(expiresAt)
      });

      return {
        invitation: toInvitationView(createdInvitation.toObject())
      };
    } finally {
      await session.endSession();
    }
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
    const [user, existingInvitation] = await Promise.all([
      UserModel.findById(input.userId).lean(),
      InvitationModel.findOne({
        tokenHash: this.tokens.hashToken(input.token)
      })
    ]);

    if (!user) {
      throw buildTenantError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!existingInvitation) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_INVALID,
        'Invitation token is invalid',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (existingInvitation.status === INVITATION_STATUS.REVOKED) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_REVOKED,
        'Invitation has been revoked',
        HTTP_STATUS.CONFLICT
      );
    }

    if (existingInvitation.status === INVITATION_STATUS.ACCEPTED) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_ALREADY_ACCEPTED,
        'Invitation has already been accepted',
        HTTP_STATUS.CONFLICT
      );
    }

    if (existingInvitation.status === INVITATION_STATUS.EXPIRED || isInvitationExpired(existingInvitation)) {
      existingInvitation.status = INVITATION_STATUS.EXPIRED;
      await existingInvitation.save();
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_EXPIRED,
        'Invitation has expired',
        HTTP_STATUS.CONFLICT
      );
    }

    if (existingInvitation.email !== user.email.toLowerCase()) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_INVALID,
        'Invitation token is invalid',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await this.assertInvitationRoleResolvable(existingInvitation.roleKey, existingInvitation.tenantId.toString());

    const tenant = await TenantModel.findById(existingInvitation.tenantId).lean();

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    const session = await mongoose.startSession();

    try {
      let membershipView: MembershipView | null = null;

      try {
        await session.withTransaction(async () => {
          const invitation = await InvitationModel.findOne({
            _id: existingInvitation._id
          }).session(session);

          if (!invitation || invitation.status !== INVITATION_STATUS.PENDING) {
            throw buildTenantError(
              ERROR_CODES.TENANT_INVITATION_ALREADY_ACCEPTED,
              'Invitation has already been processed',
              HTTP_STATUS.CONFLICT
            );
          }

          if (isInvitationExpired(invitation)) {
            invitation.status = INVITATION_STATUS.EXPIRED;
            await invitation.save({ session });
            throw buildTenantError(
              ERROR_CODES.TENANT_INVITATION_EXPIRED,
              'Invitation has expired',
              HTTP_STATUS.CONFLICT
            );
          }

          await this.assertInvitationRoleResolvable(invitation.roleKey, invitation.tenantId.toString());

          let membership = await MembershipModel.findOne({
            tenantId: invitation.tenantId,
            userId: ensureObjectId(input.userId)
          }).session(session);

          if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
            await this.assertMemberLimitNotReached(invitation.tenantId.toString(), session);
          }

          if (membership) {
            membership.status = MEMBERSHIP_STATUS.ACTIVE;
            membership.roleKey = invitation.roleKey;
            membership.invitedByUserId = invitation.invitedByUserId;
            membership.joinedAt = new Date();
            await membership.save({ session });
          } else {
            membership = (
              await MembershipModel.create(
                [
                  {
                    tenantId: invitation.tenantId,
                    userId: ensureObjectId(input.userId),
                    roleKey: invitation.roleKey,
                    status: MEMBERSHIP_STATUS.ACTIVE,
                    invitedByUserId: invitation.invitedByUserId,
                    joinedAt: new Date()
                  }
                ],
                { session }
              )
            )[0];
          }

          invitation.status = INVITATION_STATUS.ACCEPTED;
          invitation.acceptedAt = new Date();
          invitation.acceptedByUserId = ensureObjectId(input.userId);
          await invitation.save({ session });

          membershipView = toMembershipView(membership.toObject());

          await this.recordAuditLog(
            {
              context: input.context,
              tenant: {
                tenantId: invitation.tenantId.toString(),
                membershipId: membership._id.toString(),
                roleKey: membership.roleKey
              },
              action: 'tenant.invitation.accept',
              resource: {
                type: 'tenant_invitation',
                id: invitation._id.toString()
              },
              severity: 'info',
              changes: {
                before: {
                  status: INVITATION_STATUS.PENDING
                },
                after: {
                  status: invitation.status,
                  membershipId: membership._id.toString(),
                  roleKey: membership.roleKey
                }
              }
            },
            { session }
          );
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        if (isMongoDuplicateKeyError(error)) {
          throw buildTenantError(
            ERROR_CODES.TENANT_INVITATION_ALREADY_ACCEPTED,
            'Invitation has already been processed',
            HTTP_STATUS.CONFLICT
          );
        }

        throw error;
      }

      if (!membershipView) {
        throw new Error('Invitation acceptance transaction did not produce a membership.');
      }

      return {
        tenant: toTenantView(tenant),
        membership: membershipView
      };
    } finally {
      await session.endSession();
    }
  }

  async revokeInvitation(input: RevokeInvitationInput): Promise<RevokeInvitationResult> {
    const tenant = await TenantModel.findById(input.tenantId);
    const actorMembership = await MembershipModel.findOne({
      tenantId: ensureObjectId(input.tenantId),
      userId: ensureObjectId(input.userId)
    });

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    if (!actorMembership || actorMembership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_REQUIRED,
        'Active tenant membership required',
        HTTP_STATUS.FORBIDDEN
      );
    }

    this.assertCurrentOwner(
      tenant,
      actorMembership,
      input.userId,
      'Only the tenant owner can manage invitations'
    );

    const invitation = await InvitationModel.findOne({
      _id: ensureObjectId(input.invitationId),
      tenantId: tenant._id
    });

    if (!invitation) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_INVALID,
        'Invitation not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (invitation.status === INVITATION_STATUS.ACCEPTED) {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_ALREADY_ACCEPTED,
        'Invitation has already been accepted',
        HTTP_STATUS.CONFLICT
      );
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        invitation.status = INVITATION_STATUS.REVOKED;
        invitation.revokedAt = new Date();
        await invitation.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              roleKey: actorMembership.roleKey,
              isOwner: isCurrentTenantOwner(tenant, input.userId)
            },
            action: 'tenant.invitation.revoke',
            resource: {
              type: 'tenant_invitation',
              id: invitation._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                status: INVITATION_STATUS.PENDING
              },
              after: {
                status: INVITATION_STATUS.REVOKED,
                revokedAt: toIsoDateString(invitation.revokedAt as Date)
              }
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    return {
      invitation: toInvitationView(invitation.toObject())
    };
  }

  async transferOwnership(input: TransferOwnershipInput): Promise<TransferOwnershipResult> {
    const [tenant, currentOwnerMembership, targetMembership] = await Promise.all([
      TenantModel.findById(input.tenantId),
      MembershipModel.findOne({
        tenantId: ensureObjectId(input.tenantId),
        userId: ensureObjectId(input.userId)
      }),
      MembershipModel.findOne({
        tenantId: ensureObjectId(input.tenantId),
        userId: ensureObjectId(input.targetUserId)
      })
    ]);

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    if (!currentOwnerMembership || currentOwnerMembership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_OWNER_REQUIRED,
        'Only the tenant owner can transfer ownership',
        HTTP_STATUS.FORBIDDEN
      );
    }

    this.assertCurrentOwner(
      tenant,
      currentOwnerMembership,
      input.userId,
      'Only the tenant owner can transfer ownership'
    );

    if (!targetMembership) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_REQUIRED,
        'Active tenant membership required for ownership transfer',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (targetMembership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBERSHIP_INACTIVE,
        'Target membership is not active',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (targetMembership.userId.toString() === input.userId) {
      throw buildTenantError(
        ERROR_CODES.TENANT_ACCESS_DENIED,
        'Ownership transfer requires a different active member',
        HTTP_STATUS.CONFLICT
      );
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const previousOwnerUserId = tenant.ownerUserId.toString();
        const previousOwnerRoleKey = currentOwnerMembership.roleKey;

        tenant.ownerUserId = ensureObjectId(input.targetUserId);

        if (currentOwnerMembership.roleKey === TENANT_ROLE_KEYS.OWNER) {
          currentOwnerMembership.roleKey = TENANT_ROLE_KEYS.MEMBER;
        }

        await Promise.all([
          tenant.save({ session }),
          currentOwnerMembership.save({ session }),
          targetMembership.save({ session })
        ]);

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              membershipId: targetMembership._id.toString(),
              roleKey: targetMembership.roleKey,
              isOwner: true,
              effectiveRoleKeys: [targetMembership.roleKey]
            },
            action: 'tenant.ownership.transfer',
            resource: {
              type: 'tenant',
              id: tenant._id.toString()
            },
            severity: 'critical',
            changes: {
              before: {
                ownerUserId: previousOwnerUserId,
                previousOwnerRoleKey
              },
              after: {
                ownerUserId: input.targetUserId,
                previousOwnerRoleKey: currentOwnerMembership.roleKey,
                newOwnerRoleKey: targetMembership.roleKey
              }
            }
          },
          { session }
        );
      });

      return {
        tenant: toTenantView(tenant.toObject()),
        membership: toMembershipView(targetMembership.toObject())
      };
    } finally {
      await session.endSession();
    }
  }

  async assignSubscription(input: AssignTenantSubscriptionInput): Promise<TenantSubscriptionResult> {
    const [tenant, membership, resolvedPlan, checkoutSession] = await Promise.all([
      TenantModel.findById(input.tenantId),
      MembershipModel.findOne({
        tenantId: ensureObjectId(input.tenantId),
        userId: ensureObjectId(input.userId)
      }),
      this.authorization.resolvePlan(input.planId),
      BillingCheckoutSessionModel.findById(input.checkoutSessionId)
    ]);

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    this.assertCurrentOwner(
      tenant,
      membership,
      input.userId,
      'Only the tenant owner can update tenant subscription'
    );

    if (!resolvedPlan) {
      throw buildTenantError(
        ERROR_CODES.RBAC_PLAN_DENIED,
        'Plan could not be resolved for tenant subscription update',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!checkoutSession || checkoutSession.tenantId.toString() !== tenant._id.toString()) {
      throw buildTenantError(
        ERROR_CODES.TENANT_SUBSCRIPTION_PAYMENT_REQUIRED,
        'Subscription activation requires a paid checkout session for this tenant',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (checkoutSession.planId !== resolvedPlan.key) {
      throw buildTenantError(
        ERROR_CODES.VALIDATION_ERROR,
        'Checkout session plan does not match requested subscription plan',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (
      checkoutSession.status !== BILLING_CHECKOUT_STATUS.PAID &&
      checkoutSession.status !== BILLING_CHECKOUT_STATUS.ACTIVATED
    ) {
      throw buildTenantError(
        ERROR_CODES.TENANT_SUBSCRIPTION_PAYMENT_REQUIRED,
        'Checkout session is not paid yet',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (
      checkoutSession.status !== BILLING_CHECKOUT_STATUS.ACTIVATED &&
      checkoutSession.expiresAt.getTime() <= Date.now()
    ) {
      throw buildTenantError(
        ERROR_CODES.TENANT_SUBSCRIPTION_PAYMENT_REQUIRED,
        'Checkout session expired before activation',
        HTTP_STATUS.FORBIDDEN
      );
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const previousPlanId = tenant.planId ?? null;
        const previousActiveModuleKeys = [...(tenant.activeModuleKeys ?? [])];
        const previousSubscriptionStatus = resolveTenantSubscriptionStatus({
          subscriptionStatus: tenant.subscriptionStatus,
          planId: tenant.planId
        });

        tenant.planId = resolvedPlan.key;
        tenant.activeModuleKeys = [...resolvedPlan.allowedModuleKeys];
        tenant.subscriptionStatus = resolveSubscriptionActivationStatus(previousSubscriptionStatus);
        tenant.subscriptionGraceEndsAt = null;

        checkoutSession.planId = resolvedPlan.key;
        checkoutSession.status = BILLING_CHECKOUT_STATUS.ACTIVATED;
        checkoutSession.lastError = null;
        checkoutSession.activatedAt = checkoutSession.activatedAt ?? new Date();

        await Promise.all([tenant.save({ session }), checkoutSession.save({ session })]);

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              membershipId: membership?._id.toString(),
              roleKey: membership?.roleKey,
              isOwner: true
            },
            action: 'tenant.subscription.assign',
            resource: {
              type: 'tenant',
              id: tenant._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                planId: previousPlanId,
                activeModuleKeys: previousActiveModuleKeys,
                subscriptionStatus: previousSubscriptionStatus
              },
              after: {
                planId: tenant.planId,
                activeModuleKeys: tenant.activeModuleKeys,
                subscriptionStatus: tenant.subscriptionStatus,
                checkoutSessionId: checkoutSession._id.toString()
              },
              fields: ['planId', 'activeModuleKeys', 'subscriptionStatus']
            }
          },
          { session }
        );
      });

      return {
        tenant: toTenantView(tenant.toObject()),
        subscription: {
          planId: tenant.planId ?? null,
          activeModuleKeys: [...tenant.activeModuleKeys],
          status: 'activated',
          lifecycleStatus: resolveTenantSubscriptionStatus({
            subscriptionStatus: tenant.subscriptionStatus,
            planId: tenant.planId
          })
        }
      };
    } finally {
      await session.endSession();
    }
  }

  async cancelSubscription(input: CancelTenantSubscriptionInput): Promise<TenantSubscriptionResult> {
    const [tenant, membership] = await Promise.all([
      TenantModel.findById(input.tenantId),
      MembershipModel.findOne({
        tenantId: ensureObjectId(input.tenantId),
        userId: ensureObjectId(input.userId)
      })
    ]);

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw buildTenantError(ERROR_CODES.TENANT_INACTIVE, 'Tenant is not active', HTTP_STATUS.FORBIDDEN);
    }

    this.assertCurrentOwner(
      tenant,
      membership,
      input.userId,
      'Only the tenant owner can cancel tenant subscription'
    );

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const previousPlanId = tenant.planId ?? null;
        const previousActiveModuleKeys = [...(tenant.activeModuleKeys ?? [])];
        const previousSubscriptionStatus = resolveTenantSubscriptionStatus({
          subscriptionStatus: tenant.subscriptionStatus,
          planId: tenant.planId
        });

        tenant.planId = null;
        tenant.activeModuleKeys = [];
        tenant.subscriptionStatus = TENANT_SUBSCRIPTION_STATUS.CANCELED;
        tenant.subscriptionGraceEndsAt = null;
        await tenant.save({ session });

        await this.recordAuditLog(
          {
            context: input.context,
            tenant: {
              tenantId: tenant._id.toString(),
              membershipId: membership?._id.toString(),
              roleKey: membership?.roleKey,
              isOwner: true
            },
            action: 'tenant.subscription.cancel',
            resource: {
              type: 'tenant',
              id: tenant._id.toString()
            },
            severity: 'warning',
            changes: {
              before: {
                planId: previousPlanId,
                activeModuleKeys: previousActiveModuleKeys,
                subscriptionStatus: previousSubscriptionStatus
              },
              after: {
                planId: tenant.planId,
                activeModuleKeys: tenant.activeModuleKeys,
                subscriptionStatus: tenant.subscriptionStatus
              },
              fields: ['planId', 'activeModuleKeys', 'subscriptionStatus']
            }
          },
          { session }
        );
      });

      return {
        tenant: toTenantView(tenant.toObject()),
        subscription: {
          planId: null,
          activeModuleKeys: [],
          status: 'canceled',
          lifecycleStatus: resolveTenantSubscriptionStatus({
            subscriptionStatus: tenant.subscriptionStatus,
            planId: tenant.planId
          })
        }
      };
    } finally {
      await session.endSession();
    }
  }
  private async assertMemberLimitNotReached(
    tenantId: string,
    session: mongoose.ClientSession
  ): Promise<void> {
    const tenant = await TenantModel.findById(tenantId).session(session);

    if (!tenant) {
      throw buildTenantError(ERROR_CODES.TENANT_NOT_FOUND, 'Tenant not found', HTTP_STATUS.NOT_FOUND);
    }

    const resolvedPlan = await this.authorization.resolvePlan(tenant.planId ?? null);
    const memberLimit = resolveEffectiveMemberLimit(tenant.memberLimit, resolvedPlan?.memberLimit ?? null);

    if (memberLimit === null) {
      return;
    }

    const activeMembers = await MembershipModel.countDocuments({
      tenantId: tenant._id,
      status: MEMBERSHIP_STATUS.ACTIVE
    }).session(session);

    if (activeMembers >= memberLimit) {
      throw buildTenantError(
        ERROR_CODES.TENANT_MEMBER_LIMIT_REACHED,
        'Tenant member limit has been reached',
        HTTP_STATUS.CONFLICT
      );
    }
  }

  private async assertInvitationRoleResolvable(roleKey: string, tenantId: string): Promise<void> {
    try {
      await this.authorization.resolveRole({
        roleKey,
        tenantId
      });
    } catch {
      throw buildTenantError(
        ERROR_CODES.TENANT_INVITATION_INVALID,
        'Invitation role is not valid',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  private assertCurrentOwner(
    tenant: Pick<TenantDocument, '_id' | 'ownerUserId'>,
    membership: Pick<MembershipDocument, 'status'> | null,
    userId: string,
    message: string
  ): void {
    if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw buildTenantError(
        ERROR_CODES.TENANT_OWNER_REQUIRED,
        message,
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (!isCurrentTenantOwner(tenant, userId)) {
      throw buildTenantError(
        ERROR_CODES.TENANT_OWNER_REQUIRED,
        message,
        HTTP_STATUS.FORBIDDEN
      );
    }
  }

  private async recordAuditLog(
    input: {
      context?: CreateTenantInput['context'];
      tenant?: AuditTenantScope;
      action: string;
      resource: AuditResource;
      severity?: AuditSeverity;
      changes?: {
        before?: AuditJsonObject | null;
        after?: AuditJsonObject | null;
        fields?: string[];
      };
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: input.tenant,
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const tenantService = new TenantService();














