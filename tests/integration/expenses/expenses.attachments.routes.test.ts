import { Types } from 'mongoose';
import request from 'supertest';

import { APP_CONFIG } from '@/config/app';
import {
  buildAccessToken,
  buildExpensesServiceMock,
  createExpensesTestApp,
  mockActiveSession,
  mockTenantMembership
} from './expenses.test-helpers';

describe('expenses attachments routes', () => {
  beforeEach(() => {
    mockActiveSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates upload presign for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.createUploadPresign.mockResolvedValue({
      url: 'https://uploads.example.com/presign',
      method: 'PUT',
      headers: {
        'x-upload-token': 'token'
      },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      objectKey: `expenses/${tenantId.toString()}/${requestId.toString()}/invoice.pdf`
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post('/api/v1/modules/expenses/uploads/presign')
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        requestId: requestId.toString(),
        originalFilename: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048
      });

    expect(response.status).toBe(200);
    expect(service.createUploadPresign).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requestId: requestId.toString(),
        actorUserId: userId.toString()
      })
    );
  });

  it('creates attachment metadata for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.createAttachment.mockResolvedValue({
      id: new Types.ObjectId().toString(),
      tenantId: tenantId.toString(),
      requestId: requestId.toString(),
      storageProvider: 's3',
      objectKey: `expenses/${tenantId.toString()}/${requestId.toString()}/invoice.pdf`,
      originalFilename: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksumSha256: 'a'.repeat(64),
      uploadedByUserId: userId.toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post(`/api/v1/modules/expenses/requests/${requestId.toString()}/attachments`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        storageProvider: 's3',
        objectKey: `expenses/${tenantId.toString()}/${requestId.toString()}/invoice.pdf`,
        originalFilename: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksumSha256: 'a'.repeat(64)
      });

    expect(response.status).toBe(201);
    expect(service.createAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantId.toString(),
        requestId: requestId.toString(),
        actorUserId: userId.toString()
      })
    );
  });

  it('lists request attachments for tenant member', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    service.listAttachments.mockResolvedValue([
      {
        id: new Types.ObjectId().toString(),
        tenantId: tenantId.toString(),
        requestId: requestId.toString(),
        storageProvider: 's3',
        objectKey: 'expenses/file.pdf',
        originalFilename: 'file.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        checksumSha256: 'b'.repeat(64),
        uploadedByUserId: userId.toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .get(`/api/v1/modules/expenses/requests/${requestId.toString()}/attachments`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString());

    expect(response.status).toBe(200);
    expect(service.listAttachments).toHaveBeenCalledWith({
      tenantId: tenantId.toString(),
      requestId: requestId.toString()
    });
    expect(response.body.success).toBe(true);
  });

  it('validates checksum format when creating attachment', async () => {
    const tenantId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const service = buildExpensesServiceMock();
    const app = createExpensesTestApp(service);
    mockTenantMembership({
      tenantId,
      userId,
      roleKey: 'tenant:member'
    });

    const response = await request(app)
      .post(`/api/v1/modules/expenses/requests/${requestId.toString()}/attachments`)
      .set('Authorization', `Bearer ${buildAccessToken(userId.toString())}`)
      .set(APP_CONFIG.TENANT_ID_HEADER, tenantId.toString())
      .send({
        storageProvider: 's3',
        objectKey: 'expenses/file.pdf',
        originalFilename: 'file.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        checksumSha256: 'invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GEN_VALIDATION_ERROR');
    expect(service.createAttachment).not.toHaveBeenCalled();
  });
});
