import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import { areFriends } from '../friends/friends.service.js';

// ─── Conversations ───

export async function findOrCreateConversation(userId: string, targetUserId: string) {
  // Check if a DM conversation already exists between these two users
  const existing = await db('conversation_members as cm1')
    .join('conversation_members as cm2', 'cm1.conversation_id', 'cm2.conversation_id')
    .join('conversations as c', 'c.id', 'cm1.conversation_id')
    .where('cm1.user_id', userId)
    .where('cm2.user_id', targetUserId)
    .where('c.type', 'dm')
    .select('cm1.conversation_id')
    .first();

  if (existing) {
    return getConversation(existing.conversation_id, userId);
  }

  // Check friendship status
  const friends = await areFriends(userId, targetUserId);

  // Create new conversation
  const id = snowflake.generate();
  await db('conversations').insert({ id, type: 'dm' });
  await db('conversation_members').insert([
    { conversation_id: id, user_id: userId, status: 'accepted' },
    { conversation_id: id, user_id: targetUserId, status: friends ? 'accepted' : 'pending' },
  ]);

  const conversation = await getConversation(id, userId);

  if (!friends) {
    // Emit event for message request notification
    const sender = await db('users').where('id', userId).first();
    eventBus.emit('dm.request_created', {
      conversation,
      senderId: userId,
      recipientId: targetUserId,
      senderUsername: sender?.username,
      senderDisplayName: sender?.display_name,
    });
  }

  return conversation;
}

export async function listConversations(userId: string) {
  // Only return conversations where user's status is 'accepted'
  const memberships = await db('conversation_members')
    .where({ user_id: userId, status: 'accepted' })
    .select('conversation_id');

  const convIds = memberships.map((m: any) => m.conversation_id);
  if (convIds.length === 0) return [];

  const conversations = [];
  for (const convId of convIds) {
    const conv = await getConversation(convId, userId);
    if (conv) conversations.push(conv);
  }

  // Sort by most recent activity (updatedAt)
  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return conversations;
}

export async function listMessageRequests(userId: string) {
  const memberships = await db('conversation_members')
    .where({ user_id: userId, status: 'pending' })
    .select('conversation_id');

  const convIds = memberships.map((m: any) => m.conversation_id);
  if (convIds.length === 0) return [];

  const conversations = [];
  for (const convId of convIds) {
    const conv = await getConversationRaw(convId);
    if (conv) conversations.push(conv);
  }

  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return conversations;
}

export async function acceptMessageRequest(conversationId: string, userId: string) {
  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();

  if (!membership) throw new NotFoundError('Conversation');
  if (membership.status !== 'pending') throw new BadRequestError('Not a pending request');

  await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .update({ status: 'accepted' });

  const conversation = await getConversation(conversationId, userId);
  eventBus.emit('conversation.request_accepted', { conversation, userId });
  return conversation;
}

export async function declineMessageRequest(conversationId: string, userId: string) {
  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();

  if (!membership) throw new NotFoundError('Conversation');
  if (membership.status !== 'pending') throw new BadRequestError('Not a pending request');

  // Delete conversation and its messages
  await db('direct_messages').where('conversation_id', conversationId).delete();
  await db('conversation_members').where('conversation_id', conversationId).delete();
  await db('conversations').where('id', conversationId).delete();
}

export async function createGroupDM(creatorId: string, participantIds: string[], name?: string) {
  // Verify all participants are friends with creator
  for (const pid of participantIds) {
    const friends = await areFriends(creatorId, pid);
    if (!friends) {
      throw new BadRequestError('All group members must be your friends');
    }
  }

  // Max 10 total members (creator + 9 participants)
  if (participantIds.length > 9) {
    throw new BadRequestError('Group DMs can have at most 10 members');
  }

  // Auto-generate name if not provided
  let groupName = name;
  if (!groupName) {
    const allIds = [creatorId, ...participantIds];
    const users = await db('users').whereIn('id', allIds).select('display_name');
    groupName = users.map((u: any) => u.display_name).join(', ');
    if (groupName.length > 100) groupName = groupName.substring(0, 97) + '...';
  }

  const id = snowflake.generate();
  await db('conversations').insert({
    id,
    type: 'group',
    name: groupName,
    owner_id: creatorId,
  });

  const members = [creatorId, ...participantIds].map((uid) => ({
    conversation_id: id,
    user_id: uid,
    status: 'accepted',
  }));
  await db('conversation_members').insert(members);

  const conversation = await getConversation(id, creatorId);

  eventBus.emit('conversation.created', {
    conversation,
    participantIds: [creatorId, ...participantIds],
  });

  return conversation;
}

export async function leaveGroupDM(conversationId: string, userId: string) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) throw new NotFoundError('Conversation');
  if (conv.type !== 'group') throw new BadRequestError('Can only leave group conversations');

  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new ForbiddenError('Not a member of this conversation');

  await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .delete();

  // Transfer ownership if needed
  if (String(conv.owner_id) === userId) {
    const nextMember = await db('conversation_members')
      .where('conversation_id', conversationId)
      .first();
    if (nextMember) {
      await db('conversations')
        .where('id', conversationId)
        .update({ owner_id: nextMember.user_id });
    } else {
      // No members left, delete conversation
      await db('direct_messages').where('conversation_id', conversationId).delete();
      await db('conversations').where('id', conversationId).delete();
      return;
    }
  }

  eventBus.emit('conversation.member_left', {
    conversationId: String(conversationId),
    userId,
  });
}

export async function renameGroupDM(conversationId: string, userId: string, newName: string) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) throw new NotFoundError('Conversation');
  if (conv.type !== 'group') throw new BadRequestError('Can only rename group conversations');

  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new ForbiddenError('Not a member of this conversation');

  await db('conversations')
    .where('id', conversationId)
    .update({ name: newName, updated_at: db.fn.now(3) });

  const conversation = await getConversation(conversationId, userId);
  eventBus.emit('conversation.updated', { conversation });
  return conversation;
}

