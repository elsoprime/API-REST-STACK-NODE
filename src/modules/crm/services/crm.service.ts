import mongoose, { Types, type ClientSession } from 'mongoose';

import { HTTP_STATUS } from '@/constants/http';
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
import { AppError } from '@/infrastructure/errors/app-error';
import { ERROR_CODES } from '@/infrastructure/errors/error-codes';
import { CrmActivityModel } from '@/modules/crm/models/crm-activity.model';
import { CrmContactModel } from '@/modules/crm/models/crm-contact.model';
import { CrmCounterModel } from '@/modules/crm/models/crm-counter.model';
import { CrmOpportunityModel } from '@/modules/crm/models/crm-opportunity.model';
import { CrmOrganizationModel } from '@/modules/crm/models/crm-organization.model';
import { crmDedupService } from '@/modules/crm/services/crm-dedup.service';
import {
  type ChangeCrmOpportunityStageInput,
  type CreateCrmActivityInput,
  type CreateCrmContactInput,
  type CreateCrmOpportunityInput,
  type CreateCrmOrganizationInput,
  type CrmActivityView,
  type CrmContactView,
  type CrmCountersView,
  type CrmOpportunityStage,
  type CrmOpportunityView,
  type CrmOrganizationView,
  type CrmPaginatedResult,
  type CrmServiceContract,
  CRM_OPPORTUNITY_STAGES,
  type DeleteCrmContactInput,
  type DeleteCrmOpportunityInput,
  type DeleteCrmOrganizationInput,
  type ListCrmActivitiesInput,
  type ListCrmContactsInput,
  type ListCrmOpportunitiesInput,
  type ListCrmOrganizationsInput,
  type UpdateCrmContactInput,
  type UpdateCrmOpportunityInput,
  type UpdateCrmOrganizationInput
} from '@/modules/crm/types/crm.types';

const OPPORTUNITY_STAGE_TRANSITIONS: Record<CrmOpportunityStage, CrmOpportunityStage[]> = {
  lead: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: []
};

function buildCrmError(
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
    throw buildCrmError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (new Types.ObjectId(tenantId).toString() !== new Types.ObjectId(contextTenantId).toString()) {
    throw buildCrmError(
      ERROR_CODES.TENANT_SCOPE_MISMATCH,
      'Tenant context does not match the requested tenant.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function toNullableObjectId(value?: string | null): Types.ObjectId | null {
  return value ? new Types.ObjectId(value) : null;
}

function toContactView(contact: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  organizationId?: Types.ObjectId | string | null;
  isActive?: boolean;
}): CrmContactView {
  return {
    id: contact.id ?? contact._id?.toString() ?? '',
    tenantId: typeof contact.tenantId === 'string' ? contact.tenantId : contact.tenantId.toString(),
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    organizationId:
      typeof contact.organizationId === 'undefined' || contact.organizationId === null
        ? null
        : typeof contact.organizationId === 'string'
          ? contact.organizationId
          : contact.organizationId.toString(),
    isActive: contact.isActive ?? true
  };
}

function toOrganizationView(organization: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  isActive?: boolean;
}): CrmOrganizationView {
  return {
    id: organization.id ?? organization._id?.toString() ?? '',
    tenantId:
      typeof organization.tenantId === 'string'
        ? organization.tenantId
        : organization.tenantId.toString(),
    name: organization.name,
    domain: organization.domain ?? null,
    industry: organization.industry ?? null,
    isActive: organization.isActive ?? true
  };
}

