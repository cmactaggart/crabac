import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../../lib/errors.js';
import { Permissions, hasPermission } from '@crabac/shared';
import { computePermissions } from '../rbac/rbac.service.js';
import * as spacesService from '../spaces/spaces.service.js';
import * as messagesService from '../messages/messages.service.js';

/**
 * Create a portal directly (requires CREATE_PORTAL in target space).
 */
export async function createPortal(
  channelId: string,
  sourceSpaceId: string,
  targetSpaceId: string,
  userId: string,
) {
  if (sourceSpaceId === targetSpaceId) {
    throw new BadRequestError('Cannot create a portal to the same space');
  }

  // Verify channel belongs to source space
  const channel = await db('channels').where({ id: channelId, space_id: sourceSpaceId }).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.is_admin) throw new ForbiddenError('Cannot portal admin channels');

  // Verify user is member of both spaces
  const inSource = await spacesService.isMember(sourceSpaceId, userId);
  if (!inSource) throw new ForbiddenError('You are not a member of the source space');
  const inTarget = await spacesService.isMember(targetSpaceId, userId);
  if (!inTarget) throw new ForbiddenError('You are not a member of the target space');

  // Check CREATE_PORTAL permission in target space
  const targetPerms = await computePermissions(targetSpaceId, userId);
  if (!hasPermission(targetPerms, Permissions.CREATE_PORTAL)) {
    throw new ForbiddenError('You do not have permission to create portals in the target space');
  }

  // Check for existing portal
  const existing = await db('portals').where({ channel_id: channelId, target_space_id: targetSpaceId }).first();
  if (existing) throw new ConflictError('Portal already exists for this channel and target space');

  const id = snowflake.generate();
  await db('portals').insert({
    id,
    channel_id: channelId,
    source_space_id: sourceSpaceId,
    target_space_id: targetSpaceId,
    created_by: userId,
  });

  return getPortal(id);
}

/**
 * Submit a portal invite (requires SUBMIT_PORTAL_INVITE in target space).
 * Posts a system message to the target space's admin channel.
 */
export async function submitPortalInvite(
  channelId: string,
  sourceSpaceId: string,
  targetSpaceId: string,
  userId: string,
) {
  if (sourceSpaceId === targetSpaceId) {
    throw new BadRequestError('Cannot create a portal to the same space');
  }

  // Verify channel belongs to source space
  const channel = await db('channels').where({ id: channelId, space_id: sourceSpaceId }).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.is_admin) throw new ForbiddenError('Cannot portal admin channels');

  // Verify user is member of both spaces
  const inSource = await spacesService.isMember(sourceSpaceId, userId);
  if (!inSource) throw new ForbiddenError('You are not a member of the source space');
  const inTarget = await spacesService.isMember(targetSpaceId, userId);
  if (!inTarget) throw new ForbiddenError('You are not a member of the target space');

  // Check SUBMIT_PORTAL_INVITE permission in target space
  const targetPerms = await computePermissions(targetSpaceId, userId);
  if (!hasPermission(targetPerms, Permissions.SUBMIT_PORTAL_INVITE)) {
    throw new ForbiddenError('You do not have permission to submit portal invites in the target space');
  }

  // Check for existing pending invite
  const existing = await db('portal_invites')
    .where({ channel_id: channelId, target_space_id: targetSpaceId, status: 'pending' })
    .first();
  if (existing) throw new ConflictError('A pending portal invite already exists for this channel');

  const id = snowflake.generate();
  await db('portal_invites').insert({
    id,
    channel_id: channelId,
    source_space_id: sourceSpaceId,
    target_space_id: targetSpaceId,
    requested_by: userId,
  });

  // Post system message to target space's admin channel
  const adminChannel = await db('channels')
    .where({ space_id: targetSpaceId, is_admin: true })
    .first();

  if (adminChannel) {
    const sourceSpace = await db('spaces').where('id', sourceSpaceId).first();
    const requester = await db('users').where('id', userId).first();

    await messagesService.createMessage(adminChannel.id, userId, {
      content: `Portal invite from **${sourceSpace?.name || 'Unknown'}** — channel **#${channel.name}** requested by **${requester?.username || 'unknown'}**`,
      messageType: 'portal_invite',
      metadata: {
        inviteId: id,
        sourceSpaceName: sourceSpace?.name || 'Unknown',
        channelName: channel.name,
        requestedByUsername: requester?.username || 'unknown',
      },
    });
  }

  return getPortalInvite(id);
}

