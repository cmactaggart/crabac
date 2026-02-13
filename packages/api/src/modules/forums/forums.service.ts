import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';

export async function createThread(
  channelId: string,
  authorId: string,
  data: { title: string; content: string },
) {
  // Verify channel is forum type
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'forum') throw new BadRequestError('Channel is not a forum');

  const threadId = snowflake.generate();
  const messageId = snowflake.generate();

  await db.transaction(async (trx) => {
    await trx('forum_threads').insert({
      id: threadId,
      channel_id: channelId,
      title: data.title,
      author_id: authorId,
    });

    // Create opening post
    await trx('messages').insert({
      id: messageId,
      channel_id: channelId,
      author_id: authorId,
      content: data.content,
      thread_id: threadId,
      message_type: 'user',
    });
  });

  const thread = await getThread(threadId);
  const spaceId = String(channel.space_id);
  eventBus.emit('forum.thread_created', { thread, channelId, spaceId });
  return thread;
}

export async function listThreads(
  channelId: string,
  options: { before?: string; limit: number; sort: 'latest' | 'newest' },
) {
  let query = db('forum_threads as ft')
    .join('users', 'ft.author_id', 'users.id')
    .where('ft.channel_id', channelId)
    .select(
      'ft.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      db.raw('(SELECT COUNT(*) FROM messages m WHERE m.thread_id = ft.id) - 1 as reply_count'),
      db.raw('(SELECT MAX(m2.id) FROM messages m2 WHERE m2.thread_id = ft.id) as last_message_id'),
      db.raw('(SELECT m3.content FROM messages m3 WHERE m3.thread_id = ft.id ORDER BY m3.id ASC LIMIT 1) as first_post_content'),
    )
    .limit(options.limit);

  if (options.sort === 'latest') {
    // Order by pinned first, then by last activity
    query = query.orderBy([
      { column: 'ft.is_pinned', order: 'desc' },
      { column: 'last_message_id', order: 'desc', nulls: 'last' },
    ]);
  } else {
    query = query.orderBy([
      { column: 'ft.is_pinned', order: 'desc' },
      { column: 'ft.id', order: 'desc' },
    ]);
  }

  if (options.before) {
    query = query.where('ft.id', '<', options.before);
  }

  const rows = await query;
  return rows.map(formatThreadSummary);
}

export async function getThread(threadId: string) {
  const row = await db('forum_threads as ft')
    .join('users', 'ft.author_id', 'users.id')
    .where('ft.id', threadId)
    .select(
      'ft.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .first();

  if (!row) throw new NotFoundError('Thread');
  return formatThread(row);
}

export async function listThreadPosts(
  threadId: string,
  options: { before?: string; limit: number },
) {
  let query = db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where('messages.thread_id', threadId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .orderBy('messages.id', 'asc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('messages.id', '<', options.before);
  }

  const rows = await query;

  // Get reactions for posts
  const messageIds = rows.map((r: any) => r.id);
  const reactions = await getReactionsForMessages(messageIds);

  return rows.map((r: any) => formatPost(r, reactions.get(r.id) || []));
}

export async function createThreadPost(
  threadId: string,
  authorId: string,
  data: { content: string; replyToId?: string },
) {
  const thread = await db('forum_threads').where('id', threadId).first();
  if (!thread) throw new NotFoundError('Thread');
  if (thread.is_locked) throw new ForbiddenError('Thread is locked');

  const messageId = snowflake.generate();

  await db.transaction(async (trx) => {
    await trx('messages').insert({
      id: messageId,
      channel_id: thread.channel_id,
      author_id: authorId,
      content: data.content,
      thread_id: threadId,
      reply_to_id: data.replyToId ?? null,
      message_type: 'user',
    });

    await trx('forum_threads').where('id', threadId).update({
      updated_at: trx.fn.now(3),
    });
  });

  const post = await db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where('messages.id', messageId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .first();

  const formatted = formatPost(post, []);
  const channelId = String(thread.channel_id);
  const channel = await db('channels').where('id', channelId).select('space_id').first();
  const spaceId = channel ? String(channel.space_id) : null;

  eventBus.emit('forum.post_created', { post: formatted, threadId, channelId, spaceId });
  return formatted;
}

export async function updateThread(
  threadId: string,
  data: { title?: string; isPinned?: boolean; isLocked?: boolean },
) {
  const thread = await db('forum_threads').where('id', threadId).first();
  if (!thread) throw new NotFoundError('Thread');

  const updates: Record<string, any> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.isPinned !== undefined) updates.is_pinned = data.isPinned;
  if (data.isLocked !== undefined) updates.is_locked = data.isLocked;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = db.fn.now(3);
    await db('forum_threads').where('id', threadId).update(updates);
  }

  const updated = await getThread(threadId);
  const channelId = String(thread.channel_id);
  const channel = await db('channels').where('id', channelId).select('space_id').first();
  const spaceId = channel ? String(channel.space_id) : null;

  eventBus.emit('forum.thread_updated', { thread: updated, channelId, spaceId });
  return updated;
}

export async function deleteThread(threadId: string) {
  const thread = await db('forum_threads').where('id', threadId).first();
  if (!thread) throw new NotFoundError('Thread');

  await db('forum_threads').where('id', threadId).delete();
}

export async function getThreadChannelId(threadId: string): Promise<string> {
  const thread = await db('forum_threads').where('id', threadId).select('channel_id').first();
  if (!thread) throw new NotFoundError('Thread');
  return String(thread.channel_id);
}

// ─── Helpers ───

function formatThread(row: any) {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.title,
    authorId: row.author_id,
    isPinned: row.is_pinned,
    isLocked: row.is_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    },
  };
}

function formatThreadSummary(row: any) {
  return {
    ...formatThread(row),
    replyCount: Number(row.reply_count || 0),
    lastActivityAt: row.last_message_id ? row.updated_at : row.created_at,
    firstPostPreview: row.first_post_content ? row.first_post_content.slice(0, 200) : '',
  };
}

function formatPost(row: any, reactions: any[]) {
  let metadata = row.metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = null; }
  }
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    content: row.content,
    threadId: row.thread_id,
    editedAt: row.edited_at,
    isPinned: row.is_pinned,
    replyToId: row.reply_to_id,
    replyCount: 0,
    messageType: row.message_type ?? 'user',
    metadata: metadata ?? null,
    reactions,
    attachments: [],
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    },
  };
}

async function getReactionsForMessages(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('message_reactions')
    .whereIn('message_id', messageIds)
    .join('users', 'message_reactions.user_id', 'users.id')
    .select('message_reactions.message_id', 'message_reactions.emoji', 'message_reactions.user_id', 'users.username');

  const byMessage = new Map<string, any[]>();
  for (const row of rows) {
    const list = byMessage.get(row.message_id) || [];
    list.push(row);
    byMessage.set(row.message_id, list);
  }

  const result = new Map<string, any[]>();
  for (const [msgId, rawRows] of byMessage) {
    const byEmoji = new Map<string, { emoji: string; count: number; users: { id: string; username: string }[] }>();
    for (const r of rawRows) {
      const existing = byEmoji.get(r.emoji);
      if (existing) {
        existing.count++;
        existing.users.push({ id: r.user_id, username: r.username });
      } else {
        byEmoji.set(r.emoji, { emoji: r.emoji, count: 1, users: [{ id: r.user_id, username: r.username }] });
      }
    }
    result.set(msgId, Array.from(byEmoji.values()));
  }
  return result;
}
