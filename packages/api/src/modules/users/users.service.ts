import bcrypt from 'bcrypt';
import { db } from '../../database/connection.js';
import { NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { config } from '../../config.js';
import { Permissions } from '@crabac/shared';

export async function getUser(userId: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new NotFoundError('User');
  return formatUser(user);
}

export async function updateUser(userId: string, updates: { displayName?: string; avatarUrl?: string | null; bio?: string | null; baseColor?: string | null; accentColor?: string | null }) {
  const data: Record<string, any> = {};
  if (updates.displayName !== undefined) data.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) data.avatar_url = updates.avatarUrl;
  if (updates.bio !== undefined) data.bio = updates.bio;
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

export async function getUserByUsername(username: string) {
  const user = await db('users').where('username', username).first();
  if (!user) return null;
  return formatPublicUser(user);
}

function formatUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || null,
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

export async function deleteAccount(userId: string, password: string) {
  const user = await db('users').where('id', userId).first();
  if (!user) throw new NotFoundError('User');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid password');

  // Transfer or delete owned spaces
  const ownedSpaces = await db('spaces').where('owner_id', userId).select('id');
  for (const space of ownedSpaces) {
    // Find another admin member to transfer ownership
    const candidates = await db('space_members')
      .join('member_roles', 'space_members.id', 'member_roles.space_member_id')
      .join('roles', 'member_roles.role_id', 'roles.id')
      .where('space_members.space_id', space.id)
      .whereNot('space_members.user_id', userId)
      .select('space_members.user_id', 'roles.permissions');
    const admin = candidates.find((c: any) => {
      const perms = BigInt(c.permissions);
      return (perms & Permissions.ADMINISTRATOR) !== 0n;
    });

    if (admin) {
      await db('spaces').where('id', space.id).update({ owner_id: admin.user_id });
    } else {
      await db('spaces').where('id', space.id).del();
    }
  }

  await db('users').where('id', userId).del();
}

export async function searchUsers(query: string, currentUserId: string) {
  const rows = await db('users')
    .where(function () {
      this.where('username', 'like', `%${query}%`)
        .orWhere('display_name', 'like', `%${query}%`);
    })
    .whereNot('id', currentUserId)
    .limit(20)
    .select('id', 'username', 'display_name', 'avatar_url');
  return rows.map((r: any) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }));
}

function formatPublicUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio || null,
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    status: row.status,
    createdAt: row.created_at,
  };
}
