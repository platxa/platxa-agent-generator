/**
 * Crypto Utilities - AES-256-GCM encryption for sensitive tokens
 *
 * Uses a key derived from NEXTAUTH_SECRET for encrypting OAuth tokens
 * stored in the database.
 */

import crypto from 'crypto';
import { getAuthSecret } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'platxa-token-encryption-salt-v1';

/**
 * Derive encryption key from auth secret
 */
function deriveKey(): Buffer {
  const authSecret = getAuthSecret();
  if (!authSecret) {
    throw new Error('Auth secret is required for token encryption');
  }

  // Derive a 256-bit key using PBKDF2
  return crypto.pbkdf2Sync(authSecret, SALT, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext token
 * Returns format: iv:authTag:ciphertext (all base64)
 */
export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted token
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decryptToken(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivBase64, authTagBase64, ciphertext] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a string looks like an encrypted token
 */
export function isEncryptedToken(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3;
}
