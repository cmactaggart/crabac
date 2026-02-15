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

const COLOR_PALETTE = [
  { base: '#667eea', accent: '#764ba2' },
  { base: '#f093fb', accent: '#f5576c' },
  { base: '#4facfe', accent: '#00f2fe' },
  { base: '#43e97b', accent: '#38f9d7' },
  { base: '#fa709a', accent: '#fee140' },
  { base: '#a18cd1', accent: '#fbc2eb' },
  { base: '#fccb90', accent: '#d57eeb' },
  { base: '#e0c3fc', accent: '#8ec5fc' },
  { base: '#f5576c', accent: '#ff9a76' },
  { base: '#6991c7', accent: '#a3bded' },
  { base: '#13547a', accent: '#80d0c7' },
  { base: '#ff0844', accent: '#ffb199' },
  { base: '#c471f5', accent: '#fa71cd' },
  { base: '#48c6ef', accent: '#6f86d6' },
  { base: '#a1c4fd', accent: '#c2e9fb' },
  { base: '#d4fc79', accent: '#96e6a1' },
  { base: '#84fab0', accent: '#8fd3f4' },
  { base: '#f6d365', accent: '#fda085' },
  { base: '#ffecd2', accent: '#fcb69f' },
  { base: '#a6c0fe', accent: '#f68084' },
];

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
  const colorCombo = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];

  await db('users').insert({
    id,
    email,
    username,
    display_name: displayName,
    password_hash: passwordHash,
    base_color: colorCombo.base,
    accent_color: colorCombo.accent,
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

  const user = await db('users').where('id', stored.user_id).first();
  if (!user) throw new UnauthorizedError('User not found');

  // Issue a new access token but keep the same refresh token
  const payload: JwtPayload = { userId: user.id, email: user.email };
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  return { accessToken, refreshToken };
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
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    status: row.status,
    emailVerified: !!row.email_verified,
    totpEnabled: !!row.totp_enabled,
    accountType: row.account_type || 'full',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
