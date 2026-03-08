import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes
} from 'node:crypto';

import { env } from '@/config/env';
import { AUTH_SECURITY_POLICY } from '@/constants/security';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function deriveEncryptionKey(): Buffer {
  return createHash('sha256')
    .update(`${env.JWT_SECRET}:${env.COOKIE_SECRET}:${env.CSRF_SECRET}`)
    .digest();
}

function toBase32(buffer: Buffer): string {
  let bits = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let encoded = '';

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    encoded += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return encoded;
}

function fromBase32(value: string): Buffer {
  const normalized = value.replace(/=+$/u, '').toUpperCase();
  let bits = '';

  for (const character of normalized) {
    const alphabetIndex = BASE32_ALPHABET.indexOf(character);

    if (alphabetIndex === -1) {
      throw new Error('Invalid base32 secret');
    }

    bits += alphabetIndex.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function normalizeVerificationCode(code: string): string {
  return code.replace(/\s+/gu, '');
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/-/gu, '').trim().toUpperCase();
}

function leftPadCode(value: number): string {
  return value.toString().padStart(AUTH_SECURITY_POLICY.TOTP_DIGITS, '0');
}

export class TwoFactorService {
  generateSecret(): string {
    return toBase32(randomBytes(20));
  }

  buildOtpAuthUrl(email: string, secret: string): string {
    const issuer = encodeURIComponent(env.APP_NAME);
    const label = encodeURIComponent(`${env.APP_NAME}:${email}`);

    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=${AUTH_SECURITY_POLICY.TOTP_DIGITS}&period=${AUTH_SECURITY_POLICY.TOTP_PERIOD_SECONDS}`;
  }

  encryptSecret(secret: string): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(), initializationVector);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${initializationVector.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decryptSecret(payload: string): string {
    const [ivSegment, authTagSegment, encryptedSegment] = payload.split('.');

    if (!ivSegment || !authTagSegment || !encryptedSegment) {
      throw new Error('Invalid encrypted secret payload');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveEncryptionKey(),
      Buffer.from(ivSegment, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(authTagSegment, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedSegment, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }

  generateCode(secret: string, timestamp = Date.now()): string {
    const counter = Math.floor(timestamp / 1000 / AUTH_SECURITY_POLICY.TOTP_PERIOD_SECONDS);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
    counterBuffer.writeUInt32BE(counter % 2 ** 32, 4);

    const hmac = createHmac('sha1', fromBase32(secret)).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binaryCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return leftPadCode(binaryCode % 10 ** AUTH_SECURITY_POLICY.TOTP_DIGITS);
  }

  verifyCode(secret: string, code: string, timestamp = Date.now()): boolean {
    const normalizedCode = normalizeVerificationCode(code);

    for (
      let offset = -AUTH_SECURITY_POLICY.TOTP_ALLOWED_WINDOW_STEPS;
      offset <= AUTH_SECURITY_POLICY.TOTP_ALLOWED_WINDOW_STEPS;
      offset += 1
    ) {
      const candidateTimestamp =
        timestamp + offset * AUTH_SECURITY_POLICY.TOTP_PERIOD_SECONDS * 1_000;

      if (this.generateCode(secret, candidateTimestamp) === normalizedCode) {
        return true;
      }
    }

    return false;
  }

  generateRecoveryCodes(): string[] {
    return Array.from({ length: AUTH_SECURITY_POLICY.RECOVERY_CODES_COUNT }, () => {
      const value = randomBytes(5).toString('hex').toUpperCase();
      return `${value.slice(0, 5)}-${value.slice(5, 10)}`;
    });
  }

  hashRecoveryCode(code: string): string {
    return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
  }

  verifyRecoveryCode(code: string, codeHashes: readonly string[]): boolean {
    const hashedCode = this.hashRecoveryCode(code);
    return codeHashes.includes(hashedCode);
  }
}

export const twoFactorService = new TwoFactorService();
