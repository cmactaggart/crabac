import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { sendMagicLinkEmail } from '../../lib/email.js';
import { BadRequestError } from '../../lib/errors.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function sendMagicLink(email: string) {
  const user = await db('users').where('email', email).first();
  // Always return success to prevent email enumeration
  if (!user) return;

  // Delete any existing magic links for this user
  await db('magic_link_tokens').where('user_id', user.id).delete();

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15min

  await db('magic_link_tokens').insert({
    id: snowflake.generate(),
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  await sendMagicLinkEmail(email, token);
}

export async function redeemMagicLink(token: string) {
  const tokenHash = hashToken(token);
  const record = await db('magic_link_tokens').where('token_hash', tokenHash).first();

  if (!record) throw new BadRequestError('Invalid or expired magic link');
  if (record.used) throw new BadRequestError('This link has already been used');
  if (new Date(record.expires_at) < new Date()) {
    await db('magic_link_tokens').where('id', record.id).delete();
    throw new BadRequestError('Magic link has expired. Please request a new one.');
  }

  // Mark as used
  await db('magic_link_tokens').where('id', record.id).update({ used: true });

  // Also verify email (proof of ownership)
  await db('users').where('id', record.user_id).update({ email_verified: true });

  const user = await db('users').where('id', record.user_id).first();
  return user;
}
