import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import * as mentionsService from './mentions.service.js';
import * as notificationsService from '../notifications/notifications.service.js';

// ─── Messages CRUD ───

export async function listMessages(channelId: string, options: { before?: string; limit: number }) {
  let query = db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where('messages.channel_id', channelId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .orderBy('messages.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('messages.id', '<', options.before);
  }

  const rows = await query;
  const messageIds = rows.map((r: any) => r.id);
  const reactions = await getReactionsForMessages(messageIds);
  const replyCounts = await getReplyCountsForMessages(messageIds);
  const attachments = await getAttachmentsForMessages(messageIds);

  return rows.map((r: any) => formatMessage(r, reactions.get(r.id) || [], replyCounts.get(r.id) || 0, attachments.get(r.id) || [])).reverse();
}

export async function createMessage(
  channelId: string,
  authorId: string,
  data: { content: string; replyToId?: string; messageType?: string; metadata?: Record<string, any> },
  options?: { skipEvent?: boolean },
) {
  const id = snowflake.generate();

  await db('messages').insert({
    id,
    channel_id: channelId,
    author_id: authorId,
    content: data.content,
    reply_to_id: data.replyToId ?? null,
    message_type: data.messageType ?? 'user',
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  });

  const message = await getMessage(id);
  const channel = await db('channels').where('id', channelId).select('space_id', 'name').first();
  const spaceId = channel?.space_id ? String(channel.space_id) : null;

  if (!options?.skipEvent) {
    eventBus.emit('message.created', { message, channelId, spaceId });
  }

  // Handle mentions (fire-and-forget to not slow down message creation)
  if (spaceId && data.content) {
    const mentions = mentionsService.parseMentions(data.content);
    if (mentions.length > 0) {
      mentionsService.storeMentions(id, mentions, spaceId)
        .then(() => mentionsService.createMentionNotifications(id, channelId, spaceId, authorId, data.content))
        .catch((err) => console.error('Mention handling error:', err));
    }
  }

  // Handle reply notifications (fire-and-forget)
  if (data.replyToId && spaceId) {
    createReplyNotification(data.replyToId, id, channelId, spaceId, authorId, data.content, channel?.name)
      .catch((err) => console.error('Reply notification error:', err));
  }

  return message;
}

export async function emitMessageCreated(channelId: string, messageId: string) {
  const message = await getMessage(messageId);
  const channel = await db('channels').where('id', channelId).select('space_id').first();
  eventBus.emit('message.created', { message, channelId, spaceId: channel?.space_id });
}

export async function updateMessage(channelId: string, messageId: string, userId: string, content: string) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');
  if (msg.author_id !== userId) throw new ForbiddenError('You can only edit your own messages');

  await db('messages')
    .where({ id: messageId })
    .update({ content, edited_at: db.fn.now(3) });

  const message = await getMessage(messageId);
  eventBus.emit('message.updated', { message, channelId });
  return message;
}

export async function deleteMessage(channelId: string, messageId: string, userId: string, canManage: boolean) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');

  if (msg.author_id !== userId && !canManage) {
    throw new ForbiddenError('You do not have permission to delete this message');
  }

  await db('messages').where({ id: messageId }).delete();
  eventBus.emit('message.deleted', { channelId, messageId });
}

// ─── Reactions ───

export async function addReaction(channelId: string, messageId: string, userId: string, emoji: string) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');

  // Upsert — ignore duplicate
  await db('message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji })
    .onConflict(['message_id', 'user_id', 'emoji'])
    .ignore();

  const reactions = await getReactionsForMessage(messageId);
  eventBus.emit('message.reactions_updated', { channelId, messageId, reactions });
  return reactions;
}

export async function removeReaction(channelId: string, messageId: string, userId: string, emoji: string) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');

  await db('message_reactions')
    .where({ message_id: messageId, user_id: userId, emoji })
    .delete();

  const reactions = await getReactionsForMessage(messageId);
  eventBus.emit('message.reactions_updated', { channelId, messageId, reactions });
  return reactions;
}

// ─── Pinning ───

export async function pinMessage(channelId: string, messageId: string) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');

  await db('messages').where({ id: messageId }).update({ is_pinned: true });
  const message = await getMessage(messageId);
  eventBus.emit('message.updated', { message, channelId });
  return message;
}

export async function unpinMessage(channelId: string, messageId: string) {
  const msg = await db('messages').where({ id: messageId, channel_id: channelId }).first();
  if (!msg) throw new NotFoundError('Message');

  await db('messages').where({ id: messageId }).update({ is_pinned: false });
  const message = await getMessage(messageId);
  eventBus.emit('message.updated', { message, channelId });
  return message;
}

