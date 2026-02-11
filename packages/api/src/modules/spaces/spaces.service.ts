import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { DEFAULT_MEMBER_PERMISSIONS, ALL_PERMISSIONS } from '@gud/shared';
import { eventBus } from '../../lib/event-bus.js';

export async function createSpace(userId: string, data: { name: string; slug: string; description?: string }) {
  const existing = await db('spaces').where('slug', data.slug).first();
  if (existing) throw new ConflictError('Slug already taken');

  const spaceId = snowflake.generate();

  await db.transaction(async (trx) => {
    // Create space
    await trx('spaces').insert({
      id: spaceId,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      owner_id: userId,
    });

    // Add owner as member
    await trx('space_members').insert({
      space_id: spaceId,
      user_id: userId,
    });

    // Create system roles
    const ownerRoleId = snowflake.generate();
    const defaultRoleId = snowflake.generate();

    await trx('roles').insert([
      {
        id: ownerRoleId,
        space_id: spaceId,
        name: 'Owner',
        position: 2147483647, // MAX_INT
        permissions: ALL_PERMISSIONS.toString(),
        is_system: true,
        is_default: false,
      },
      {
        id: defaultRoleId,
        space_id: spaceId,
        name: 'Default',
        position: 0,
        permissions: DEFAULT_MEMBER_PERMISSIONS.toString(),
        is_system: true,
        is_default: true,
      },
    ]);

    // Assign owner role to creator
    await trx('member_roles').insert({
      space_id: spaceId,
      user_id: userId,
      role_id: ownerRoleId,
    });

    // Also assign default role
    await trx('member_roles').insert({
      space_id: spaceId,
      user_id: userId,
      role_id: defaultRoleId,
    });

    // Create #admin channel (visible only to those with VIEW_ADMIN_CHANNEL)
    await trx('channels').insert({
      id: snowflake.generate(),
      space_id: spaceId,
      name: 'admin',
      topic: 'Admin-only channel for system notifications',
      type: 'text',
      position: -1,
      is_admin: true,
    });

    // Create default #general channel
    await trx('channels').insert({
      id: snowflake.generate(),
      space_id: spaceId,
      name: 'general',
      topic: 'General discussion',
      type: 'text',
      position: 0,
    });
  });

  return getSpace(spaceId);
}

export async function listUserSpaces(userId: string) {
  const spaces = await db('spaces')
    .join('space_members', 'spaces.id', 'space_members.space_id')
    .where('space_members.user_id', userId)
    .select('spaces.*');

  return spaces.map(formatSpace);
}

export async function getSpace(spaceId: string) {
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');
  return formatSpace(space);
}

export async function updateSpace(spaceId: string, data: { name?: string; description?: string | null; iconUrl?: string | null }) {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.iconUrl !== undefined) updates.icon_url = data.iconUrl;

  if (Object.keys(updates).length > 0) {
    await db('spaces').where('id', spaceId).update(updates);
  }
  return getSpace(spaceId);
}

export async function deleteSpace(spaceId: string, userId: string) {
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');
  if (space.owner_id !== userId) throw new ForbiddenError('Only the space owner can delete the space');

  await db('spaces').where('id', spaceId).delete();
}

export async function getMembers(spaceId: string) {
  const members = await db('space_members')
    .join('users', 'space_members.user_id', 'users.id')
    .where('space_members.space_id', spaceId)
    .select(
      'space_members.space_id',
      'space_members.user_id',
      'space_members.nickname',
      'space_members.joined_at',
      'users.username',
      'users.display_name',
      'users.avatar_url',
      'users.status',
    );

  // Fetch roles for each member
  const userIds = members.map((m: any) => m.user_id);
  const memberRoles = await db('member_roles')
    .join('roles', 'member_roles.role_id', 'roles.id')
    .where('member_roles.space_id', spaceId)
    .whereIn('member_roles.user_id', userIds)
    .select('member_roles.user_id', 'roles.id', 'roles.name', 'roles.color', 'roles.position');

  const rolesByUser = new Map<string, any[]>();
  for (const mr of memberRoles) {
    const list = rolesByUser.get(mr.user_id) || [];
    list.push({ id: mr.id, name: mr.name, color: mr.color, position: mr.position });
    rolesByUser.set(mr.user_id, list);
  }

  return members.map((m: any) => ({
    spaceId: m.space_id,
    userId: m.user_id,
    nickname: m.nickname,
    joinedAt: m.joined_at,
    user: {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      status: m.status,
    },
    roles: rolesByUser.get(m.user_id) || [],
  }));
}

export async function kickMember(spaceId: string, targetUserId: string) {
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');
  if (targetUserId === space.owner_id) throw new ForbiddenError('Cannot kick the space owner');

  const deleted = await db('space_members')
    .where({ space_id: spaceId, user_id: targetUserId })
    .delete();

  if (!deleted) throw new NotFoundError('Member');

  eventBus.emit('space.member_left', { spaceId, userId: targetUserId });
}

export async function leaveSpace(spaceId: string, userId: string) {
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');
  if (userId === space.owner_id) throw new BadRequestError('Owner cannot leave the space. Transfer ownership first or delete the space.');

  await db('space_members').where({ space_id: spaceId, user_id: userId }).delete();
  eventBus.emit('space.member_left', { spaceId, userId });
}

export async function joinViaInvite(userId: string, code: string) {
  const invite = await db('invites').where('code', code).first();
  if (!invite) throw new NotFoundError('Invite');

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new BadRequestError('Invite has expired');
  }

  // Check max uses
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    throw new BadRequestError('Invite has reached maximum uses');
  }

  // Check if already a member
  const existingMember = await db('space_members')
    .where({ space_id: invite.space_id, user_id: userId })
    .first();
  if (existingMember) throw new ConflictError('Already a member of this space');

  await db.transaction(async (trx) => {
    // Add member
    await trx('space_members').insert({
      space_id: invite.space_id,
      user_id: userId,
    });

    // Assign default role
    const defaultRole = await trx('roles')
      .where({ space_id: invite.space_id, is_default: true })
      .first();

    if (defaultRole) {
      await trx('member_roles').insert({
        space_id: invite.space_id,
        user_id: userId,
        role_id: defaultRole.id,
      });
    }

    // Increment use count
    await trx('invites').where('id', invite.id).increment('use_count', 1);
  });

  eventBus.emit('space.member_joined', { spaceId: invite.space_id, userId });

  return getSpace(invite.space_id);
}

/** Check if a user is a member of a space */
export async function isMember(spaceId: string, userId: string): Promise<boolean> {
  const row = await db('space_members').where({ space_id: spaceId, user_id: userId }).first();
  return !!row;
}

function formatSpace(row: any) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    iconUrl: row.icon_url,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
