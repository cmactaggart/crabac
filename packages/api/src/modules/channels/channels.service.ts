import bcrypt from 'bcrypt';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors.js';
import { Permissions, hasPermission, ALL_PERMISSIONS } from '@crabac/shared';
import { computePermissions, computeChannelPermissions } from '../rbac/rbac.service.js';

export async function createChannel(
  spaceId: string,
  data: {
    name: string; displayName?: string; topic?: string; type?: string; isPrivate?: boolean; isPublic?: boolean; categoryId?: string;
    publicVoiceAccess?: boolean; publicVoiceChat?: boolean; publicVoiceParticipation?: boolean; voicePassword?: string | null; voiceIdentityMode?: 'anonymous' | 'email_verify' | 'require_login';
  },
  userId?: string,
  memberIds?: string[],
  roleOverrides?: string[],
) {
  // Check for duplicate name
  const existing = await db('channels').where({ space_id: spaceId, name: data.name }).first();
  if (existing) throw new ConflictError('A channel with that name already exists');

  const id = snowflake.generate();
  // Get next position
  const last = await db('channels')
    .where('space_id', spaceId)
    .max('position as maxPos')
    .first();
  const position = (last?.maxPos ?? -1) + 1;

  const passwordHash = data.voicePassword ? await bcrypt.hash(data.voicePassword, 10) : null;

  await db('channels').insert({
    id,
    space_id: spaceId,
    name: data.name,
    display_name: data.displayName ?? null,
    topic: data.topic ?? null,
    type: data.type ?? 'text',
    is_public: data.isPublic ?? false,
    is_private: data.isPrivate ?? false,
    position,
    category_id: data.categoryId ?? null,
    public_voice_access: data.publicVoiceAccess ?? false,
    public_voice_chat: data.publicVoiceChat ?? false,
    public_voice_participation: data.publicVoiceParticipation ?? false,
    voice_password: passwordHash,
    voice_identity_mode: data.voiceIdentityMode ?? 'anonymous',
  });

  // If private, add creator + extra members to channel_members
  if (data.isPrivate && userId) {
    const allMembers = new Set([userId, ...(memberIds || [])]);
    await db('channel_members').insert(
      Array.from(allMembers).map((uid) => ({ channel_id: id, user_id: uid })),
    );
  }

  // Create role overrides for selected roles
  if (data.isPrivate && roleOverrides && roleOverrides.length > 0) {
    const defaultAllow = String(
      Permissions.VIEW_CHANNELS | Permissions.SEND_MESSAGES | Permissions.ATTACH_FILES | Permissions.ADD_REACTIONS
    );
    await db('channel_permission_overrides').insert(
      roleOverrides.map((roleId) => ({
        channel_id: id,
        role_id: roleId,
        allow: defaultAllow,
        deny: '0',
      })),
    );
  }

  return getChannel(id);
}

/**
 * List all channels (unfiltered). Used internally.
 */
export async function listChannels(spaceId: string) {
  const channels = await db('channels')
    .where('space_id', spaceId)
    .whereNot('name', 'like', 'event-room-%')
    .orderBy('position', 'asc');
  return channels.map(formatChannel);
}

/**
 * List channels visible to a specific user, respecting channel overrides and admin visibility.
 * Also includes portaled channels from other spaces.
 */
export async function listChannelsForUser(spaceId: string, userId: string, cache?: Map<string, string>) {
  const spacePerms = await computePermissions(spaceId, userId, cache);
  const isAdmin = hasPermission(spacePerms, Permissions.ADMINISTRATOR);
  const canViewAdmin = hasPermission(spacePerms, Permissions.VIEW_ADMIN_CHANNEL);

  const allChannels = await db('channels')
    .where('space_id', spaceId)
    .whereNot('name', 'like', 'event-room-%')
    .orderBy('position', 'asc');

  // Preload user's channel memberships to avoid N+1 queries
  const memberSet = new Set(
    (await db('channel_members').where('user_id', userId).select('channel_id'))
      .map((m: any) => String(m.channel_id))
  );

  const visible: any[] = [];

  for (const ch of allChannels) {
    // Admin channels require VIEW_ADMIN_CHANNEL
    if (ch.is_admin && !canViewAdmin && !isAdmin) continue;

    // Admins see everything
    if (isAdmin) {
      visible.push(formatChannel(ch));
      continue;
    }

    // Check channel-level VIEW_CHANNELS permission
    const chanPerms = await computeChannelPermissions(spaceId, ch.id, userId, cache, memberSet);
    if (hasPermission(chanPerms, Permissions.VIEW_CHANNELS)) {
      visible.push(formatChannel(ch));
    }
  }

  // Mark channels that have been portaled out to other spaces
  const outboundPortals = await db('portals')
    .where('source_space_id', spaceId)
    .select('channel_id');
  const portalSourceIds = new Set(outboundPortals.map((p: any) => String(p.channel_id)));
  for (const ch of visible) {
    if (portalSourceIds.has(String(ch.id))) {
      ch.isPortalSource = true;
    }
  }

  // Also include portaled channels from other spaces
  const portals = await db('portals')
    .where('target_space_id', spaceId)
    .join('channels', 'portals.channel_id', 'channels.id')
    .select('channels.*', 'portals.id as portal_id', 'portals.source_space_id');

  for (const p of portals) {
    visible.push({
      ...formatChannel(p),
      categoryId: null, // source space categories don't apply in target space
      isPortal: true,
      portalId: String(p.portal_id),
      sourceSpaceId: String(p.source_space_id),
    });
  }

  return visible;
}

