import { randomUUID } from 'node:crypto';
import net from 'node:net';
import os from 'node:os';

import { type TransactionalEmailPort } from '@/core/communications/email/ports/transactional-email.port';
import {
  type TransactionalEmailDeliveryResult,
  type TransactionalEmailMessage
} from '@/core/communications/email/types/email.types';

interface MailpitEmailTransportOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

interface SmtpResponse {
  code: number;
  lines: string[];
}

function extractEnvelopeAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function dotStuff(value: string): string {
  return value
    .replace(/\r?\n/g, '\r\n')
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function buildMimeMessage(message: TransactionalEmailMessage): string {
  const boundary = `boundary_${randomUUID()}`;
  const headers = [
    `From: ${message.from}`,
    `To: ${message.to.join(', ')}`,
    `Subject: ${message.subject}`,
    'MIME-Version: 1.0',
    `X-Template-Key: ${message.metadata.templateKey}`,
    `X-Template-Version: ${message.metadata.templateVersion}`,
    `X-Email-Semantic: ${message.metadata.semantic}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];

  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    `--${boundary}--`
  ].join('\r\n');
}

class SmtpClient {
  private readonly pendingResolvers: Array<(response: SmtpResponse) => void> = [];
  private readonly readyResponses: SmtpResponse[] = [];
  private readonly pendingRejectors = new Set<(error: Error) => void>();
  private responseBuffer = '';
  private responseLines: string[] = [];

  constructor(private readonly socket: net.Socket) {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.responseBuffer += chunk;
      this.flushResponses();
    });
    this.socket.on('error', (error) => {
      this.rejectPending(error);
    });
    this.socket.on('close', () => {
      this.rejectPending(new Error('SMTP connection closed before command completion.'));
    });
  }

  async readResponse(expectedCode: number): Promise<SmtpResponse> {
    const response = await new Promise<SmtpResponse>((resolve, reject) => {
      if (this.readyResponses.length > 0) {
        resolve(this.readyResponses.shift() as SmtpResponse);
        return;
      }

      this.pendingRejectors.add(reject);
      this.pendingResolvers.push((nextResponse) => {
        this.pendingRejectors.delete(reject);
        resolve(nextResponse);
      });
    });

    if (response.code !== expectedCode) {
      throw new Error(
        `Unexpected SMTP response ${response.code}. Expected ${expectedCode}. ${response.lines.join(' ')}`
      );
    }

    return response;
  }

  async command(command: string, expectedCode: number): Promise<SmtpResponse> {
    this.socket.write(`${command}\r\n`);
    return await this.readResponse(expectedCode);
  }

  async sendData(message: string): Promise<void> {
    await this.command('DATA', 354);
    this.socket.write(`${dotStuff(message)}\r\n.\r\n`);
    await this.readResponse(250);
  }

  close(): void {
    this.socket.end();
    this.pendingRejectors.clear();
  }

  private flushResponses(): void {
    while (this.responseBuffer.includes('\r\n')) {
      const separatorIndex = this.responseBuffer.indexOf('\r\n');
      const line = this.responseBuffer.slice(0, separatorIndex);

      this.responseBuffer = this.responseBuffer.slice(separatorIndex + 2);
      this.responseLines.push(line);

      if (/^\d{3} /.test(line)) {
        const response = {
          code: Number(line.slice(0, 3)),
          lines: [...this.responseLines]
        };

        this.responseLines = [];

        const resolver = this.pendingResolvers.shift();

        if (resolver) {
          resolver(response);
        } else {
          this.readyResponses.push(response);
        }
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const reject of this.pendingRejectors) {
      reject(error);
    }

    this.pendingRejectors.clear();
  }
}

export class MailpitEmailTransport implements TransactionalEmailPort {
  constructor(private readonly options: MailpitEmailTransportOptions) {}

  async send(message: TransactionalEmailMessage): Promise<TransactionalEmailDeliveryResult> {
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const client = net.createConnection({
        host: this.options.host,
        port: this.options.port
      });

      client.setTimeout(this.options.timeoutMs, () => {
        client.destroy(
          new Error(`Mailpit SMTP transport timed out after ${this.options.timeoutMs}ms`)
        );
      });
      client.once('connect', () => resolve(client));
      client.once('error', reject);
    });
    const client = new SmtpClient(socket);
    const envelopeFrom = extractEnvelopeAddress(message.from);
    const recipients = message.to.map(extractEnvelopeAddress);

    try {
      await client.readResponse(220);
      await client.command(`EHLO ${os.hostname() || 'localhost'}`, 250);
      await client.command(`MAIL FROM:<${envelopeFrom}>`, 250);

      for (const recipient of recipients) {
        await client.command(`RCPT TO:<${recipient}>`, 250);
      }

      await client.sendData(buildMimeMessage(message));
      await client.command('QUIT', 221);

      return {
        provider: 'mailpit',
        messageId: null,
        acceptedRecipients: recipients
      };
    } finally {
      client.close();
    }
  }
}
