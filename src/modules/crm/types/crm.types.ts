import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export const CRM_OPPORTUNITY_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost'
] as const;

export type CrmOpportunityStage = (typeof CRM_OPPORTUNITY_STAGES)[number];

export interface CrmContactView {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  organizationId: string | null;
  isActive: boolean;
}

export interface CrmOrganizationView {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  industry: string | null;
  isActive: boolean;
}

export interface CrmOpportunityView {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  stage: CrmOpportunityStage;
  amount: number | null;
  currency: string | null;
  contactId: string | null;
  organizationId: string | null;
  expectedCloseDate: string | null;
  isActive: boolean;
}

export interface CrmActivityView {
  id: string;
  tenantId: string;
  type: string;
  note: string;
  contactId: string | null;
  organizationId: string | null;
  opportunityId: string | null;
  occurredAt: string;
}

export interface CrmCountersView {
  tenantId: string;
  contactsActive: number;
  organizationsActive: number;
  opportunitiesOpen: number;
  opportunitiesWon: number;
  opportunitiesLost: number;
}

export interface CrmPaginatedResult<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
}

export interface CrmListInputBase {
  tenantId: string;
  page: number;
  limit: number;
  search?: string;
}

export interface ListCrmContactsInput extends CrmListInputBase {
  organizationId?: string;
}

export type ListCrmOrganizationsInput = CrmListInputBase;

export interface ListCrmOpportunitiesInput extends CrmListInputBase {
  stage?: CrmOpportunityStage;
  contactId?: string;
  organizationId?: string;
}

export interface ListCrmActivitiesInput extends CrmListInputBase {
  contactId?: string;
  organizationId?: string;
  opportunityId?: string;
}

export interface CreateCrmContactInput {
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  organizationId?: string | null;
  context?: ExecutionContext;
}

export interface UpdateCrmContactPatch {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  organizationId?: string | null;
}

export interface UpdateCrmContactInput {
  tenantId: string;
  contactId: string;
  patch: UpdateCrmContactPatch;
  context?: ExecutionContext;
}

export interface DeleteCrmContactInput {
  tenantId: string;
  contactId: string;
  context?: ExecutionContext;
}

export interface CreateCrmOrganizationInput {
  tenantId: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  context?: ExecutionContext;
}

export interface UpdateCrmOrganizationPatch {
  name?: string;
  domain?: string | null;
  industry?: string | null;
}

export interface UpdateCrmOrganizationInput {
  tenantId: string;
  organizationId: string;
  patch: UpdateCrmOrganizationPatch;
  context?: ExecutionContext;
}

export interface DeleteCrmOrganizationInput {
  tenantId: string;
  organizationId: string;
  context?: ExecutionContext;
}

export interface CreateCrmOpportunityInput {
  tenantId: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
  expectedCloseDate?: string | null;
  context?: ExecutionContext;
}

export interface UpdateCrmOpportunityPatch {
  title?: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
  expectedCloseDate?: string | null;
}

export interface UpdateCrmOpportunityInput {
  tenantId: string;
  opportunityId: string;
  patch: UpdateCrmOpportunityPatch;
  context?: ExecutionContext;
}

export interface DeleteCrmOpportunityInput {
  tenantId: string;
  opportunityId: string;
  context?: ExecutionContext;
}

export interface ChangeCrmOpportunityStageInput {
  tenantId: string;
  opportunityId: string;
  stage: CrmOpportunityStage;
  context?: ExecutionContext;
}

export interface CreateCrmActivityInput {
  tenantId: string;
  type: string;
  note: string;
  contactId?: string | null;
  organizationId?: string | null;
  opportunityId?: string | null;
  occurredAt?: string;
  context?: ExecutionContext;
}

export interface CrmServiceContract {
  createContact: (input: CreateCrmContactInput) => Promise<CrmContactView>;
  listContacts: (input: ListCrmContactsInput) => Promise<CrmPaginatedResult<CrmContactView>>;
  getContact: (input: { tenantId: string; contactId: string }) => Promise<CrmContactView>;
  updateContact: (input: UpdateCrmContactInput) => Promise<CrmContactView>;
  deleteContact: (input: DeleteCrmContactInput) => Promise<CrmContactView>;
  createOrganization: (input: CreateCrmOrganizationInput) => Promise<CrmOrganizationView>;
  listOrganizations: (
    input: ListCrmOrganizationsInput
  ) => Promise<CrmPaginatedResult<CrmOrganizationView>>;
  getOrganization: (input: { tenantId: string; organizationId: string }) => Promise<CrmOrganizationView>;
  updateOrganization: (input: UpdateCrmOrganizationInput) => Promise<CrmOrganizationView>;
  deleteOrganization: (input: DeleteCrmOrganizationInput) => Promise<CrmOrganizationView>;
  createOpportunity: (input: CreateCrmOpportunityInput) => Promise<CrmOpportunityView>;
  listOpportunities: (
    input: ListCrmOpportunitiesInput
  ) => Promise<CrmPaginatedResult<CrmOpportunityView>>;
  getOpportunity: (input: { tenantId: string; opportunityId: string }) => Promise<CrmOpportunityView>;
  updateOpportunity: (input: UpdateCrmOpportunityInput) => Promise<CrmOpportunityView>;
  deleteOpportunity: (input: DeleteCrmOpportunityInput) => Promise<CrmOpportunityView>;
  changeOpportunityStage: (input: ChangeCrmOpportunityStageInput) => Promise<CrmOpportunityView>;
  createActivity: (input: CreateCrmActivityInput) => Promise<CrmActivityView>;
  listActivities: (input: ListCrmActivitiesInput) => Promise<CrmPaginatedResult<CrmActivityView>>;
  getCounters: (input: { tenantId: string }) => Promise<CrmCountersView>;
}