/**
 * Return the set of channel IDs a user is allowed to view in a space.
 * Used by search to filter results to only permitted channels.
 */
export async function getVisibleChannelIds(spaceId: string, userId: string): Promise<Set<string>> {
  const spacePerms = await computePermissions(spaceId, userId);
  const isAdmin = hasPermission(spacePerms, Permissions.ADMINISTRATOR);
  const canViewAdmin = hasPermission(spacePerms, Permissions.VIEW_ADMIN_CHANNEL);

  const allChannels = await db('channels')
    .where('space_id', spaceId)
    .select('id', 'is_admin');

  const memberSet = new Set(
    (await db('channel_members').where('user_id', userId).select('channel_id'))
      .map((m: any) => String(m.channel_id))
  );

  const ids = new Set<string>();

  for (const ch of allChannels) {
    if (ch.is_admin && !canViewAdmin && !isAdmin) continue;

    if (isAdmin) {
      ids.add(String(ch.id));
      continue;
    }

    const chanPerms = await computeChannelPermissions(spaceId, ch.id, userId, undefined, memberSet);
    if (hasPermission(chanPerms, Permissions.VIEW_CHANNELS)) {
      ids.add(String(ch.id));
    }
  }

  return ids;
}

export async function getChannel(channelId: string) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  return formatChannel(channel);
}

export async function updateChannel(
  spaceId: string,
  channelId: string,
  data: {
    name?: string; displayName?: string | null; topic?: string | null; type?: string; isPublic?: boolean; isPrivate?: boolean; position?: number;
    publicVoiceAccess?: boolean; publicVoiceChat?: boolean; publicVoiceParticipation?: boolean; voicePassword?: string | null; voiceIdentityMode?: 'anonymous' | 'email_verify' | 'require_login';
  },
) {
  const channel = await db('channels').where({ id: channelId, space_id: spaceId }).first();
  if (!channel) throw new NotFoundError('Channel');

  // Prevent renaming admin channels
  if (channel.is_admin && data.name !== undefined) {
    throw new ForbiddenError('Cannot rename the admin channel');
  }

  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.displayName !== undefined) updates.display_name = data.displayName;
  if (data.topic !== undefined) updates.topic = data.topic;
  if (data.type !== undefined) updates.type = data.type;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;
  if (data.isPrivate !== undefined) updates.is_private = data.isPrivate;
  if (data.position !== undefined) updates.position = data.position;
  if (data.publicVoiceAccess !== undefined) updates.public_voice_access = data.publicVoiceAccess;
  if (data.publicVoiceChat !== undefined) updates.public_voice_chat = data.publicVoiceChat;
  if (data.publicVoiceParticipation !== undefined) updates.public_voice_participation = data.publicVoiceParticipation;
  if (data.voiceIdentityMode !== undefined) updates.voice_identity_mode = data.voiceIdentityMode;
  if (data.voicePassword !== undefined) {
    updates.voice_password = data.voicePassword ? await bcrypt.hash(data.voicePassword, 10) : null;
  }

  if (Object.keys(updates).length > 0) {
    await db('channels').where({ id: channelId, space_id: spaceId }).update(updates);
  }

  return getChannel(channelId);
}

export async function deleteChannel(spaceId: string, channelId: string) {
  const channel = await db('channels').where({ id: channelId, space_id: spaceId }).first();
  if (!channel) throw new NotFoundError('Channel');

  // Prevent deleting admin channels
  if (channel.is_admin) {
    throw new ForbiddenError('Cannot delete the admin channel');
  }

  await db('channels').where({ id: channelId, space_id: spaceId }).delete();
}

