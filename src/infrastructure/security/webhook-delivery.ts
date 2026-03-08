import http from 'node:http';
import https from 'node:https';

interface PostDeliveryWebhookInput {
  readonly webhookUrl: string;
  readonly payload: unknown;
  readonly timeoutMs: number;
  readonly bearerToken?: string;
}

export async function postDeliveryWebhook(input: PostDeliveryWebhookInput): Promise<void> {
  const target = new URL(input.webhookUrl);

  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new Error(
      `Unsupported delivery webhook protocol: ${target.protocol}. Only http and https are supported.`
    );
  }

  const transport = target.protocol === 'https:' ? https : http;
  const serializedPayload = JSON.stringify(input.payload);

  await new Promise<void>((resolve, reject) => {
    const request = transport.request(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port.length > 0 ? Number(target.port) : undefined,
        path: `${target.pathname}${target.search}`,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(serializedPayload).toString(),
          ...(input.bearerToken ? { authorization: `Bearer ${input.bearerToken}` } : {})
        },
        timeout: input.timeoutMs
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer | string) => {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        response.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode ?? 500;

          if (statusCode >= 200 && statusCode < 300) {
            resolve();
            return;
          }

          reject(
            new Error(
              `Delivery webhook failed with status ${statusCode}: ${responseBody.slice(0, 256)}`
            )
          );
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Delivery webhook timed out after ${input.timeoutMs}ms`));
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.write(serializedPayload);
    request.end();
  });
}