function toOpportunityView(opportunity: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  title: string;
  description?: string | null;
  stage: CrmOpportunityStage;
  amount?: number | null;
  currency?: string | null;
  contactId?: Types.ObjectId | string | null;
  organizationId?: Types.ObjectId | string | null;
  expectedCloseDate?: Date | string | null;
  isActive?: boolean;
}): CrmOpportunityView {
  return {
    id: opportunity.id ?? opportunity._id?.toString() ?? '',
    tenantId:
      typeof opportunity.tenantId === 'string'
        ? opportunity.tenantId
        : opportunity.tenantId.toString(),
    title: opportunity.title,
    description: opportunity.description ?? null,
    stage: opportunity.stage,
    amount: opportunity.amount ?? null,
    currency: opportunity.currency ?? null,
    contactId:
      typeof opportunity.contactId === 'undefined' || opportunity.contactId === null
        ? null
        : typeof opportunity.contactId === 'string'
          ? opportunity.contactId
          : opportunity.contactId.toString(),
    organizationId:
      typeof opportunity.organizationId === 'undefined' || opportunity.organizationId === null
        ? null
        : typeof opportunity.organizationId === 'string'
          ? opportunity.organizationId
          : opportunity.organizationId.toString(),
    expectedCloseDate:
      typeof opportunity.expectedCloseDate === 'undefined' || opportunity.expectedCloseDate === null
        ? null
        : typeof opportunity.expectedCloseDate === 'string'
          ? opportunity.expectedCloseDate
          : opportunity.expectedCloseDate.toISOString(),
    isActive: opportunity.isActive ?? true
  };
}

function toActivityView(activity: {
  id?: string;
  _id?: Types.ObjectId;
  tenantId: Types.ObjectId | string;
  type: string;
  note: string;
  contactId?: Types.ObjectId | string | null;
  organizationId?: Types.ObjectId | string | null;
  opportunityId?: Types.ObjectId | string | null;
  occurredAt?: Date;
}): CrmActivityView {
  return {
    id: activity.id ?? activity._id?.toString() ?? '',
    tenantId: typeof activity.tenantId === 'string' ? activity.tenantId : activity.tenantId.toString(),
    type: activity.type,
    note: activity.note,
    contactId:
      typeof activity.contactId === 'undefined' || activity.contactId === null
        ? null
        : typeof activity.contactId === 'string'
          ? activity.contactId
          : activity.contactId.toString(),
    organizationId:
      typeof activity.organizationId === 'undefined' || activity.organizationId === null
        ? null
        : typeof activity.organizationId === 'string'
          ? activity.organizationId
          : activity.organizationId.toString(),
    opportunityId:
      typeof activity.opportunityId === 'undefined' || activity.opportunityId === null
        ? null
        : typeof activity.opportunityId === 'string'
          ? activity.opportunityId
          : activity.opportunityId.toString(),
    occurredAt: (activity.occurredAt ?? new Date()).toISOString()
  };
}

