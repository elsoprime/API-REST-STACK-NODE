import request from 'supertest';

import { createServer } from '@/app/server';
import { APP_CONFIG } from '@/config/app';
import { AuthSessionModel } from '@/core/platform/auth/models/auth-session.model';
import { tokenService } from '@/core/platform/auth/services/token.service';

describe('go-live staging smoke suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes /health with runtime readiness checks', async () => {
    const app = createServer();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: expect.any(String),
        db: expect.any(String),
        ready: expect.any(Boolean),
        checks: {
          database: expect.any(Boolean),
          productionDeliveryAdapters: expect.any(Boolean)
        }
      },
      traceId: expect.any(String)
    });
  });

  it('keeps go-live critical routes mounted under contract paths', async () => {
    const app = createServer();
    const probes = [
      request(app).post('/api/v1/auth/register').send({}),
      request(app).post('/api/v1/auth/login/headless').send({}),
      request(app).post('/api/v1/tenant').send({}),
      request(app).post('/api/v1/tenant/invitations/accept').send({}),
      request(app).get('/api/v1/tenant/settings/effective'),
      request(app).get('/api/v1/modules/inventory/categories'),
      request(app).get('/api/v1/audit')
    ];

    const responses = await Promise.all(probes);

    for (const response of responses) {
      expect(response.status).not.toBe(404);
      expect(response.body.traceId).toBeDefined();
    }
  });

  it('enforces X-Tenant-Id on tenant-scoped inventory routes', async () => {
    const app = createServer();
    const userId = '507f1f77bcf86cd799439010';
    const sessionId = '507f1f77bcf86cd799439011';
    const accessToken = tokenService.signAccessToken({
      sub: userId,
      sid: sessionId,
      scope: ['platform:self']
    });

    vi.spyOn(AuthSessionModel, 'findById').mockResolvedValue({
      _id: sessionId,
      userId,
      status: 'active',
      expiresAt: new Date(Date.now() + 60_000)
    } as never);

    const response = await request(app)
      .get('/api/v1/modules/inventory/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'TENANT_HEADER_REQUIRED'
      }
    });
    expect(response.headers[APP_CONFIG.TRACE_ID_HEADER.toLowerCase()]).toBeDefined();
  });
});
