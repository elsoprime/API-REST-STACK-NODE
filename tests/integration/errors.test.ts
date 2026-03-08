import request from 'supertest';

import { createServer } from '@/app/server';

describe('error middleware pipeline', () => {
  it('returns the contract envelope for unknown routes', async () => {
    const app = createServer();
    const response = await request(app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'GEN_NOT_FOUND',
        message: 'Route not found'
      }
    });
    expect(response.body.traceId).toBeDefined();
    expect(response.headers['x-trace-id']).toBe(response.body.traceId);
  });

  it('returns the contract envelope for unexpected errors', async () => {
    const app = createServer({
      configureApp: (server) => {
        server.get('/boom', () => {
          throw new Error('boom');
        });
      }
    });

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'GEN_INTERNAL_ERROR',
        message: 'Internal server error'
      }
    });
    expect(response.body.traceId).toBeDefined();
    expect(response.headers['x-trace-id']).toBe(response.body.traceId);
  });
});
