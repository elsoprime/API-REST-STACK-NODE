import { connectToDatabase, disconnectFromDatabase } from '@/infrastructure/database/connection';
import { TenantModel } from '@/core/tenant/models/tenant.model';
import { TENANT_SUBSCRIPTION_STATUS } from '@/constants/tenant';

async function run() {
  const cursor = TenantModel.find({
    $or: [{ subscriptionStatus: { $exists: false } }, { subscriptionStatus: null }]
  }).cursor();

  let scanned = 0;
  let updated = 0;

  for await (const tenant of cursor) {
    scanned += 1;
    tenant.subscriptionStatus = tenant.planId
      ? TENANT_SUBSCRIPTION_STATUS.ACTIVE
      : TENANT_SUBSCRIPTION_STATUS.PENDING;
    tenant.subscriptionGraceEndsAt = null;
    await tenant.save();
    updated += 1;
  }
  console.log(`[migration] scanned=${scanned} updated=${updated}`);
}

connectToDatabase()
  .then(run)
  .then(async () => {
    await disconnectFromDatabase();
  })
  .catch(async (error) => {
    console.error('[migration] failed', error);
    await disconnectFromDatabase();
    process.exitCode = 1;
  });

