import net from 'node:net';

import { MailpitEmailTransport } from '@/infrastructure/email/transports/mailpit-email.transport';

describe('MailpitEmailTransport', () => {
  it('sends a multipart email over SMTP', async () => {
    const receivedCommands: string[] = [];
    let receivedMessage = '';

    const server = net.createServer((socket) => {
      socket.setEncoding('utf8');
      socket.write('220 mailpit ready\r\n');

      let dataMode = false;
      let dataBuffer = '';

      socket.on('data', (chunk: string) => {
        if (dataMode) {
          dataBuffer += chunk;

          if (dataBuffer.includes('\r\n.\r\n')) {
            receivedMessage = dataBuffer.split('\r\n.\r\n')[0] ?? '';
            socket.write('250 message queued\r\n');
            dataMode = false;
            dataBuffer = '';
          }

          return;
        }

        const commands = chunk
          .split('\r\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        for (const command of commands) {
          receivedCommands.push(command);

          if (command.startsWith('EHLO')) {
            socket.write('250-mailpit greets you\r\n250 SIZE 10485760\r\n');
            continue;
          }

          if (command.startsWith('MAIL FROM') || command.startsWith('RCPT TO')) {
            socket.write('250 ok\r\n');
            continue;
          }

          if (command === 'DATA') {
            dataMode = true;
            socket.write('354 end with <CRLF>.<CRLF>\r\n');
            continue;
          }

          if (command === 'QUIT') {
            socket.write('221 goodbye\r\n');
            socket.end();
          }
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected TCP server address.');
    }

    const transport = new MailpitEmailTransport({
      host: '127.0.0.1',
      port: address.port,
      timeoutMs: 5000
    });

    const result = await transport.send({
      from: 'SaaS Core Engine <no-reply@example.com>',
      to: ['user@example.com'],
      subject: 'Verify your email',
      html: '<p>Verify</p>',
      text: 'Verify',
      idempotencyKey: 'delivery-1',
      metadata: {
        semantic: 'auth.email_verification',
        templateKey: 'verify-email',
        templateVersion: '1.0.0'
      }
    });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    expect(receivedCommands.some((command) => command.startsWith('MAIL FROM'))).toBe(true);
    expect(receivedCommands.some((command) => command.startsWith('RCPT TO'))).toBe(true);
    expect(receivedMessage).toContain('Subject: Verify your email');
    expect(receivedMessage).toContain('X-Template-Key: verify-email');
    expect(result).toEqual({
      provider: 'mailpit',
      messageId: null,
      acceptedRecipients: ['user@example.com']
    });
  });
});