/**
 * Accept a portal invite (requires ACCEPT_PORTAL_INVITE in target space).
 */
export async function acceptPortalInvite(inviteId: string, userId: string) {
  const invite = await db('portal_invites').where('id', inviteId).first();
  if (!invite) throw new NotFoundError('Portal invite');
  if (invite.status !== 'pending') throw new BadRequestError('Invite is no longer pending');

  // Check ACCEPT_PORTAL_INVITE permission in target space
  const targetPerms = await computePermissions(String(invite.target_space_id), userId);
  if (!hasPermission(targetPerms, Permissions.ACCEPT_PORTAL_INVITE)) {
    throw new ForbiddenError('You do not have permission to accept portal invites');
  }

  // Check for existing portal
  const existing = await db('portals')
    .where({ channel_id: invite.channel_id, target_space_id: invite.target_space_id })
    .first();

  await db.transaction(async (trx) => {
    // Update invite status
    await trx('portal_invites')
      .where('id', inviteId)
      .update({ status: 'accepted', resolved_by: userId, resolved_at: trx.fn.now() });

    // Create portal if it doesn't already exist
    if (!existing) {
      const portalId = snowflake.generate();
      await trx('portals').insert({
        id: portalId,
        channel_id: invite.channel_id,
        source_space_id: invite.source_space_id,
        target_space_id: invite.target_space_id,
        created_by: userId,
      });
    }
  });

  // Post confirmation to admin channel
  const adminChannel = await db('channels')
    .where({ space_id: invite.target_space_id, is_admin: true })
    .first();
  if (adminChannel) {
    const channel = await db('channels').where('id', invite.channel_id).first();
    const resolver = await db('users').where('id', userId).first();
    await messagesService.createMessage(adminChannel.id, userId, {
      content: `Portal invite for **#${channel?.name || 'unknown'}** has been **accepted** by **${resolver?.username || 'unknown'}**`,
      messageType: 'system',
    });
  }

  return { success: true };
}

/**
 * Reject a portal invite (requires ACCEPT_PORTAL_INVITE in target space).
 */
export async function rejectPortalInvite(inviteId: string, userId: string) {
  const invite = await db('portal_invites').where('id', inviteId).first();
  if (!invite) throw new NotFoundError('Portal invite');
  if (invite.status !== 'pending') throw new BadRequestError('Invite is no longer pending');

  const targetPerms = await computePermissions(String(invite.target_space_id), userId);
  if (!hasPermission(targetPerms, Permissions.ACCEPT_PORTAL_INVITE)) {
    throw new ForbiddenError('You do not have permission to reject portal invites');
  }

  await db('portal_invites')
    .where('id', inviteId)
    .update({ status: 'rejected', resolved_by: userId, resolved_at: db.fn.now() });

  // Post rejection to admin channel
  const adminChannel = await db('channels')
    .where({ space_id: invite.target_space_id, is_admin: true })
    .first();
  if (adminChannel) {
    const channel = await db('channels').where('id', invite.channel_id).first();
    const resolver = await db('users').where('id', userId).first();
    await messagesService.createMessage(adminChannel.id, userId, {
      content: `Portal invite for **#${channel?.name || 'unknown'}** has been **rejected** by **${resolver?.username || 'unknown'}**`,
      messageType: 'system',
    });
  }

  return { success: true };
}

