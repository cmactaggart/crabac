import type { Server, Socket } from 'socket.io';
import { redis } from '../lib/redis.js';
import * as spacesService from '../modules/spaces/spaces.service.js';
import * as messagesService from '../modules/messages/messages.service.js';
import * as dmService from '../modules/dm/dm.service.js';
import { getChannelSpaceId } from '../modules/channels/channels.service.js';
import { computeChannelPermissions } from '../modules/rbac/rbac.service.js';
import { hasPermission, Permissions } from '@gud/shared';
import { db } from '../database/connection.js';

const PRESENCE_TTL = 60; // seconds
const TYPING_TIMEOUT = 5000; // ms

export async function registerHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  // Join personal room for friend/DM request notifications
  socket.join(`user:${userId}`);

  // Join rooms before broadcasting presence so the user receives their own event
  await joinUserSpaces(socket, userId);
  await joinUserConversations(socket, userId);

  // Set user online
  setPresence(io, userId, 'online');

  // --- Channel subscription ---
  socket.on('channel:join', async ({ channelId }: { channelId: string }) => {
    try {
      const spaceId = await getChannelSpaceId(channelId);
      let isMember = await spacesService.isMember(spaceId, userId);

      // Check portal access if not a direct member
      if (!isMember) {
        const portal = await db('portals').where('channel_id', channelId).first();
        if (portal) {
          isMember = await spacesService.isMember(String(portal.target_space_id), userId);
        }
      }
      if (!isMember) return;

      // Check channel-level VIEW_CHANNELS
      const perms = await computeChannelPermissions(spaceId, channelId, userId);
      if (!hasPermission(perms, Permissions.VIEW_CHANNELS)) return;

      socket.join(`channel:${channelId}`);
      console.log(`Socket ${socket.id} joined channel:${channelId}`);
    } catch {
      // ignore invalid channels
    }
  });

  socket.on('channel:leave', ({ channelId }: { channelId: string }) => {
    socket.leave(`channel:${channelId}`);
  });

  // --- Send message via socket ---
  socket.on('message:send', async (payload: { channelId: string; content: string; replyToId?: string }) => {
    try {
      const spaceId = await getChannelSpaceId(payload.channelId);
      let isMember = await spacesService.isMember(spaceId, userId);
      if (!isMember) {
        const portal = await db('portals').where('channel_id', payload.channelId).first();
        if (portal) isMember = await spacesService.isMember(String(portal.target_space_id), userId);
      }
      if (!isMember) return;

      const perms = await computeChannelPermissions(spaceId, payload.channelId, userId);
      if (!hasPermission(perms, Permissions.SEND_MESSAGES)) return;

      const message = await messagesService.createMessage(payload.channelId, userId, {
        content: payload.content,
        replyToId: payload.replyToId,
      });

      // createMessage emits 'message.created' on eventBus, which the gateway handles
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // --- Typing indicator ---
  socket.on('message:typing', async ({ channelId }: { channelId: string }) => {
    try {
      const spaceId = await getChannelSpaceId(channelId);
      const member = await spacesService.isMember(spaceId, userId);
      if (!member) return;

      const user = await db('users').where('id', userId).select('username').first();
      socket.to(`channel:${channelId}`).emit('member:typing', {
        channelId,
        userId,
        username: user?.username ?? 'Unknown',
      });
    } catch {
      // ignore
    }
  });

  // --- DM room join (for new conversations created after socket connect) ---
  socket.on('dm:join', async ({ conversationId }: { conversationId: string }) => {
    try {
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return;
      socket.join(`dm:${conversationId}`);
    } catch {
      // ignore
    }
  });

  // --- DM send via socket ---
  socket.on('dm:send', async (payload: { conversationId: string; content: string }) => {
    try {
      const isMember = await dmService.isConversationMember(payload.conversationId, userId);
      if (!isMember) return;
      await dmService.sendMessage(payload.conversationId, userId, payload.content);
    } catch (err) {
      socket.emit('error', { message: 'Failed to send DM' });
    }
  });

  // --- DM typing indicator ---
  socket.on('dm:typing', async ({ conversationId }: { conversationId: string }) => {
    try {
      const isMember = await dmService.isConversationMember(conversationId, userId);
      if (!isMember) return;
      const user = await db('users').where('id', userId).select('username').first();
      socket.to(`dm:${conversationId}`).emit('dm:typing', {
        conversationId,
        userId,
        username: user?.username ?? 'Unknown',
      });
    } catch {
      // ignore
    }
  });

  // --- Heartbeat for presence ---
  socket.on('presence:heartbeat', () => {
    setPresence(io, userId, 'online');
  });

  // --- Status change ---
  socket.on('presence:status', ({ status }: { status: string }) => {
    if (['online', 'idle', 'dnd', 'offline'].includes(status)) {
      setPresence(io, userId, status);
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', async (reason) => {
    console.log(`Socket disconnected: ${socket.id} (user: ${userId}, reason: ${reason})`);

    // Check if user has other active sockets
    const sockets = await io.fetchSockets();
    const hasOtherSockets = sockets.some(
      (s) => s.data.userId === userId && s.id !== socket.id,
    );

    if (!hasOtherSockets) {
      setPresence(io, userId, 'offline');
    }
  });
}

async function joinUserSpaces(socket: Socket, userId: string) {
  try {
    const memberships = await db('space_members')
      .where('user_id', userId)
      .select('space_id');

    for (const m of memberships) {
      socket.join(`space:${m.space_id}`);
    }
  } catch {
    // ignore
  }
}

async function joinUserConversations(socket: Socket, userId: string) {
  try {
    const memberships = await db('conversation_members')
      .where('user_id', userId)
      .select('conversation_id');

    for (const m of memberships) {
      socket.join(`dm:${m.conversation_id}`);
    }
  } catch {
    // ignore
  }
}

async function setPresence(io: Server, userId: string, status: string) {
  const key = `presence:${userId}`;
  if (status === 'offline') {
    await redis.del(key);
  } else {
    await redis.set(key, status, 'EX', PRESENCE_TTL);
  }

  // Update DB
  await db('users').where('id', userId).update({ status });

  // Broadcast to all spaces this user is in
  const memberships = await db('space_members')
    .where('user_id', userId)
    .select('space_id');

  for (const m of memberships) {
    io.to(`space:${m.space_id}`).emit('member:presence', { userId, status });
  }
}
