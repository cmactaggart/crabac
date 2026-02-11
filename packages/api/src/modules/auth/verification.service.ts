import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { sendVerificationEmail } from '../../lib/email.js';
import { BadRequestError } from '../../lib/errors.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createAndSendVerification(userId: string, email: string, username: string) {
  // Delete any existing tokens for this user
  await db('email_verification_tokens').where('user_id', userId).delete();

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db('email_verification_tokens').insert({
    id: snowflake.generate(),
    user_id: userId,
    token_hash: tokenHash,
    email,
    expires_at: expiresAt,
  });

  await sendVerificationEmail(email, username, token);
}

export async function verifyEmail(token: string) {
  const tokenHash = hashToken(token);
  const record = await db('email_verification_tokens').where('token_hash', tokenHash).first();

  if (!record) throw new BadRequestError('Invalid or expired verification link');
  if (new Date(record.expires_at) < new Date()) {
    await db('email_verification_tokens').where('id', record.id).delete();
    throw new BadRequestError('Verification link has expired. Please request a new one.');
  }

  await db('users').where('id', record.user_id).update({ email_verified: true });
  await db('email_verification_tokens').where('user_id', record.user_id).delete();

  return { userId: record.user_id };
}

export async function resendVerification(userId: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new BadRequestError('User not found');
  if (user.email_verified) throw new BadRequestError('Email already verified');

  await createAndSendVerification(userId, user.email, user.username);
}