/**
 * Remove a portal (requires MANAGE_CHANNELS in source space).
 */
export async function removePortal(portalId: string, userId: string) {
  const portal = await db('portals').where('id', portalId).first();
  if (!portal) throw new NotFoundError('Portal');

  const sourcePerms = await computePermissions(String(portal.source_space_id), userId);
  if (!hasPermission(sourcePerms, Permissions.MANAGE_CHANNELS)) {
    throw new ForbiddenError('You do not have permission to remove this portal');
  }

  await db('portals').where('id', portalId).delete();
}

/**
 * Get portals for a space (source or target).
 */
export async function getPortalsForSpace(spaceId: string) {
  const portals = await db('portals')
    .where('source_space_id', spaceId)
    .orWhere('target_space_id', spaceId)
    .select('portals.*');

  return Promise.all(portals.map(formatPortal));
}

/**
 * Get pending portal invites for a space (target).
 */
export async function getPortalInvites(spaceId: string) {
  const invites = await db('portal_invites')
    .where({ target_space_id: spaceId, status: 'pending' })
    .orderBy('created_at', 'desc');
  return Promise.all(invites.map(formatPortalInvite));
}

/**
 * Get eligible spaces for portaling a channel (for the "Create Portal" UI).
 */
export async function getEligibleSpaces(userId: string, channelId: string) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  const sourceSpaceId = String(channel.space_id);

  // Get all spaces the user is a member of (except the source)
  const memberships = await db('space_members')
    .where('user_id', userId)
    .whereNot('space_id', sourceSpaceId)
    .join('spaces', 'space_members.space_id', 'spaces.id')
    .select('spaces.*');

  const results = [];
  for (const space of memberships) {
    const perms = await computePermissions(String(space.id), userId);
    const canCreate = hasPermission(perms, Permissions.CREATE_PORTAL);
    const canSubmit = hasPermission(perms, Permissions.SUBMIT_PORTAL_INVITE);

    if (canCreate || canSubmit) {
      results.push({
        id: String(space.id),
        name: space.name,
        iconUrl: space.icon_url,
        canCreateDirectly: canCreate,
        canSubmitInvite: canSubmit,
      });
    }
  }

  return results;
}

// ─── Helpers ───

async function getPortal(id: string) {
  const p = await db('portals').where('id', id).first();
  if (!p) throw new NotFoundError('Portal');
  return formatPortal(p);
}

async function getPortalInvite(id: string) {
  const inv = await db('portal_invites').where('id', id).first();
  if (!inv) throw new NotFoundError('Portal invite');
  return formatPortalInvite(inv);
}

async function formatPortal(row: any) {
  const channel = await db('channels').where('id', row.channel_id).select('name').first();
  const sourceSpace = await db('spaces').where('id', row.source_space_id).select('name').first();
  const targetSpace = await db('spaces').where('id', row.target_space_id).select('name').first();
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    channelName: channel?.name || 'unknown',
    sourceSpaceId: String(row.source_space_id),
    sourceSpaceName: sourceSpace?.name || 'Unknown',
    targetSpaceId: String(row.target_space_id),
    targetSpaceName: targetSpace?.name || 'Unknown',
    createdBy: String(row.created_by),
    createdAt: row.created_at,
  };
}

async function formatPortalInvite(row: any) {
  const channel = await db('channels').where('id', row.channel_id).select('name').first();
  const sourceSpace = await db('spaces').where('id', row.source_space_id).select('name').first();
  const requester = await db('users').where('id', row.requested_by).select('username').first();
  return {
    id: String(row.id),
    channelId: String(row.channel_id),
    channelName: channel?.name || 'unknown',
    sourceSpaceId: String(row.source_space_id),
    sourceSpaceName: sourceSpace?.name || 'Unknown',
    targetSpaceId: String(row.target_space_id),
    requestedBy: String(row.requested_by),
    requestedByUsername: requester?.username || 'unknown',
    status: row.status,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
