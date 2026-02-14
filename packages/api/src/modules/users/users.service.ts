import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';
import { config } from '../../config.js';

export async function getUser(userId: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new NotFoundError('User');
  return formatUser(user);
}

export async function updateUser(userId: string, updates: { displayName?: string; avatarUrl?: string | null; baseColor?: string | null; accentColor?: string | null }) {
  const data: Record<string, any> = {};
  if (updates.displayName !== undefined) data.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) data.avatar_url = updates.avatarUrl;
  if (updates.baseColor !== undefined) data.base_color = updates.baseColor;
  if (updates.accentColor !== undefined) data.accent_color = updates.accentColor;

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
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    status: row.status,
    emailVerified: !!row.email_verified,
    totpEnabled: !!row.totp_enabled,
    isAdmin: config.adminEmails.includes(row.email),
    isBot: !!row.is_bot,
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
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    status: row.status,
    createdAt: row.created_at,
  };
}
