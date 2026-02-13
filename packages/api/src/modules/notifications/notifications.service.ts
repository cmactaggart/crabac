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
  return rows.map(formatNotification);
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