function toCountersView(counters: {
  tenantId: Types.ObjectId | string;
  contactsActive: number;
  organizationsActive: number;
  opportunitiesOpen: number;
  opportunitiesWon: number;
  opportunitiesLost: number;
}): CrmCountersView {
  return {
    tenantId: typeof counters.tenantId === 'string' ? counters.tenantId : counters.tenantId.toString(),
    contactsActive: counters.contactsActive,
    organizationsActive: counters.organizationsActive,
    opportunitiesOpen: counters.opportunitiesOpen,
    opportunitiesWon: counters.opportunitiesWon,
    opportunitiesLost: counters.opportunitiesLost
  };
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

function isClosedOpportunityStage(stage: CrmOpportunityStage): boolean {
  return stage === 'won' || stage === 'lost';
}

export class CrmService implements CrmServiceContract {
  constructor(private readonly audit: AuditService = auditService) {}

  async createContact(input: CreateCrmContactInput): Promise<CrmContactView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const dedup = crmDedupService.buildContactKeys({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone
    });

    try {
      if (input.organizationId) {
        await this.assertOrganizationExists(tenantId, input.organizationId);
      }

      const createdContact = await CrmContactModel.create({
        tenantId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        normalizedFullName: dedup.normalizedFullName,
        email: input.email ?? null,
        normalizedEmail: dedup.normalizedEmail,
        phone: input.phone ?? null,
        normalizedPhone: dedup.normalizedPhone,
        dedupFallbackKey: dedup.dedupFallbackKey,
        organizationId: toNullableObjectId(input.organizationId),
        isActive: true,
        deletedAt: null
      });
      await this.syncCounters(tenantId);

      const view = toContactView(createdContact.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'crm.contact.create',
        resource: {
          type: 'crm_contact',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            firstName: view.firstName,
            lastName: view.lastName,
            email: view.email
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildCrmError(
          ERROR_CODES.CRM_CONTACT_ALREADY_EXISTS,
          'CRM contact already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listContacts(input: ListCrmContactsInput): Promise<CrmPaginatedResult<CrmContactView>> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.organizationId) {
      query.organizationId = new Types.ObjectId(input.organizationId);
    }

    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (input.page - 1) * input.limit;
    const [contacts, total] = await Promise.all([
      CrmContactModel.find(query).sort({ firstName: 1, lastName: 1 }).skip(skip).limit(input.limit).lean(),
      CrmContactModel.countDocuments(query)
    ]);

    return {
      items: contacts.map((contact) => toContactView(contact)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getContact(input: { tenantId: string; contactId: string }): Promise<CrmContactView> {
    const contact = await this.findActiveContact(new Types.ObjectId(input.tenantId), input.contactId);

    if (!contact) {
      throw buildCrmError(ERROR_CODES.CRM_CONTACT_NOT_FOUND, 'CRM contact not found', HTTP_STATUS.NOT_FOUND);
    }

    return toContactView(contact);
  }

  async updateContact(input: UpdateCrmContactInput): Promise<CrmContactView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const currentContact = await this.findActiveContact(tenantId, input.contactId);

    if (!currentContact) {
      throw buildCrmError(ERROR_CODES.CRM_CONTACT_NOT_FOUND, 'CRM contact not found', HTTP_STATUS.NOT_FOUND);
    }

    if (typeof input.patch.organizationId !== 'undefined' && input.patch.organizationId) {
      await this.assertOrganizationExists(tenantId, input.patch.organizationId);
    }

    const firstName = input.patch.firstName?.trim() ?? currentContact.firstName;
    const lastName = input.patch.lastName?.trim() ?? currentContact.lastName;
    const email =
      typeof input.patch.email !== 'undefined' ? input.patch.email : (currentContact.email ?? null);
    const phone =
      typeof input.patch.phone !== 'undefined' ? input.patch.phone : (currentContact.phone ?? null);
    const dedup = crmDedupService.buildContactKeys({
      firstName,
      lastName,
      email,
      phone
    });

    const updateData: Record<string, unknown> = {
      firstName,
      lastName,
      normalizedFullName: dedup.normalizedFullName,
      email,
      normalizedEmail: dedup.normalizedEmail,
      phone,
      normalizedPhone: dedup.normalizedPhone,
      dedupFallbackKey: dedup.dedupFallbackKey
    };

    if (typeof input.patch.organizationId !== 'undefined') {
      updateData.organizationId = toNullableObjectId(input.patch.organizationId);
    }

    try {
      const updatedContact = await CrmContactModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.contactId),
          tenantId,
          isActive: true
        },
        { $set: updateData },
        { new: true }
      );

      if (!updatedContact) {
        throw buildCrmError(ERROR_CODES.CRM_CONTACT_NOT_FOUND, 'CRM contact not found', HTTP_STATUS.NOT_FOUND);
      }

      const view = toContactView(updatedContact.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'crm.contact.update',
        resource: {
          type: 'crm_contact',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            firstName: view.firstName,
            lastName: view.lastName,
            email: view.email
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildCrmError(
          ERROR_CODES.CRM_CONTACT_ALREADY_EXISTS,
          'CRM contact already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async deleteContact(input: DeleteCrmContactInput): Promise<CrmContactView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const deletedContact = await CrmContactModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(input.contactId),
        tenantId,
        isActive: true
      },
      {
        $set: {
          isActive: false,
          deletedAt: new Date()
        }
      },
      {
        new: true
      }
    );

    if (!deletedContact) {
      throw buildCrmError(ERROR_CODES.CRM_CONTACT_NOT_FOUND, 'CRM contact not found', HTTP_STATUS.NOT_FOUND);
    }

    await this.syncCounters(tenantId);
    const view = toContactView(deletedContact.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.contact.delete',
      resource: {
        type: 'crm_contact',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive']
      }
    });

    return view;
  }

  async createOrganization(input: CreateCrmOrganizationInput): Promise<CrmOrganizationView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const dedup = crmDedupService.buildOrganizationKeys({
      name: input.name,
      domain: input.domain
    });

    try {
      const createdOrganization = await CrmOrganizationModel.create({
        tenantId,
        name: input.name.trim(),
        normalizedName: dedup.normalizedName,
        domain: input.domain ?? null,
        normalizedDomain: dedup.normalizedDomain,
        industry: input.industry ?? null,
        isActive: true,
        deletedAt: null
      });
      await this.syncCounters(tenantId);

      const view = toOrganizationView(createdOrganization.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'crm.organization.create',
        resource: {
          type: 'crm_organization',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            domain: view.domain
          }
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildCrmError(
          ERROR_CODES.CRM_ORGANIZATION_ALREADY_EXISTS,
          'CRM organization already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async listOrganizations(
    input: ListCrmOrganizationsInput
  ): Promise<CrmPaginatedResult<CrmOrganizationView>> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (input.page - 1) * input.limit;
    const [organizations, total] = await Promise.all([
      CrmOrganizationModel.find(query).sort({ name: 1 }).skip(skip).limit(input.limit).lean(),
      CrmOrganizationModel.countDocuments(query)
    ]);

    return {
      items: organizations.map((organization) => toOrganizationView(organization)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getOrganization(input: {
    tenantId: string;
    organizationId: string;
  }): Promise<CrmOrganizationView> {
    const organization = await this.findActiveOrganization(
      new Types.ObjectId(input.tenantId),
      input.organizationId
    );

    if (!organization) {
      throw buildCrmError(
        ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND,
        'CRM organization not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toOrganizationView(organization);
  }

  async updateOrganization(input: UpdateCrmOrganizationInput): Promise<CrmOrganizationView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const currentOrganization = await this.findActiveOrganization(tenantId, input.organizationId);

    if (!currentOrganization) {
      throw buildCrmError(
        ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND,
        'CRM organization not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const name = input.patch.name?.trim() ?? currentOrganization.name;
    const domain =
      typeof input.patch.domain !== 'undefined' ? input.patch.domain : (currentOrganization.domain ?? null);
    const dedup = crmDedupService.buildOrganizationKeys({
      name,
      domain
    });

    const updateData: Record<string, unknown> = {
      name,
      normalizedName: dedup.normalizedName,
      domain,
      normalizedDomain: dedup.normalizedDomain
    };

    if (typeof input.patch.industry !== 'undefined') {
      updateData.industry = input.patch.industry;
    }

    try {
      const updatedOrganization = await CrmOrganizationModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(input.organizationId),
          tenantId,
          isActive: true
        },
        { $set: updateData },
        { new: true }
      );

      if (!updatedOrganization) {
        throw buildCrmError(
          ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND,
          'CRM organization not found',
          HTTP_STATUS.NOT_FOUND
        );
      }

      const view = toOrganizationView(updatedOrganization.toObject());
      await this.recordAuditLog({
        context: input.context,
        tenantId: input.tenantId,
        action: 'crm.organization.update',
        resource: {
          type: 'crm_organization',
          id: view.id
        },
        severity: 'info',
        changes: {
          after: {
            name: view.name,
            domain: view.domain,
            industry: view.industry
          },
          fields: Object.keys(input.patch)
        }
      });

      return view;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw buildCrmError(
          ERROR_CODES.CRM_ORGANIZATION_ALREADY_EXISTS,
          'CRM organization already exists',
          HTTP_STATUS.CONFLICT
        );
      }

      throw error;
    }
  }

  async deleteOrganization(input: DeleteCrmOrganizationInput): Promise<CrmOrganizationView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const organizationId = new Types.ObjectId(input.organizationId);
    const [activeContacts, activeOpportunities] = await Promise.all([
      CrmContactModel.countDocuments({
        tenantId,
        organizationId,
        isActive: true
      }),
      CrmOpportunityModel.countDocuments({
        tenantId,
        organizationId,
        isActive: true
      })
    ]);

    if (activeContacts > 0 || activeOpportunities > 0) {
      throw buildCrmError(
        ERROR_CODES.CRM_ORGANIZATION_IN_USE,
        'CRM organization cannot be deleted while active references exist',
        HTTP_STATUS.CONFLICT
      );
    }

    const deletedOrganization = await CrmOrganizationModel.findOneAndUpdate(
      {
        _id: organizationId,
        tenantId,
        isActive: true
      },
      {
        $set: {
          isActive: false,
          deletedAt: new Date()
        }
      },
      {
        new: true
      }
    );

    if (!deletedOrganization) {
      throw buildCrmError(
        ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND,
        'CRM organization not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    await this.syncCounters(tenantId);
    const view = toOrganizationView(deletedOrganization.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.organization.delete',
      resource: {
        type: 'crm_organization',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive']
      }
    });

    return view;
  }

  async createOpportunity(input: CreateCrmOpportunityInput): Promise<CrmOpportunityView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);

    if (input.contactId) {
      await this.assertContactExists(tenantId, input.contactId);
    }
    if (input.organizationId) {
      await this.assertOrganizationExists(tenantId, input.organizationId);
    }

    const createdOpportunity = await CrmOpportunityModel.create({
      tenantId,
      title: input.title.trim(),
      description: input.description ?? null,
      stage: 'lead',
      amount: input.amount ?? null,
      currency: input.currency ?? null,
      contactId: toNullableObjectId(input.contactId),
      organizationId: toNullableObjectId(input.organizationId),
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
      isActive: true,
      deletedAt: null
    });
    await this.syncCounters(tenantId);

    const view = toOpportunityView(createdOpportunity.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.opportunity.create',
      resource: {
        type: 'crm_opportunity',
        id: view.id
      },
      severity: 'info',
      changes: {
        after: {
          title: view.title,
          stage: view.stage,
          amount: view.amount
        }
      }
    });

    return view;
  }

  async listOpportunities(
    input: ListCrmOpportunitiesInput
  ): Promise<CrmPaginatedResult<CrmOpportunityView>> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId),
      isActive: true
    };

    if (input.stage) {
      query.stage = input.stage;
    }
    if (input.contactId) {
      query.contactId = new Types.ObjectId(input.contactId);
    }
    if (input.organizationId) {
      query.organizationId = new Types.ObjectId(input.organizationId);
    }
    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
    }

    const skip = (input.page - 1) * input.limit;
    const [opportunities, total] = await Promise.all([
      CrmOpportunityModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
      CrmOpportunityModel.countDocuments(query)
    ]);

    return {
      items: opportunities.map((opportunity) => toOpportunityView(opportunity)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getOpportunity(input: { tenantId: string; opportunityId: string }): Promise<CrmOpportunityView> {
    const opportunity = await this.findActiveOpportunity(
      new Types.ObjectId(input.tenantId),
      input.opportunityId
    );

    if (!opportunity) {
      throw buildCrmError(
        ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND,
        'CRM opportunity not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return toOpportunityView(opportunity);
  }

  async updateOpportunity(input: UpdateCrmOpportunityInput): Promise<CrmOpportunityView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);

    if (typeof input.patch.contactId !== 'undefined' && input.patch.contactId) {
      await this.assertContactExists(tenantId, input.patch.contactId);
    }
    if (typeof input.patch.organizationId !== 'undefined' && input.patch.organizationId) {
      await this.assertOrganizationExists(tenantId, input.patch.organizationId);
    }

    const updateData: Record<string, unknown> = {};

    if (typeof input.patch.title === 'string') {
      updateData.title = input.patch.title.trim();
    }
    if (typeof input.patch.description !== 'undefined') {
      updateData.description = input.patch.description;
    }
    if (typeof input.patch.amount !== 'undefined') {
      updateData.amount = input.patch.amount;
    }
    if (typeof input.patch.currency !== 'undefined') {
      updateData.currency = input.patch.currency;
    }
    if (typeof input.patch.contactId !== 'undefined') {
      updateData.contactId = toNullableObjectId(input.patch.contactId);
    }
    if (typeof input.patch.organizationId !== 'undefined') {
      updateData.organizationId = toNullableObjectId(input.patch.organizationId);
    }
    if (typeof input.patch.expectedCloseDate !== 'undefined') {
      updateData.expectedCloseDate =
        input.patch.expectedCloseDate === null ? null : new Date(input.patch.expectedCloseDate);
    }

    const updatedOpportunity = await CrmOpportunityModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(input.opportunityId),
        tenantId,
        isActive: true
      },
      {
        $set: updateData
      },
      {
        new: true
      }
    );

    if (!updatedOpportunity) {
      throw buildCrmError(
        ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND,
        'CRM opportunity not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    const view = toOpportunityView(updatedOpportunity.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.opportunity.update',
      resource: {
        type: 'crm_opportunity',
        id: view.id
      },
      severity: 'info',
      changes: {
        after: {
          title: view.title,
          stage: view.stage,
          amount: view.amount
        },
        fields: Object.keys(input.patch)
      }
    });

    return view;
  }

  async deleteOpportunity(input: DeleteCrmOpportunityInput): Promise<CrmOpportunityView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    const deletedOpportunity = await CrmOpportunityModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(input.opportunityId),
        tenantId,
        isActive: true
      },
      {
        $set: {
          isActive: false,
          deletedAt: new Date()
        }
      },
      {
        new: true
      }
    );

    if (!deletedOpportunity) {
      throw buildCrmError(
        ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND,
        'CRM opportunity not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    await this.syncCounters(tenantId);
    const view = toOpportunityView(deletedOpportunity.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.opportunity.delete',
      resource: {
        type: 'crm_opportunity',
        id: view.id
      },
      severity: 'warning',
      changes: {
        after: {
          isActive: false
        },
        fields: ['isActive']
      }
    });

    return view;
  }

  async changeOpportunityStage(input: ChangeCrmOpportunityStageInput): Promise<CrmOpportunityView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    if (!CRM_OPPORTUNITY_STAGES.includes(input.stage)) {
      throw buildCrmError(
        ERROR_CODES.CRM_OPPORTUNITY_STAGE_INVALID,
        'CRM opportunity stage is invalid',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const tenantId = new Types.ObjectId(input.tenantId);
    const session = await mongoose.startSession();
    let view: CrmOpportunityView | null = null;

    try {
      await session.withTransaction(async () => {
        const opportunity = await CrmOpportunityModel.findOne({
          _id: new Types.ObjectId(input.opportunityId),
          tenantId,
          isActive: true
        }).session(session);

        if (!opportunity) {
          throw buildCrmError(
            ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND,
            'CRM opportunity not found',
            HTTP_STATUS.NOT_FOUND
          );
        }

        const previousStage = opportunity.stage as CrmOpportunityStage;
        if (previousStage !== input.stage) {
          const allowedTransitions = OPPORTUNITY_STAGE_TRANSITIONS[previousStage] ?? [];
          if (!allowedTransitions.includes(input.stage)) {
            throw buildCrmError(
              ERROR_CODES.CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID,
              'CRM opportunity stage transition is not allowed',
              HTTP_STATUS.CONFLICT
            );
          }
        }

        opportunity.stage = input.stage;
        await opportunity.save({ session });
        await this.syncCounters(tenantId, session);

        view = toOpportunityView(opportunity.toObject());
        await this.recordAuditLog(
          {
            context: input.context,
            tenantId: input.tenantId,
            action: 'crm.opportunity.stage.change',
            resource: {
              type: 'crm_opportunity',
              id: view.id
            },
            severity: isClosedOpportunityStage(input.stage) ? 'warning' : 'info',
            changes: {
              before: {
                stage: previousStage
              },
              after: {
                stage: input.stage
              },
              fields: ['stage']
            },
            metadata: {
              stage: input.stage
            }
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    if (!view) {
      throw buildCrmError(
        ERROR_CODES.INTERNAL_ERROR,
        'CRM opportunity stage was not updated',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return view;
  }

  async createActivity(input: CreateCrmActivityInput): Promise<CrmActivityView> {
    assertTenantContextConsistency(input.tenantId, input.context);
    const tenantId = new Types.ObjectId(input.tenantId);
    await this.assertActivityReferences(tenantId, {
      contactId: input.contactId ?? null,
      organizationId: input.organizationId ?? null,
      opportunityId: input.opportunityId ?? null
    });

    const createdActivity = await CrmActivityModel.create({
      tenantId,
      type: input.type.trim(),
      note: input.note.trim(),
      contactId: toNullableObjectId(input.contactId),
      organizationId: toNullableObjectId(input.organizationId),
      opportunityId: toNullableObjectId(input.opportunityId),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date()
    });

    const view = toActivityView(createdActivity.toObject());
    await this.recordAuditLog({
      context: input.context,
      tenantId: input.tenantId,
      action: 'crm.activity.create',
      resource: {
        type: 'crm_activity',
        id: view.id
      },
      severity: 'info',
      changes: {
        after: {
          type: view.type
        }
      }
    });

    return view;
  }

  async listActivities(input: ListCrmActivitiesInput): Promise<CrmPaginatedResult<CrmActivityView>> {
    const query: Record<string, unknown> = {
      tenantId: new Types.ObjectId(input.tenantId)
    };

    if (input.contactId) {
      query.contactId = new Types.ObjectId(input.contactId);
    }
    if (input.organizationId) {
      query.organizationId = new Types.ObjectId(input.organizationId);
    }
    if (input.opportunityId) {
      query.opportunityId = new Types.ObjectId(input.opportunityId);
    }
    if (input.search) {
      const search = escapeRegexLiteral(input.search);
      query.$or = [{ type: { $regex: search, $options: 'i' } }, { note: { $regex: search, $options: 'i' } }];
    }

    const skip = (input.page - 1) * input.limit;
    const [activities, total] = await Promise.all([
      CrmActivityModel.find(query).sort({ occurredAt: -1 }).skip(skip).limit(input.limit).lean(),
      CrmActivityModel.countDocuments(query)
    ]);

    return {
      items: activities.map((activity) => toActivityView(activity)),
      page: input.page,
      limit: input.limit,
      total
    };
  }

  async getCounters(input: { tenantId: string }): Promise<CrmCountersView> {
    const tenantId = new Types.ObjectId(input.tenantId);
    const counters = await CrmCounterModel.findOne({ tenantId }).lean();

    if (counters) {
      return toCountersView(counters);
    }

    const snapshot = await this.buildCountersSnapshot(tenantId);
    return toCountersView(snapshot);
  }

  private async syncCounters(
    tenantId: Types.ObjectId,
    session?: ClientSession
  ): Promise<CrmCountersView> {
    const snapshot = await this.buildCountersSnapshot(tenantId, session);

    const counters = await CrmCounterModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          contactsActive: snapshot.contactsActive,
          organizationsActive: snapshot.organizationsActive,
          opportunitiesOpen: snapshot.opportunitiesOpen,
          opportunitiesWon: snapshot.opportunitiesWon,
          opportunitiesLost: snapshot.opportunitiesLost
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        session
      }
    ).lean();

    if (!counters) {
      throw buildCrmError(
        ERROR_CODES.INTERNAL_ERROR,
        'CRM counters could not be synchronized',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return toCountersView(counters);
  }

  private async buildCountersSnapshot(
    tenantId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{
    tenantId: Types.ObjectId;
    contactsActive: number;
    organizationsActive: number;
    opportunitiesOpen: number;
    opportunitiesWon: number;
    opportunitiesLost: number;
  }> {
    const [contactsActive, organizationsActive, opportunitiesOpen, opportunitiesWon, opportunitiesLost] =
      await Promise.all([
        CrmContactModel.countDocuments({ tenantId, isActive: true }).session(session ?? null),
        CrmOrganizationModel.countDocuments({ tenantId, isActive: true }).session(session ?? null),
        CrmOpportunityModel.countDocuments({
          tenantId,
          isActive: true,
          stage: { $nin: ['won', 'lost'] }
        }).session(session ?? null),
        CrmOpportunityModel.countDocuments({ tenantId, isActive: true, stage: 'won' }).session(session ?? null),
        CrmOpportunityModel.countDocuments({ tenantId, isActive: true, stage: 'lost' }).session(session ?? null)
      ]);

    return {
      tenantId,
      contactsActive,
      organizationsActive,
      opportunitiesOpen,
      opportunitiesWon,
      opportunitiesLost
    };
  }

  private async assertContactExists(
    tenantId: Types.ObjectId,
    contactId: string,
    session?: ClientSession
  ): Promise<void> {
    const contact = await this.findActiveContact(tenantId, contactId, session);

    if (!contact) {
      throw buildCrmError(ERROR_CODES.CRM_CONTACT_NOT_FOUND, 'CRM contact not found', HTTP_STATUS.NOT_FOUND);
    }
  }

  private async assertOrganizationExists(
    tenantId: Types.ObjectId,
    organizationId: string,
    session?: ClientSession
  ): Promise<void> {
    const organization = await this.findActiveOrganization(tenantId, organizationId, session);

    if (!organization) {
      throw buildCrmError(
        ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND,
        'CRM organization not found',
        HTTP_STATUS.NOT_FOUND
      );
    }
  }

  private async assertOpportunityExists(
    tenantId: Types.ObjectId,
    opportunityId: string,
    session?: ClientSession
  ): Promise<void> {
    const opportunity = await this.findActiveOpportunity(tenantId, opportunityId, session);

    if (!opportunity) {
      throw buildCrmError(
        ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND,
        'CRM opportunity not found',
        HTTP_STATUS.NOT_FOUND
      );
    }
  }

  private async assertActivityReferences(
    tenantId: Types.ObjectId,
    references: {
      contactId: string | null;
      organizationId: string | null;
      opportunityId: string | null;
    },
    session?: ClientSession
  ): Promise<void> {
    if (!references.contactId && !references.organizationId && !references.opportunityId) {
      throw buildCrmError(
        ERROR_CODES.CRM_ACTIVITY_REFERENCE_INVALID,
        'CRM activity references are invalid',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      await Promise.all([
        references.contactId ? this.assertContactExists(tenantId, references.contactId, session) : undefined,
        references.organizationId
          ? this.assertOrganizationExists(tenantId, references.organizationId, session)
          : undefined,
        references.opportunityId
          ? this.assertOpportunityExists(tenantId, references.opportunityId, session)
          : undefined
      ]);
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === ERROR_CODES.CRM_CONTACT_NOT_FOUND ||
          error.code === ERROR_CODES.CRM_ORGANIZATION_NOT_FOUND ||
          error.code === ERROR_CODES.CRM_OPPORTUNITY_NOT_FOUND)
      ) {
        throw buildCrmError(
          ERROR_CODES.CRM_ACTIVITY_REFERENCE_INVALID,
          'CRM activity references are invalid',
          HTTP_STATUS.BAD_REQUEST
        );
      }

      throw error;
    }
  }

  private async findActiveContact(
    tenantId: Types.ObjectId,
    contactId: string,
    session?: ClientSession
  ): Promise<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    organizationId?: Types.ObjectId | null;
    isActive: boolean;
  } | null> {
    return CrmContactModel.findOne({
      _id: new Types.ObjectId(contactId),
      tenantId,
      isActive: true
    })
      .session(session ?? null)
      .lean();
  }

  private async findActiveOrganization(
    tenantId: Types.ObjectId,
    organizationId: string,
    session?: ClientSession
  ): Promise<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    name: string;
    domain?: string | null;
    industry?: string | null;
    isActive: boolean;
  } | null> {
    return CrmOrganizationModel.findOne({
      _id: new Types.ObjectId(organizationId),
      tenantId,
      isActive: true
    })
      .session(session ?? null)
      .lean();
  }

  private async findActiveOpportunity(
    tenantId: Types.ObjectId,
    opportunityId: string,
    session?: ClientSession
  ): Promise<{
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    title: string;
    description?: string | null;
    stage: CrmOpportunityStage;
    amount?: number | null;
    currency?: string | null;
    contactId?: Types.ObjectId | null;
    organizationId?: Types.ObjectId | null;
    expectedCloseDate?: Date | null;
    isActive: boolean;
  } | null> {
    return CrmOpportunityModel.findOne({
      _id: new Types.ObjectId(opportunityId),
      tenantId,
      isActive: true
    })
      .session(session ?? null)
      .lean();
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
      metadata?: AuditJsonObject;
    },
    options: RecordAuditLogOptions = {}
  ): Promise<void> {
    const auditContext = auditContextFactory.create({
      executionContext: input.context,
      tenant: toTenantAuditScope(input.tenantId, input.context),
      action: input.action,
      resource: input.resource,
      severity: input.severity,
      changes: input.changes,
      metadata: input.metadata
    });

    await this.audit.record(auditContext, options);
  }
}

export const crmService = new CrmService();
