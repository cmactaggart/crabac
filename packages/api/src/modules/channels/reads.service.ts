import { db } from '../../database/connection.js';

export async function markRead(channelId: string, userId: string, messageId: string) {
  await db('channel_reads')
    .insert({ channel_id: channelId, user_id: userId, last_read_id: messageId, mention_count: 0 })
    .onConflict(['channel_id', 'user_id'])
    .merge({ last_read_id: messageId, mention_count: 0 });
}

export async function getUnreadCounts(userId: string, channelIds: string[]): Promise<Map<string, { unreadCount: number; mentionCount: number }>> {
  if (channelIds.length === 0) return new Map();

  // Get last read positions
  const reads = await db('channel_reads')
    .where('user_id', userId)
    .whereIn('channel_id', channelIds)
    .select('channel_id', 'last_read_id', 'mention_count');

  const readMap = new Map<string, { lastReadId: string; mentionCount: number }>();
  for (const r of reads) {
    readMap.set(r.channel_id, { lastReadId: r.last_read_id, mentionCount: Number(r.mention_count) });
  }

  // Count unread messages per channel
  const result = new Map<string, { unreadCount: number; mentionCount: number }>();

  for (const channelId of channelIds) {
    const read = readMap.get(channelId);
    let countQuery = db('messages').where('channel_id', channelId);
    if (read) {
      countQuery = countQuery.where('id', '>', read.lastReadId);
    }
    const countResult = await countQuery.count('* as count').first();
    result.set(channelId, {
      unreadCount: Number(countResult?.count || 0),
      mentionCount: read?.mentionCount || 0,
    });
  }

  return result;
}
