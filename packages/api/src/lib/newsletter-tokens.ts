import crypto from 'crypto';
import { config } from '../config.js';

const HMAC_KEY = config.jwt.secret;

/**
 * Generate a random token for unsubscribe / tracking.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a verification token for storage.
 */
export function hashToken(token: string): string {
  return crypto.createHmac('sha256', HMAC_KEY).update(token).digest('hex');
}
