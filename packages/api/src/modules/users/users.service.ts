import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';
import { config } from '../../config.js';

export async function getUser(userId: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new NotFoundError('User');
  return formatUser(user);
}

export async function updateUser(userId: string, updates: { displayName?: string; avatarUrl?: string | null }) {
  const data: Record<string, any> = {};
  if (updates.displayName !== undefined) data.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) data.avatar_url = updates.avatarUrl;

  if (Object.keys(data).length > 0) {
    await db('users').where('id', userId).update(data);
  }

  return getUser(userId);
}

export async function getPublicUser(userId: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new NotFoundError('User');
  return formatPublicUser(user);
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
    isAdmin: config.adminEmails.includes(row.email),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatPublicUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    createdAt: row.created_at,
  };
}
