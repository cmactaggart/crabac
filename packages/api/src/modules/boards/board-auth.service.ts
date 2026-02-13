import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { config } from '../../config.js';
import { snowflake } from '../_shared.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../../lib/errors.js';
import { createAndSendVerification } from '../auth/verification.service.js';
import type { JwtPayload } from '../auth/auth.middleware.js';

const SALT_ROUNDS = 12;

export async function registerBoardUser(data: {
  spaceSlug: string;
  email: string;
  username: string;
  displayName: string;
  password: string;
}) {
  // Verify space exists and has public boards enabled
  const space = await db('spaces').where('slug', data.spaceSlug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_boards) throw new NotFoundError('Space');

  // Check for existing user
  const existing = await db('users')
    .where('email', data.email)
    .orWhere('username', data.username)
    .first();

  if (existing) {
    if (existing.email === data.email) throw new ConflictError('Email already registered');
    throw new ConflictError('Username already taken');
  }

  const userId = snowflake.generate();
  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  await db.transaction(async (trx) => {
    await trx('users').insert({
      id: userId,
      email: data.email,
      username: data.username,
      display_name: data.displayName,
      password_hash: passwordHash,
      account_type: 'board',
    });

    await trx('board_registrations').insert({
      user_id: userId,
      space_id: space.id,
    });
  });

  // Send verification email
  await createAndSendVerification(userId, data.email, data.username);

  const user = await db('users').where('id', userId).first();
  const tokens = await generateTokens(user);

  return {
    user: formatBoardUser(user),
    ...tokens,
  };
}

export async function loginBoardUser(login: string, password: string) {
  const isEmail = login.includes('@');
  const user = isEmail
    ? await db('users').where('email', login).first()
    : await db('users').where('username', login).first();

  if (!user) throw new UnauthorizedError('Invalid email/username or password');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid email/username or password');

  const tokens = await generateTokens(user);
  return {
    user: formatBoardUser(user),
    ...tokens,
  };
}

async function generateTokens(user: any) {
  const payload: JwtPayload = { userId: user.id, email: user.email };
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });

  const rawRefreshToken = crypto.randomBytes(48).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + config.refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

  await db('refresh_tokens').insert({
    id: snowflake.generate(),
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

function formatBoardUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    emailVerified: !!row.email_verified,
    totpEnabled: false,
    accountType: row.account_type || 'board',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
