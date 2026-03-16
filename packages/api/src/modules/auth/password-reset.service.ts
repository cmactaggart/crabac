import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { sendPasswordResetEmail } from '../../lib/email.js';
import { BadRequestError } from '../../lib/errors.js';

const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordReset(email: string) {
  const user = await db('users').where('email', email).first();
  // Always return silently to prevent email enumeration
  if (!user) return;

  // Delete any existing reset tokens for this user
  await db('password_reset_tokens').where('user_id', user.id).delete();

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db('password_reset_tokens').insert({
    id: snowflake.generate(),
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  await sendPasswordResetEmail(email, token);
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const record = await db('password_reset_tokens').where('token_hash', tokenHash).first();

  if (!record) throw new BadRequestError('Invalid or expired reset link');
  if (record.used) throw new BadRequestError('This reset link has already been used');
  if (new Date(record.expires_at) < new Date()) {
    await db('password_reset_tokens').where('id', record.id).delete();
    throw new BadRequestError('Reset link has expired. Please request a new one.');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Update password and mark token as used
  await db('users').where('id', record.user_id).update({ password_hash: passwordHash });
  await db('password_reset_tokens').where('user_id', record.user_id).delete();

  // Invalidate all refresh tokens (force re-login on all devices)
  await db('refresh_tokens').where('user_id', record.user_id).delete();
}