export async function getConversation(conversationId: string, userId: string) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) return null;

  // Verify user is a member
  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) return null;

  return buildConversationResponse(conv);
}

export async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const row = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  return !!row;
}

// ─── Direct Messages ───

export async function listMessages(conversationId: string, options: { before?: string; limit: number }) {
  let query = db('direct_messages')
    .join('users', 'direct_messages.author_id', 'users.id')
    .where('direct_messages.conversation_id', conversationId)
    .select(
      'direct_messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('direct_messages.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('direct_messages.id', '<', options.before);
  }

  const rows = await query;
  return rows.map((r: any) => formatDM(r)).reverse();
}

export async function sendMessage(conversationId: string, authorId: string, content: string) {
  const id = snowflake.generate();

  await db('direct_messages').insert({
    id,
    conversation_id: conversationId,
    author_id: authorId,
    content,
  });

  // Update conversation timestamp
  await db('conversations')
    .where('id', conversationId)
    .update({ updated_at: db.fn.now(3) });

  const message = await getDM(id);
  eventBus.emit('dm.created', { message, conversationId });
  return message;
}

export async function editMessage(conversationId: string, messageId: string, userId: string, content: string) {
  const msg = await db('direct_messages').where({ id: messageId, conversation_id: conversationId }).first();
  if (!msg) throw new NotFoundError('Message');
  if (msg.author_id !== userId) throw new ForbiddenError('You can only edit your own messages');

  await db('direct_messages')
    .where({ id: messageId })
    .update({ content, edited_at: db.fn.now(3) });

  const message = await getDM(messageId);
  eventBus.emit('dm.updated', { message, conversationId });
  return message;
}

export async function deleteMessage(conversationId: string, messageId: string, userId: string) {
  const msg = await db('direct_messages').where({ id: messageId, conversation_id: conversationId }).first();
  if (!msg) throw new NotFoundError('Message');
  if (msg.author_id !== userId) throw new ForbiddenError('You can only delete your own messages');

  await db('direct_messages').where({ id: messageId }).delete();
  eventBus.emit('dm.deleted', { conversationId, messageId });
}

// ─── Single message lookup (public) ───

export async function getMessageById(messageId: string) {
  return getDM(messageId);
}

// ─── Read Tracking ───

export async function markDMRead(conversationId: string, userId: string, messageId: string) {
  await db('dm_reads')
    .insert({ conversation_id: conversationId, user_id: userId, last_read_id: messageId })
    .onConflict(['conversation_id', 'user_id'])
    .merge({ last_read_id: messageId });
}

export async function getDMUnreadCounts(userId: string): Promise<Record<string, number>> {
  // Get all conversations the user is a member of (accepted)
  const memberships = await db('conversation_members')
    .where({ user_id: userId, status: 'accepted' })
    .select('conversation_id');

  const convIds = memberships.map((m: any) => String(m.conversation_id));
  if (convIds.length === 0) return {};

  // Get last read positions
  const reads = await db('dm_reads')
    .where('user_id', userId)
    .whereIn('conversation_id', convIds)
    .select('conversation_id', 'last_read_id');

  const readMap = new Map<string, string>();
  for (const r of reads) {
    readMap.set(String(r.conversation_id), String(r.last_read_id));
  }

  // Count unread messages per conversation (excluding own messages)
  const result: Record<string, number> = {};

  for (const convId of convIds) {
    const lastReadId = readMap.get(convId);
    let query = db('direct_messages')
      .where('conversation_id', convId)
      .where('author_id', '!=', userId);
    if (lastReadId) {
      query = query.where('id', '>', lastReadId);
    }
    const countResult = await query.count('* as count').first();
    const count = Number(countResult?.count || 0);
    if (count > 0) {
      result[convId] = count;
    }
  }

  return result;
}

// ─── Helpers ───

async function getConversationRaw(conversationId: string) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) return null;
  return buildConversationResponse(conv);
}

async function buildConversationResponse(conv: any) {
  const conversationId = conv.id;

  // Get participants
  const participants = await db('conversation_members')
    .join('users', 'conversation_members.user_id', 'users.id')
    .where('conversation_members.conversation_id', conversationId)
    .select('users.id', 'users.username', 'users.display_name', 'users.avatar_url', 'users.base_color', 'users.accent_color', 'users.status');

  // Get last message
  const lastMsg = await db('direct_messages')
    .join('users', 'direct_messages.author_id', 'users.id')
    .where('direct_messages.conversation_id', conversationId)
    .orderBy('direct_messages.id', 'desc')
    .select(
      'direct_messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  return {
    id: conv.id.toString(),
    type: conv.type || 'dm',
    name: conv.name || null,
    ownerId: conv.owner_id ? conv.owner_id.toString() : null,
    participants: participants.map((p: any) => ({
      id: p.id.toString(),
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      baseColor: p.base_color || null,
      accentColor: p.accent_color || null,
      status: p.status,
    })),
    lastMessage: lastMsg ? formatDM(lastMsg) : null,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
  };
}

async function getDM(messageId: string) {
  const row = await db('direct_messages')
    .join('users', 'direct_messages.author_id', 'users.id')
    .where('direct_messages.id', messageId)
    .select(
      'direct_messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Message');
  return formatDM(row);
}

function formatDM(row: any) {
  return {
    id: row.id.toString(),
    conversationId: row.conversation_id.toString(),
    authorId: row.author_id.toString(),
    content: row.content,
    editedAt: row.edited_at,
    author: {
      id: row.author_id.toString(),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
  };
}
