import { readFile } from 'node:fs/promises';

import { connectToDatabase, disconnectFromDatabase } from '@/infrastructure/database/connection';
import { MembershipModel } from '@/core/tenant/models/membership.model';
import { TENANT_ROLE_KEYS } from '@/constants/tenant';

interface AdminBackfillEntry {
  tenantId: string;
  userId: string;
}

async function loadBackfillFile(path: string): Promise<AdminBackfillEntry[]> {
  const raw = await readFile(path, { encoding: 'utf8' });
  const parsed = JSON.parse(raw) as AdminBackfillEntry[];

  if (!Array.isArray(parsed)) {
    throw new Error('Backfill file must contain an array of entries.');
  }

  return parsed;
}

async function run() {
  const backfillPath = process.env.TENANT_ADMIN_BACKFILL_PATH;
  const dryRun = (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false';

  if (!backfillPath) {
    throw new Error('TENANT_ADMIN_BACKFILL_PATH is required to run this migration.');
  }

  const entries = await loadBackfillFile(backfillPath);

  let updated = 0;

  for (const entry of entries) {
    const membership = await MembershipModel.findOne({
      tenantId: entry.tenantId,
      userId: entry.userId
    });

    if (!membership) {
      console.warn('[migration] membership not found', entry);
      continue;
    }

    if (membership.roleKey === TENANT_ROLE_KEYS.ADMIN) {
      continue;
    }

    if (dryRun) {
      console.log('[migration] dry-run update', {
        tenantId: entry.tenantId,
        userId: entry.userId,
        from: membership.roleKey,
        to: TENANT_ROLE_KEYS.ADMIN
      });
      continue;
    }

    membership.roleKey = TENANT_ROLE_KEYS.ADMIN;
    await membership.save();
    updated += 1;
  }
  console.log(`[migration] tenant admin backfill complete. updated=${updated} dryRun=${dryRun}`);
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

