/* global process, console */
import { createHmac } from 'node:crypto';

function getArg(name) {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : null;
}

function requireArg(name, fallback = null) {
  const value = getArg(name) ?? fallback;
  if (!value) {
    throw new Error(`Missing required argument --${name}`);
  }
  return value;
}

const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '');
const webhookSecret = process.env.BILLING_WEBHOOK_SECRET ?? '';

if (!appUrl) {
  throw new Error('APP_URL is required in environment');
}

if (!webhookSecret) {
  throw new Error('BILLING_WEBHOOK_SECRET is required in environment');
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('This simulator is blocked in production environment');
}

const payload = {
  id: requireArg('event-id', `evt_demo_${Date.now()}`),
  provider: requireArg('provider', process.env.BILLING_PROVIDER ?? 'simulated'),
  type: requireArg('type', 'billing.checkout.paid'),
  data: {
    tenantId: requireArg('tenant-id'),
    planId: getArg('plan-id') ?? undefined,
    checkoutSessionId: getArg('checkout-session-id') ?? undefined,
    providerSessionId: getArg('provider-session-id') ?? undefined,
    reason: getArg('reason') ?? undefined
  }
};

if (!payload.data.checkoutSessionId && !payload.data.providerSessionId) {
  throw new Error('Provide --checkout-session-id or --provider-session-id');
}

const timestampSeconds = Math.floor(Date.now() / 1000);
const rawPayload = JSON.stringify(payload);
const signature = createHmac('sha256', webhookSecret)
  .update(`${timestampSeconds}.${rawPayload}`)
  .digest('hex');

const response = await globalThis.fetch(`${appUrl}/api/v1/billing/webhooks/provider`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Billing-Signature': signature,
    'X-Billing-Timestamp': String(timestampSeconds)
  },
  body: rawPayload
});

const body = await response.text();
console.log(`status=${response.status}`);
console.log(body);
