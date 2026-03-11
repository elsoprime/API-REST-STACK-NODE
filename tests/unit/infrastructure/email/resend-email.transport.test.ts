import { ResendEmailTransport } from '@/infrastructure/email/transports/resend-email.transport';

describe('ResendEmailTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts transactional emails to the Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-1' }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const transport = new ResendEmailTransport({
      apiKey: 're_test_123',
      baseUrl: 'https://api.resend.com',
      timeoutMs: 5000
    });

    const result = await transport.send({
      from: 'SaaS Core Engine <no-reply@example.com>',
      to: ['user@example.com'],
      subject: 'Verify your email',
      html: '<p>html</p>',
      text: 'text',
      idempotencyKey: 'delivery-1',
      metadata: {
        semantic: 'auth.email_verification',
        templateKey: 'verify-email',
        templateVersion: '1.0.0'
      }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_123',
          'Idempotency-Key': 'delivery-1'
        })
      })
    );
    expect(result).toEqual({
      provider: 'resend',
      messageId: 'email-1',
      acceptedRecipients: ['user@example.com']
    });
  });

  it('throws a sanitized error when Resend returns a non-success status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'invalid' }), {
          status: 422,
          headers: {
            'content-type': 'application/json'
          }
        })
      )
    );

    const transport = new ResendEmailTransport({
      apiKey: 're_test_123',
      baseUrl: 'https://api.resend.com',
      timeoutMs: 5000
    });

    await expect(
      transport.send({
        from: 'SaaS Core Engine <no-reply@example.com>',
        to: ['user@example.com'],
        subject: 'Verify your email',
        html: '<p>html</p>',
        text: 'text',
        idempotencyKey: 'delivery-2',
        metadata: {
          semantic: 'auth.email_verification',
          templateKey: 'verify-email',
          templateVersion: '1.0.0'
        }
      })
    ).rejects.toThrow('Resend email delivery failed with status 422.');
  });
});
