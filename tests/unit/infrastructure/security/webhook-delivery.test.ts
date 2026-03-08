import http from 'node:http';

import { postDeliveryWebhook } from '@/infrastructure/security/webhook-delivery';

function startHttpServer(
  handler: Parameters<typeof http.createServer>[0]
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve ephemeral HTTP test port'));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: async () => {
          await new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error);
                return;
              }

              resolveClose();
            });
          });
        }
      });
    });
  });
}

describe('webhook delivery transport', () => {
  it('sends JSON payload and resolves on 2xx response', async () => {
    const server = await startHttpServer((req, res) => {
      expect(req.method).toBe('POST');
      expect(req.headers['content-type']).toContain('application/json');
      expect(req.headers.authorization).toBe('Bearer token-1');
      res.statusCode = 204;
      res.end();
    });

    try {
      await expect(
        postDeliveryWebhook({
          webhookUrl: `${server.url}/deliver`,
          payload: { event: 'auth.email_verification' },
          timeoutMs: 500,
          bearerToken: 'token-1'
        })
      ).resolves.toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it('rejects on non-2xx responses with status code context', async () => {
    const server = await startHttpServer((_req, res) => {
      res.statusCode = 503;
      res.end('service unavailable');
    });

    try {
      await expect(
        postDeliveryWebhook({
          webhookUrl: `${server.url}/deliver`,
          payload: { event: 'tenant.invitation' },
          timeoutMs: 500
        })
      ).rejects.toThrow('Delivery webhook failed with status 503');
    } finally {
      await server.close();
    }
  });

  it('rejects on timeout when the remote endpoint does not respond in time', async () => {
    const server = await startHttpServer(() => {
      // Intentionally left without response to force timeout.
    });

    try {
      await expect(
        postDeliveryWebhook({
          webhookUrl: `${server.url}/deliver`,
          payload: { event: 'auth.two_factor_provisioning' },
          timeoutMs: 25
        })
      ).rejects.toThrow('Delivery webhook timed out');
    } finally {
      await server.close();
    }
  });

  it('rejects unsupported URL protocols before opening a socket', async () => {
    await expect(
      postDeliveryWebhook({
        webhookUrl: 'ftp://delivery.example.com/hooks',
        payload: { event: 'tenant.invitation' },
        timeoutMs: 500
      })
    ).rejects.toThrow('Unsupported delivery webhook protocol: ftp:');
  });
});
