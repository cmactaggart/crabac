import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { db } from '../../database/connection.js';
import { sendPushNotification } from '../notifications/push.service.js';
import { config } from '../../config.js';

export function registerMessageGateway() {
  eventBus.on('message.created', ({ message, channelId, spaceId }) => {
    if (!io) return;
    const room = `channel:${channelId}`;
    if (message.metadata?.workflowId) {
      const roomSockets = io.sockets.adapter.rooms.get(room);
      console.log(`[Gateway] Emitting workflow message ${message.id} to room ${room} (${roomSockets?.size ?? 0} sockets)`);
    }
    io.to(room).emit('message:new', message);

    // Notify the space room so channel lists can update unreads in real time
    if (spaceId) {
      const spaceRoom = `space:${spaceId}`;
      const roomSockets = io.sockets.adapter.rooms.get(spaceRoom);
      console.log(`[Gateway] Emitting channel:activity to ${spaceRoom} (${roomSockets?.size ?? 0} sockets) channelId=${channelId}`);
      io.to(spaceRoom).emit('channel:activity', {
        channelId,
        authorId: message.authorId,
        messageId: message.id,
        spaceId,
      });

      // Send push notifications to members not currently viewing the channel
      sendChannelMessagePush(message, channelId, spaceId).catch((err) =>
        console.error('[Gateway] Channel push error:', err),
      );
    }
  });

  eventBus.on('message.updated', ({ message, channelId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:updated', message);
  });

  eventBus.on('message.deleted', ({ channelId, messageId }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:deleted', { channelId, messageId });
  });

  eventBus.on('message.embeds_ready', ({ channelId, messageId, embeds }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:embeds_ready', { channelId, messageId, embeds });
  });

  eventBus.on('message.reactions_updated', ({ channelId, messageId, reactions }) => {
    if (!io) return;
    io.to(`channel:${channelId}`).emit('message:reactions_updated', { channelId, messageId, reactions });
  });

  eventBus.on('space.member_joined', ({ spaceId, userId }) => {
    if (!io) return;
    io.to(`space:${spaceId}`).emit('space:member_joined', { spaceId, userId });
  });

  eventBus.on('space.member_left', ({ spaceId, userId }) => {
    if (!io) return;
    io.to(`space:${spaceId}`).emit('space:member_left', { spaceId, userId });
  });
}

async function sendChannelMessagePush(message: any, channelId: string, spaceId: string) {
  if (!io) return;

  // Get channel info (private flag, display name) and space name in one query
  const channelInfo = await db('channels')
    .join('spaces', 'channels.space_id', 'spaces.id')
    .where('channels.id', channelId)
    .select(
      'channels.name as channelName',
      'channels.display_name as channelDisplayName',
      'channels.is_private as isPrivate',
      'spaces.name as spaceName',
    )
    .first();
  if (!channelInfo) return;

  // Get eligible members: channel_members for private channels, space_members otherwise
  const memberRows = channelInfo.isPrivate
    ? await db('channel_members').where('channel_id', channelId).whereNot('user_id', message.authorId).select('user_id')
    : await db('space_members').where('space_id', spaceId).whereNot('user_id', message.authorId).select('user_id');

  if (memberRows.length === 0) return;
  const memberIds = memberRows.map((r: any) => String(r.user_id));

  // Build set of users who will already get a notification-triggered push (reply recipient + mentioned users)
  // so we don't send them a duplicate channel activity push
  const notifiedUserIds = new Set<string>();

  // Reply recipient
  if (message.replyToId) {
    const parent = await db('messages').where('id', message.replyToId).select('author_id').first();
    if (parent && String(parent.author_id) !== message.authorId) {
      notifiedUserIds.add(String(parent.author_id));
    }
  }

  // Mentioned users
  if (message.content) {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const usernames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(message.content)) !== null) {
      if (match[1] !== 'everyone' && match[1] !== 'here') usernames.push(match[1]);
    }
    if (usernames.length > 0) {
      const mentionedUsers = await db('users').whereIn('username', usernames).select('id');
      for (const u of mentionedUsers) notifiedUserIds.add(String(u.id));
    }
  }

  // Filter out users who have this channel muted
  const mutedRows = await db('channel_mutes')
    .where('channel_id', channelId)
    .whereIn('user_id', memberIds)
    .select('user_id');
  const mutedSet = new Set(mutedRows.map((r: any) => String(r.user_id)));

  // Filter out users who have the author muted
  const authorMutedRows = await db('user_mutes')
    .where('muted_user_id', message.authorId)
    .whereIn('user_id', memberIds)
    .select('user_id');
  const authorMutedSet = new Set(authorMutedRows.map((r: any) => String(r.user_id)));

  // Find users currently viewing this channel (they already see it in real time)
  const connectedSockets = await io.in(`channel:${channelId}`).fetchSockets();
  const connectedUserIds = new Set(connectedSockets.map((s) => s.data.userId));

  const channelLabel = channelInfo.channelDisplayName || channelInfo.channelName;
  const senderName = message.author?.displayName || message.author?.username || 'Someone';
  const title = `${senderName} (#${channelLabel} | ${channelInfo.spaceName})`;
  const body = message.content?.length > 150 ? message.content.slice(0, 150) + '...' : (message.content || '');

  const pushData: Record<string, string> = {
    type: 'channel_message',
    spaceId,
    channelId,
    messageId: String(message.id),
  };
  if (message.author?.avatarUrl) {
    pushData.avatarUrl = `${config.apiUrl}${message.author.avatarUrl}`;
  }

  for (const userId of memberIds) {
    if (connectedUserIds.has(userId)) continue;
    if (mutedSet.has(userId)) continue;
    if (authorMutedSet.has(userId)) continue;
    if (notifiedUserIds.has(userId)) continue;
    sendPushNotification(userId, title, body, pushData);
  }
}
