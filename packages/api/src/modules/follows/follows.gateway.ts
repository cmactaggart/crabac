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

export function registerFollowsGateway() {
  // Follow request sent (pending)
  eventBus.on('follow.request_sent', async ({ followerId, targetId }) => {
    if (!io) return;
    try {
      const follower = await db('users').where('id', followerId).first();
      if (!follower) return;

      io.to(`user:${targetId}`).emit('follow:request_received', {
        user: getPublicUser(follower),
      });

      // Create notification
      await createNotification(targetId, 'follow_request', {
        followerId: String(followerId),
        fromUsername: follower.username,
        fromDisplayName: follower.display_name,
        fromUserId: String(follower.id),
      });
    } catch {
      // ignore
    }
  });

  // Follow request accepted
  eventBus.on('follow.accepted', async ({ followerId, targetId }) => {
    if (!io) return;
    try {
      const target = await db('users').where('id', targetId).first();
      if (!target) return;

      io.to(`user:${followerId}`).emit('follow:accepted', {
        user: getPublicUser(target),
      });
    } catch {
      // ignore
    }
  });

  // New follower (auto-accepted)
  eventBus.on('follow.created', async ({ followerId, targetId }) => {
    if (!io) return;
    try {
      const follower = await db('users').where('id', followerId).first();
      if (!follower) return;

      io.to(`user:${targetId}`).emit('follow:new_follower', {
        user: getPublicUser(follower),
      });
    } catch {
      // ignore
    }
  });
}
