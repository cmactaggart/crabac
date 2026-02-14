import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { DEFAULT_MEMBER_PERMISSIONS, ALL_PERMISSIONS } from '@crabac/shared';
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
    .leftJoin('space_settings', 'spaces.id', 'space_settings.space_id')
    .where('space_members.user_id', userId)
    .select('spaces.*', 'space_settings.calendar_enabled', 'space_settings.is_public', 'space_settings.base_color', 'space_settings.accent_color', 'space_settings.text_color');

  return spaces.map(formatSpace);
}

export async function getSpace(spaceId: string) {
  const space = await db('spaces')
    .leftJoin('space_settings', 'spaces.id', 'space_settings.space_id')
    .where('spaces.id', spaceId)
    .select('spaces.*', 'space_settings.calendar_enabled', 'space_settings.is_public', 'space_settings.base_color', 'space_settings.accent_color', 'space_settings.text_color')
    .first();
  if (!space) throw new NotFoundError('Space');
  return formatSpace(space);
}

export async function getSpaceBySlug(slug: string) {
  const space = await db('spaces')
    .leftJoin('space_settings', 'spaces.id', 'space_settings.space_id')
    .where('spaces.slug', slug)
    .select('spaces.*', 'space_settings.calendar_enabled', 'space_settings.is_public', 'space_settings.base_color', 'space_settings.accent_color', 'space_settings.text_color')
    .first();
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
      'users.base_color',
      'users.accent_color',
      'users.status',
      'users.is_bot',
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

  const result: any[] = members.map((m: any) => ({
    spaceId: m.space_id,
    userId: m.user_id,
    nickname: m.nickname,
    joinedAt: m.joined_at,
    user: {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      baseColor: m.base_color || null,
      accentColor: m.accent_color || null,
      status: m.status,
      isBot: !!m.is_bot,
    },
    roles: rolesByUser.get(m.user_id) || [],
  }));

  // Fetch guests from Redis for public spaces
  try {
    const { redis } = await import('../../lib/redis.js');
    const guestIds = await redis.smembers(`space:${spaceId}:guests`);
    if (guestIds.length > 0) {
      const guests = await db('users')
        .whereIn('id', guestIds)
        .select('id', 'username', 'display_name', 'avatar_url', 'base_color', 'accent_color', 'status');
      for (const g of guests) {
        result.push({
          spaceId,
          userId: g.id,
          nickname: null,
          joinedAt: null,
          isGuest: true,
          user: {
            id: g.id,
            username: g.username,
            displayName: g.display_name,
            avatarUrl: g.avatar_url,
            baseColor: g.base_color || null,
            accentColor: g.accent_color || null,
            status: g.status,
          },
          roles: [],
        });
      }
    }
  } catch {
    // Redis may not be connected
  }

  return result;
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

/** Join a public space */
export async function joinPublicSpace(userId: string, spaceId: string) {
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', spaceId).first();
  if (!settings?.is_public) throw new ForbiddenError('This space is not public');

  if (settings.require_verified_email) {
    const user = await db('users').where('id', userId).select('email_verified').first();
    if (!user?.email_verified) {
      throw new ForbiddenError('Email verification required to join this space');
    }
  }

  const existing = await db('space_members').where({ space_id: spaceId, user_id: userId }).first();
  if (existing) throw new ConflictError('Already a member of this space');

  await db.transaction(async (trx) => {
    await trx('space_members').insert({ space_id: spaceId, user_id: userId });

    const defaultRole = await trx('roles')
      .where({ space_id: spaceId, is_default: true })
      .first();

    if (defaultRole) {
      await trx('member_roles').insert({
        space_id: spaceId,
        user_id: userId,
        role_id: defaultRole.id,
      });
    }
  });

  // Remove from guest set if present
  try {
    const { redis } = await import('../../lib/redis.js');
    await redis.srem(`space:${spaceId}:guests`, userId);
  } catch {
    // ignore
  }

  eventBus.emit('space.member_joined', { spaceId, userId });

  return getSpace(spaceId);
}

/** Get tags for a space */
export async function getSpaceTags(spaceId: string) {
  const tags = await db('space_tags').where('space_id', spaceId).select('tag', 'tag_slug');
  return tags.map((t: any) => ({ tag: t.tag, tagSlug: t.tag_slug }));
}

/** Update tags for a space (replace all) */
export async function updateSpaceTags(spaceId: string, tags: string[]) {
  await db('space_tags').where('space_id', spaceId).delete();

  if (tags.length > 0) {
    const rows = tags.map((tag) => ({
      space_id: spaceId,
      tag: tag.trim(),
      tag_slug: tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }));
    // Deduplicate by slug
    const unique = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      unique.set(row.tag_slug, row);
    }
    await db('space_tags').insert(Array.from(unique.values()));
  }

  return getSpaceTags(spaceId);
}

/** List public spaces for directory */
export async function listPublicSpaces(opts: { search?: string; tag?: string; limit: number; offset: number }) {
  let query = db('spaces')
    .join('space_settings', 'spaces.id', 'space_settings.space_id')
    .where('space_settings.is_public', true)
    .select(
      'spaces.id',
      'spaces.name',
      'spaces.slug',
      'spaces.description',
      'spaces.icon_url',
      'space_settings.is_featured',
      'space_settings.base_color',
      'space_settings.accent_color',
      'space_settings.text_color',
      db.raw('(SELECT COUNT(*) FROM space_members WHERE space_members.space_id = spaces.id) as member_count'),
    );

  if (opts.search) {
    query = query.where(function () {
      this.where('spaces.name', 'like', `%${opts.search}%`)
        .orWhere('spaces.description', 'like', `%${opts.search}%`);
    });
  }

  if (opts.tag) {
    query = query.whereExists(function () {
      this.select('*')
        .from('space_tags')
        .whereRaw('space_tags.space_id = spaces.id')
        .where('space_tags.tag_slug', opts.tag);
    });
  }

  const spaces = await query
    .orderBy('space_settings.is_featured', 'desc')
    .orderBy('member_count', 'desc')
    .limit(opts.limit)
    .offset(opts.offset);

  // Fetch tags for all returned spaces
  const spaceIds = spaces.map((s: any) => s.id);
  const tags = spaceIds.length > 0
    ? await db('space_tags').whereIn('space_id', spaceIds).select('space_id', 'tag')
    : [];

  const tagsBySpace = new Map<string, string[]>();
  for (const t of tags) {
    const list = tagsBySpace.get(t.space_id) || [];
    list.push(t.tag);
    tagsBySpace.set(t.space_id, list);
  }

  return spaces.map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    iconUrl: s.icon_url,
    memberCount: Number(s.member_count),
    tags: tagsBySpace.get(s.id) || [],
    isFeatured: !!s.is_featured,
    baseColor: s.base_color || null,
    accentColor: s.accent_color || null,
    textColor: s.text_color || null,
  }));
}

/** List featured public spaces */
export async function listFeaturedSpaces() {
  return listPublicSpaces({ limit: 10, offset: 0 });
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
    calendarEnabled: !!row.calendar_enabled,
    isPublic: !!row.is_public,
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    textColor: row.text_color || null,
  };
}
