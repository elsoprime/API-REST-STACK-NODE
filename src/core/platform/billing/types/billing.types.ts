import { type BillingCheckoutStatus, type BillingProvider, type BillingWebhookEventType } from '@/constants/billing';
import { type ExecutionContext } from '@/core/platform/context/types/execution-context.types';

export interface BillingPlanView {
  key: string;
  name: string;
  description: string;
  rank: number;
  allowedModuleKeys: string[];
  featureFlagKeys: string[];
  memberLimit: number | null;
}

export interface BillingPlanCatalogResult {
  items: BillingPlanView[];
}

export interface CreateCheckoutSessionInput {
  tenantId: string;
  userId: string;
  planId: string;
  provider: BillingProvider;
  context?: ExecutionContext;
}

export interface BillingCheckoutSessionView {
  id: string;
  tenantId: string;
  planId: string;
  provider: BillingProvider;
  providerSessionId: string;
  status: BillingCheckoutStatus;
  checkoutUrl: string;
  createdAt: string;
  expiresAt: string;
  activatedAt: string | null;
}

export interface BillingWebhookData {
  tenantId: string;
  planId?: string | null;
  checkoutSessionId?: string;
  providerSessionId?: string;
  reason?: string;
}

export interface ProcessBillingWebhookInput {
  signature: string | null;
  timestamp: string | null;
  rawBody?: string | null;
  payload: {
    id: string;
    type: BillingWebhookEventType;
    provider: BillingProvider;
    data: BillingWebhookData;
    createdAt?: string;
  };
  context?: ExecutionContext;
}

export interface BillingWebhookProcessResult {
  eventId: string;
  provider: BillingProvider;
  type: BillingWebhookEventType;
  status: 'processed' | 'duplicate' | 'ignored';
  checkoutSessionId: string | null;
  tenantId: string | null;
}

export interface BillingServiceContract {
  listPlans: () => Promise<BillingPlanCatalogResult>;
  createCheckoutSession: (input: CreateCheckoutSessionInput) => Promise<BillingCheckoutSessionView>;
  processProviderWebhook: (input: ProcessBillingWebhookInput) => Promise<BillingWebhookProcessResult>;
}