import { eventBus } from '../../lib/event-bus.js';
import { io } from '../../websocket/socket-server.js';
import { db } from '../../database/connection.js';
import { createNotification } from '../notifications/notifications.service.js';

function getPublicUser(row: any) {
  return {
    id: String(row.id),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    baseColor: row.base_color || null,
    accentColor: row.accent_color || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerFriendsGateway() {
  eventBus.on('friend.request_sent', async ({ friendshipId, senderId, recipientId }) => {
    if (!io) return;
    try {
      const sender = await db('users').where('id', senderId).first();
      if (!sender) return;

      io.to(`user:${recipientId}`).emit('friend:request_received', {
        friendshipId,
        user: getPublicUser(sender),
      });

      // Create notification
      await createNotification(recipientId, 'friend_request', {
        friendshipId,
        fromUsername: sender.username,
        fromDisplayName: sender.display_name,
        fromUserId: String(sender.id),
      });
    } catch {
      // ignore
    }
  });

  eventBus.on('friend.accepted', async ({ friendshipId, accepterId, requesterId }) => {
    if (!io) return;
    try {
      const accepter = await db('users').where('id', accepterId).first();
      if (!accepter) return;

      io.to(`user:${requesterId}`).emit('friend:accepted', {
        friendshipId,
        user: getPublicUser(accepter),
      });
    } catch {
      // ignore
    }
  });

  eventBus.on('friend.removed', async ({ friendshipId, removerId, removedId }) => {
    if (!io) return;
    io.to(`user:${removedId}`).emit('friend:removed', { userId: removerId });
  });
}
