import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { eventBus } from '../../lib/event-bus.js';
import type { NotificationType } from '@crabac/shared';

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, any>,
) {
  const id = snowflake.generate();
  await db('notifications').insert({
    id,
    user_id: userId,
    type,
    data: JSON.stringify(data),
  });

  const notification = await getNotification(id);
  eventBus.emit('notification.created', { notification, userId });
  return notification;
}

export async function listNotifications(
  userId: string,
  options: { limit: number; before?: string },
) {
  let query = db('notifications')
    .where('user_id', userId)
    .orderBy('id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('id', '<', options.before);
  }

  const rows = await query;
  const notifications = rows.map(formatNotification);
  await resolveActionableStatuses(notifications, userId);
  return notifications;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db('notifications')
    .where({ user_id: userId, read: false })
    .count('* as count')
    .first();
  return Number(result?.count || 0);
}

export async function markAsRead(notificationId: string, userId: string) {
  await db('notifications')
    .where({ id: notificationId, user_id: userId })
    .update({ read: true });
}

export async function markAllAsRead(userId: string) {
  await db('notifications')
    .where({ user_id: userId, read: false })
    .update({ read: true });
}

async function getNotification(id: string) {
  const row = await db('notifications').where('id', id).first();
  return formatNotification(row);
}

async function resolveActionableStatuses(notifications: any[], userId: string) {
  // Collect IDs for batch queries
  const followFromUserIds: string[] = [];
  const dmConversationIds: string[] = [];
  const portalInviteIds: string[] = [];

  for (const n of notifications) {
    if (n.type === 'follow_request' && n.data.fromUserId) {
      followFromUserIds.push(n.data.fromUserId);
    } else if (n.type === 'dm_request' && n.data.conversationId) {
      dmConversationIds.push(n.data.conversationId);
    } else if (n.type === 'portal_invite' && n.data.inviteId) {
      portalInviteIds.push(n.data.inviteId);
    }
  }

  // Batch query follow statuses
  const followStatuses = new Map<string, string>();
  if (followFromUserIds.length > 0) {
    const rows = await db('follows')
      .whereIn('follower_id', followFromUserIds)
      .where('following_id', userId)
      .select('follower_id', 'status');
    for (const r of rows) followStatuses.set(String(r.follower_id), r.status);
  }

  // Batch query DM member statuses
  const dmStatuses = new Map<string, string>();
  if (dmConversationIds.length > 0) {
    const rows = await db('conversation_members')
      .whereIn('conversation_id', dmConversationIds)
      .where('user_id', userId)
      .select('conversation_id', 'status');
    for (const r of rows) dmStatuses.set(String(r.conversation_id), r.status);
  }

  // Batch query portal invite statuses
  const portalStatuses = new Map<string, string>();
  if (portalInviteIds.length > 0) {
    const rows = await db('portal_invites')
      .whereIn('id', portalInviteIds)
      .select('id', 'status');
    for (const r of rows) portalStatuses.set(String(r.id), r.status);
  }

  // Assign resolvedStatus to each notification
  for (const n of notifications) {
    if (n.type === 'follow_request') {
      const status = followStatuses.get(n.data.fromUserId);
      if (!status) n.resolvedStatus = 'rejected';
      else if (status === 'pending') n.resolvedStatus = 'pending';
      else n.resolvedStatus = 'accepted';
    } else if (n.type === 'dm_request') {
      const status = dmStatuses.get(n.data.conversationId);
      if (!status) n.resolvedStatus = 'rejected';
      else if (status === 'pending') n.resolvedStatus = 'pending';
      else if (status === 'accepted') n.resolvedStatus = 'accepted';
      else n.resolvedStatus = 'rejected';
    } else if (n.type === 'portal_invite') {
      const status = portalStatuses.get(n.data.inviteId);
      if (!status) n.resolvedStatus = 'rejected';
      else if (status === 'pending') n.resolvedStatus = 'pending';
      else if (status === 'accepted') n.resolvedStatus = 'accepted';
      else n.resolvedStatus = 'rejected';
    } else {
      n.resolvedStatus = null;
    }
  }
}

function formatNotification(row: any) {
  let data = row.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    data,
    read: !!row.read,
    createdAt: row.created_at,
  };
}