export async function getPinnedMessages(channelId: string) {
  const rows = await db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where({ 'messages.channel_id': channelId, 'messages.is_pinned': true })
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .orderBy('messages.id', 'desc');

  const messageIds = rows.map((r: any) => r.id);
  const reactions = await getReactionsForMessages(messageIds);
  const attachments = await getAttachmentsForMessages(messageIds);

  return rows.map((r: any) => formatMessage(r, reactions.get(r.id) || [], 0, attachments.get(r.id) || []));
}

// ─── Threads ───

export async function getThreadMessages(channelId: string, parentId: string, options: { before?: string; limit: number }) {
  // Get the parent message
  const parent = await getMessage(parentId);
  if (!parent || parent.channelId !== channelId) throw new NotFoundError('Message');

  let query = db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where({ 'messages.channel_id': channelId, 'messages.reply_to_id': parentId })
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
  const allIds = [parentId, ...rows.map((r: any) => r.id)];
  const reactions = await getReactionsForMessages(allIds);
  const attachments = await getAttachmentsForMessages(allIds);

  return {
    parent,
    replies: rows.map((r: any) => formatMessage(r, reactions.get(r.id) || [], 0, attachments.get(r.id) || [])),
  };
}

// ─── Search ───

export async function searchMessages(spaceId: string, rawQuery: string, options: { channelId?: string; limit: number; before?: string }) {
  // Parse operators: from:username, in:channel
  let searchText = rawQuery;
  let fromUsername: string | null = null;
  let inChannel: string | null = null;

  const fromMatch = searchText.match(/from:(\S+)/i);
  if (fromMatch) {
    fromUsername = fromMatch[1];
    searchText = searchText.replace(fromMatch[0], '').trim();
  }

  const inMatch = searchText.match(/in:(\S+)/i);
  if (inMatch) {
    inChannel = inMatch[1].replace(/^#/, '');
    searchText = searchText.replace(inMatch[0], '').trim();
  }

  let q = db('messages')
    .join('channels', 'messages.channel_id', 'channels.id')
    .join('users', 'messages.author_id', 'users.id')
    .where('channels.space_id', spaceId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'channels.name as channel_name',
    )
    .orderBy('messages.id', 'desc')
    .limit(options.limit);

  // Apply content search
  if (searchText) {
    // Try FULLTEXT first, fallback to LIKE for short words
    q = q.whereRaw('MATCH(messages.content) AGAINST(? IN NATURAL LANGUAGE MODE)', [searchText]);
  }

  // Apply operator filters
  if (fromUsername) {
    q = q.where('users.username', fromUsername);
  }
  if (inChannel) {
    q = q.where('channels.name', inChannel);
  }
  if (options.channelId) {
    q = q.where('messages.channel_id', options.channelId);
  }
  if (options.before) {
    q = q.where('messages.id', '<', options.before);
  }

  let rows = await q;

  // Fallback to LIKE if FULLTEXT returned no results (handles short words MySQL ignores)
  if (rows.length === 0 && searchText) {
    const likeTerm = `%${searchText}%`;
    let fallback = db('messages')
      .join('channels', 'messages.channel_id', 'channels.id')
      .join('users', 'messages.author_id', 'users.id')
      .where('channels.space_id', spaceId)
      .where('messages.content', 'like', likeTerm)
      .select(
        'messages.*',
        'users.username as author_username',
        'users.display_name as author_display_name',
        'users.avatar_url as author_avatar_url',
        'channels.name as channel_name',
      )
      .orderBy('messages.id', 'desc')
      .limit(options.limit);

    if (fromUsername) fallback = fallback.where('users.username', fromUsername);
    if (inChannel) fallback = fallback.where('channels.name', inChannel);
    if (options.channelId) fallback = fallback.where('messages.channel_id', options.channelId);
    if (options.before) fallback = fallback.where('messages.id', '<', options.before);

    rows = await fallback;
  }

  return rows.map((r: any) => ({
    ...formatMessage(r, [], 0, []),
    channelName: r.channel_name,
  }));
}

// ─── Single message lookup (public) ───

export async function getMessageById(messageId: string) {
  const row = await db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .join('channels', 'messages.channel_id', 'channels.id')
    .where('messages.id', messageId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'channels.name as channel_name',
      'channels.space_id',
    )
    .first();

  if (!row) throw new NotFoundError('Message');
  const reactions = await getReactionsForMessage(messageId);
  const replyCount = await getReplyCount(messageId);
  const attachments = await getAttachmentsForMessages([messageId]);
  return {
    ...formatMessage(row, reactions, replyCount, attachments.get(messageId) || []),
    channelName: row.channel_name,
    spaceId: String(row.space_id),
  };
}

// ─── Reply Notifications ───

async function createReplyNotification(
  parentMessageId: string,
  newMessageId: string,
  channelId: string,
  spaceId: string,
  authorId: string,
  content: string,
  channelName?: string,
) {
  const parent = await db('messages').where('id', parentMessageId).select('author_id').first();
  if (!parent || String(parent.author_id) === authorId) return;

  // Check if parent author has muted the replier
  const muted = await db('user_mutes')
    .where({ user_id: parent.author_id, muted_user_id: authorId })
    .first();
  if (muted) return;

  const space = await db('spaces').where('id', spaceId).select('name').first();
  const author = await db('users').where('id', authorId).select('username').first();
  if (!space || !author) return;

  const chName = channelName || (await db('channels').where('id', channelId).select('name').first())?.name || 'unknown';

  await notificationsService.createNotification(String(parent.author_id), 'reply', {
    messageId: newMessageId,
    parentMessageId,
    channelId,
    spaceId,
    repliedByUsername: author.username,
    channelName: chName,
    spaceName: space.name,
    messagePreview: content.slice(0, 100),
  });
}

// ─── Helpers ───

async function getMessage(messageId: string) {
  const row = await db('messages')
    .join('users', 'messages.author_id', 'users.id')
    .where('messages.id', messageId)
    .select(
      'messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .first();

  if (!row) throw new NotFoundError('Message');
  const reactions = await getReactionsForMessage(messageId);
  const replyCount = await getReplyCount(messageId);
  const attachments = await getAttachmentsForMessages([messageId]);
  return formatMessage(row, reactions, replyCount, attachments.get(messageId) || []);
}

async function getReactionsForMessage(messageId: string) {
  const rows = await db('message_reactions')
    .where('message_id', messageId)
    .join('users', 'message_reactions.user_id', 'users.id')
    .select('message_reactions.emoji', 'message_reactions.user_id', 'users.username');

  return aggregateReactions(rows);
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
    result.set(msgId, aggregateReactions(rawRows));
  }
  return result;
}

function aggregateReactions(rows: any[]) {
  const byEmoji = new Map<string, { emoji: string; count: number; users: { id: string; username: string }[] }>();
  for (const row of rows) {
    const existing = byEmoji.get(row.emoji);
    if (existing) {
      existing.count++;
      existing.users.push({ id: row.user_id, username: row.username });
    } else {
      byEmoji.set(row.emoji, {
        emoji: row.emoji,
        count: 1,
        users: [{ id: row.user_id, username: row.username }],
      });
    }
  }
  return Array.from(byEmoji.values());
}

async function getReplyCount(messageId: string): Promise<number> {
  const result = await db('messages').where('reply_to_id', messageId).count('* as count').first();
  return Number(result?.count || 0);
}

async function getReplyCountsForMessages(messageIds: string[]): Promise<Map<string, number>> {
  if (messageIds.length === 0) return new Map();
  const rows = await db('messages')
    .whereIn('reply_to_id', messageIds)
    .groupBy('reply_to_id')
    .select('reply_to_id', db.raw('count(*) as count'));

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.reply_to_id, Number(row.count));
  }
  return map;
}

function formatMessage(row: any, reactions: any[], replyCount: number, attachments: any[]) {
  let metadata = row.metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = null; }
  }
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    content: row.content,
    editedAt: row.edited_at,
    isPinned: row.is_pinned,
    replyToId: row.reply_to_id,
    replyCount,
    messageType: row.message_type ?? 'user',
    metadata: metadata ?? null,
    reactions,
    attachments,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    },
  };
}

// ─── Attachments ───

export async function createAttachment(
  messageId: string,
  file: { filename: string; originalName: string; mimeType: string; size: number; url: string },
) {
  const id = snowflake.generate();
  await db('attachments').insert({
    id,
    message_id: messageId,
    filename: file.filename,
    original_name: file.originalName,
    mime_type: file.mimeType,
    size: file.size,
    url: file.url,
  });
  return {
    id,
    messageId,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    url: file.url,
  };
}

async function getAttachmentsForMessages(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('attachments').whereIn('message_id', messageIds).select('*');

  const result = new Map<string, any[]>();
  for (const row of rows) {
    const list = result.get(row.message_id) || [];
    list.push({
      id: row.id,
      messageId: row.message_id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      url: row.url,
    });
    result.set(row.message_id, list);
  }
  return result;
}
