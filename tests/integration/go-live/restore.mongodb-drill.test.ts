import mongoose from 'mongoose';

import { connectToDatabase, disconnectFromDatabase } from '@/infrastructure/database/connection';

interface RestoreArtifactRecord {
  readonly tenantId: string;
  readonly resourceType: 'tenant' | 'membership' | 'inventory_item' | 'audit_log';
  readonly resourceId: string;
  readonly payload: Record<string, unknown>;
}

interface RestoreArtifact {
  readonly generatedAt: string;
  readonly version: string;
  readonly records: RestoreArtifactRecord[];
}

function buildRestoreArtifact(records: RestoreArtifactRecord[]): RestoreArtifact {
  return {
    generatedAt: new Date().toISOString(),
    version: 'stage-11-restore-mongodb-drill-v1',
    records
  };
}

function cloneRestoreArtifactRecords(records: readonly RestoreArtifactRecord[]): RestoreArtifactRecord[] {
  return records.map((record) => ({
    tenantId: record.tenantId,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    payload: structuredClone(record.payload)
  }));
}

const describeMongoRestoreDrill =
  process.env.ENABLE_MONGODB_RESTORE_DRILL === 'true' ? describe : describe.skip;

describeMongoRestoreDrill('go-live restore drill (mongodb integration)', () => {
  const collectionName = `go_live_restore_drill_${Date.now()}_${Math.round(Math.random() * 10_000)}`;

  beforeAll(async () => {
    await connectToDatabase();
  }, 30_000);

  afterAll(async () => {
    const db = mongoose.connection.db;
    if (db) {
      await db.collection(collectionName).deleteMany({});
    }

    await disconnectFromDatabase();
  });

  it('restores persisted records after destructive deletion using a backup artifact', async () => {
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('MongoDB connection is required for restore drill');
    }

    const collection = db.collection(collectionName);

    const seedRecords: RestoreArtifactRecord[] = [
      {
        tenantId: 'tenant-a',
        resourceType: 'tenant',
        resourceId: 'tenant-a',
        payload: { name: 'Acme' }
      },
      {
        tenantId: 'tenant-a',
        resourceType: 'inventory_item',
        resourceId: 'item-1',
        payload: { sku: 'SKU-1', stock: 12 }
      },
      {
        tenantId: 'tenant-b',
        resourceType: 'inventory_item',
        resourceId: 'item-2',
        payload: { sku: 'SKU-2', stock: 8 }
      }
    ];

    await collection.insertMany(seedRecords);

    const backupRecords = (await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ tenantId: 1, resourceId: 1 })
      .toArray()) as RestoreArtifactRecord[];
    const backupArtifact = buildRestoreArtifact(backupRecords);

    expect(backupArtifact.records).toHaveLength(3);
    expect(new Date(backupArtifact.generatedAt).toISOString()).toBe(backupArtifact.generatedAt);

    await collection.deleteMany({});
    expect(await collection.countDocuments({})).toBe(0);

    await collection.insertMany(cloneRestoreArtifactRecords(backupArtifact.records));

    const restoredRecords = (await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ tenantId: 1, resourceId: 1 })
      .toArray()) as RestoreArtifactRecord[];

    expect(restoredRecords).toEqual(backupArtifact.records);

    const tenantARecords = restoredRecords.filter((record) => record.tenantId === 'tenant-a');
    expect(tenantARecords.every((record) => record.tenantId === 'tenant-a')).toBe(true);
    expect(tenantARecords.some((record) => record.resourceId === 'item-2')).toBe(false);
  });
});