/** Get the space_id for a channel (used by messages routes) */
export async function getChannelSpaceId(channelId: string): Promise<string> {
  const channel = await db('channels').where('id', channelId).select('space_id').first();
  if (!channel) throw new NotFoundError('Channel');
  return channel.space_id;
}

/** Get the raw channel row (used internally) */
export async function getChannelRaw(channelId: string) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  return channel;
}

// ─── Channel Permission Overrides ───

export async function getChannelOverrides(channelId: string) {
  const overrides = await db('channel_permission_overrides')
    .where('channel_id', channelId)
    .select('*');
  return overrides.map((o: any) => ({
    channelId: String(o.channel_id),
    roleId: String(o.role_id),
    allow: String(o.allow),
    deny: String(o.deny),
  }));
}

export async function setChannelOverride(channelId: string, roleId: string, allow: string, deny: string) {
  await db('channel_permission_overrides')
    .insert({ channel_id: channelId, role_id: roleId, allow, deny })
    .onConflict(['channel_id', 'role_id'])
    .merge({ allow, deny });

  return getChannelOverrides(channelId);
}

export async function deleteChannelOverride(channelId: string, roleId: string) {
  const deleted = await db('channel_permission_overrides')
    .where({ channel_id: channelId, role_id: roleId })
    .delete();
  if (!deleted) throw new NotFoundError('Override');
}

// ─── Channel Members (Private Channels) ───

export async function addChannelMember(channelId: string, userId: string) {
  await db('channel_members')
    .insert({ channel_id: channelId, user_id: userId })
    .onConflict(['channel_id', 'user_id'])
    .ignore();
}

export async function removeChannelMember(channelId: string, userId: string) {
  await db('channel_members')
    .where({ channel_id: channelId, user_id: userId })
    .delete();
}

export async function getChannelMembers(channelId: string) {
  const members = await db('channel_members')
    .join('users', 'channel_members.user_id', 'users.id')
    .where('channel_members.channel_id', channelId)
    .select('users.id', 'users.username', 'users.display_name', 'users.avatar_url');
  return members.map((m: any) => ({
    id: String(m.id),
    username: m.username,
    displayName: m.display_name,
    avatarUrl: m.avatar_url,
  }));
}

export async function setChannelMembers(channelId: string, userIds: string[]) {
  await db.transaction(async (trx) => {
    await trx('channel_members').where('channel_id', channelId).delete();
    if (userIds.length > 0) {
      await trx('channel_members').insert(
        userIds.map((userId) => ({ channel_id: channelId, user_id: userId })),
      );
    }
  });
}

// ─── Channel Mutes ───

export async function muteChannel(channelId: string, userId: string) {
  await db('channel_mutes')
    .insert({ channel_id: channelId, user_id: userId })
    .onConflict(['channel_id', 'user_id'])
    .ignore();
}

export async function unmuteChannel(channelId: string, userId: string) {
  await db('channel_mutes')
    .where({ channel_id: channelId, user_id: userId })
    .delete();
}

export async function getMutedChannels(spaceId: string, userId: string) {
  const muted = await db('channel_mutes')
    .join('channels', 'channel_mutes.channel_id', 'channels.id')
    .where({ 'channels.space_id': spaceId, 'channel_mutes.user_id': userId })
    .select('channel_mutes.channel_id');
  return muted.map((m: any) => String(m.channel_id));
}

// ─── Bulk Reorder ───

export async function reorderChannels(
  spaceId: string,
  items: { channelId: string; position: number; categoryId?: string | null }[],
) {
  await db.transaction(async (trx) => {
    for (const item of items) {
      const updates: Record<string, any> = { position: item.position };
      if (item.categoryId !== undefined) {
        updates.category_id = item.categoryId;
      }
      await trx('channels')
        .where({ id: item.channelId, space_id: spaceId })
        .update(updates);
    }
  });
  return listChannels(spaceId);
}

function formatChannel(row: any) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    displayName: row.display_name || null,
    topic: row.topic,
    type: row.type,
    isPublic: row.is_public ?? false,
    isPrivate: row.is_private,
    isAdmin: row.is_admin ?? false,
    position: row.position,
    categoryId: row.category_id,
    publicVoiceAccess: !!row.public_voice_access,
    publicVoiceChat: !!row.public_voice_chat,
    publicVoiceParticipation: !!row.public_voice_participation,
    voiceIdentityMode: row.voice_identity_mode || 'anonymous',
    voiceHasPassword: !!row.voice_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
