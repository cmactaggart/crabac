import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { Permissions, hasPermission, ALL_PERMISSIONS } from '@crabac/shared';
import { computePermissions, computeChannelPermissions } from '../rbac/rbac.service.js';

export async function createChannel(
  spaceId: string,
  data: { name: string; topic?: string; type?: string; isPrivate?: boolean; isPublic?: boolean; categoryId?: string },
) {
  const id = snowflake.generate();
  // Get next position
  const last = await db('channels')
    .where('space_id', spaceId)
    .max('position as maxPos')
    .first();
  const position = (last?.maxPos ?? -1) + 1;

  await db('channels').insert({
    id,
    space_id: spaceId,
    name: data.name,
    topic: data.topic ?? null,
    type: data.type ?? 'text',
    is_public: data.isPublic ?? false,
    is_private: data.isPrivate ?? false,
    position,
    category_id: data.categoryId ?? null,
  });

  return getChannel(id);
}

/**
 * List all channels (unfiltered). Used internally.
 */
export async function listChannels(spaceId: string) {
  const channels = await db('channels')
    .where('space_id', spaceId)
    .orderBy('position', 'asc');
  return channels.map(formatChannel);
}

/**
 * List channels visible to a specific user, respecting channel overrides and admin visibility.
 * Also includes portaled channels from other spaces.
 */
export async function listChannelsForUser(spaceId: string, userId: string) {
  const spacePerms = await computePermissions(spaceId, userId);
  const isAdmin = hasPermission(spacePerms, Permissions.ADMINISTRATOR);
  const canViewAdmin = hasPermission(spacePerms, Permissions.VIEW_ADMIN_CHANNEL);

  const allChannels = await db('channels')
    .where('space_id', spaceId)
    .orderBy('position', 'asc');

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
    const chanPerms = await computeChannelPermissions(spaceId, ch.id, userId);
    if (hasPermission(chanPerms, Permissions.VIEW_CHANNELS)) {
      visible.push(formatChannel(ch));
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
      isPortal: true,
      portalId: String(p.portal_id),
      sourceSpaceId: String(p.source_space_id),
    });
  }

  return visible;
}

export async function getChannel(channelId: string) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  return formatChannel(channel);
}

export async function updateChannel(
  spaceId: string,
  channelId: string,
  data: { name?: string; topic?: string | null; type?: string; isPublic?: boolean; position?: number },
) {
  const channel = await db('channels').where({ id: channelId, space_id: spaceId }).first();
  if (!channel) throw new NotFoundError('Channel');

  // Prevent renaming admin channels
  if (channel.is_admin && data.name !== undefined) {
    throw new ForbiddenError('Cannot rename the admin channel');
  }

  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.topic !== undefined) updates.topic = data.topic;
  if (data.type !== undefined) updates.type = data.type;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;
  if (data.position !== undefined) updates.position = data.position;

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
    topic: row.topic,
    type: row.type,
    isPublic: row.is_public ?? false,
    isPrivate: row.is_private,
    isAdmin: row.is_admin ?? false,
    position: row.position,
    categoryId: row.category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
