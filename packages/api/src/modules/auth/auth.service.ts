import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { config } from '../../config.js';
import { snowflake } from '../_shared.js';
import { ConflictError, UnauthorizedError, BadRequestError } from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';
import { createAndSendVerification } from './verification.service.js';
import { redeemMagicLink } from './magic-link.service.js';
import { verifyTOTP, verifyBackupCode } from './mfa.service.js';
import type { JwtPayload } from './auth.middleware.js';

const SALT_ROUNDS = 12;

export async function register(email: string, username: string, displayName: string, password: string) {
  const existing = await db('users')
    .where('email', email)
    .orWhere('username', username)
    .first();

  if (existing) {
    if (existing.email === email) throw new ConflictError('Email already registered');
    throw new ConflictError('Username already taken');
  }

  const id = snowflake.generate();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await db('users').insert({
    id,
    email,
    username,
    display_name: displayName,
    password_hash: passwordHash,
  });

  const user = await db('users').where('id', id).first();

  // Send verification email
  await createAndSendVerification(String(user.id), email, username);

  const tokens = await generateTokens(user);

  return {
    user: formatUser(user),
    ...tokens,
  };
}

export async function login(login: string, password: string) {
  const isEmail = login.includes('@');
  const user = isEmail
    ? await db('users').where('email', login).first()
    : await db('users').where('username', login).first();
  if (!user) throw new UnauthorizedError('Invalid email/username or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid email/username or password');

  if (!user.email_verified) {
    throw new UnauthorizedError('Email not verified. Check your inbox.');
  }

  // If MFA enabled, return challenge instead of tokens
  if (user.totp_enabled) {
    return createMfaChallenge(user.id);
  }

  const tokens = await generateTokens(user);
  return {
    user: formatUser(user),
    ...tokens,
  };
}

export async function loginWithMagicLink(token: string) {
  const user = await redeemMagicLink(token);

  // If MFA enabled, return challenge
  if (user.totp_enabled) {
    return createMfaChallenge(user.id);
  }

  const tokens = await generateTokens(user);
  return {
    user: formatUser(user),
    ...tokens,
  };
}

export async function loginWithMFA(mfaToken: string, code: string) {
  const tokenHash = crypto.createHash('sha256').update(mfaToken).digest('hex');
  const userId = await redis.get(`mfa:${tokenHash}`);

  if (!userId) throw new UnauthorizedError('MFA session expired. Please log in again.');

  // Delete key (single-use)
  await redis.del(`mfa:${tokenHash}`);

  // Try TOTP first, then backup code
  const totpValid = await verifyTOTP(userId, code);
  if (!totpValid) {
    const backupValid = await verifyBackupCode(userId, code);
    if (!backupValid) throw new UnauthorizedError('Invalid MFA code');
  }

  const user = await db('users').where('id', userId).first();
  if (!user) throw new UnauthorizedError('User not found');

  const tokens = await generateTokens(user);
  return {
    user: formatUser(user),
    ...tokens,
  };
}

async function createMfaChallenge(userId: string | bigint) {
  const mfaToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(mfaToken).digest('hex');
  await redis.set(`mfa:${tokenHash}`, String(userId), 'EX', 300); // 5min TTL
  return { mfaRequired: true as const, mfaToken };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const stored = await db('refresh_tokens').where('token_hash', tokenHash).first();

  if (!stored) throw new UnauthorizedError('Invalid refresh token');

  if (new Date(stored.expires_at) < new Date()) {
    await db('refresh_tokens').where('id', stored.id).delete();
    throw new UnauthorizedError('Refresh token expired');
  }

  // Revoke old token (single-use rotation)
  await db('refresh_tokens').where('id', stored.id).delete();

  const user = await db('users').where('id', stored.user_id).first();
  if (!user) throw new UnauthorizedError('User not found');

  const tokens = await generateTokens(user);
  return tokens;
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await db('refresh_tokens').where('token_hash', tokenHash).delete();
}

async function generateTokens(user: any) {
  const payload: JwtPayload = { userId: user.id, email: user.email };
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: snowflake.generate(),
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function formatUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    emailVerified: !!row.email_verified,
    totpEnabled: !!row.totp_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
