import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import { getPreferences } from '../users/preferences.service.js';
import * as searchService from '../search/search.service.js';
import { processDMEmbeds, reprocessDMEmbeds, getDMEmbedsForMessages } from '../messages/embeds.service.js';

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

  // Resolve messaging privacy
  const policy = await resolveMessagingPolicy(userId, targetUserId, 'dm');

  if (policy === 'dont_allow') {
    throw new BadRequestError('This user does not accept messages from you');
  }

  const recipientStatus = policy === 'accept_all' ? 'accepted' : 'pending';

  // Create new conversation
  const id = snowflake.generate();
  await db('conversations').insert({ id, type: 'dm' });
  await db('conversation_members').insert([
    { conversation_id: id, user_id: userId, status: 'accepted' },
    { conversation_id: id, user_id: targetUserId, status: recipientStatus },
  ]);

  const conversation = await getConversation(id, userId);

  if (recipientStatus === 'pending') {
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
    const conv = await db('conversations').where('id', convId).first();
    if (conv) conversations.push(await buildConversationResponse(conv, userId));
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
  // Max 10 total members (creator + 9 participants)
  if (participantIds.length > 9) {
    throw new BadRequestError('Group DMs can have at most 10 members');
  }

  // Resolve messaging privacy for each participant
  const memberStatuses: { userId: string; status: 'accepted' | 'pending' }[] = [
    { userId: creatorId, status: 'accepted' },
  ];

  for (const pid of participantIds) {
    const policy = await resolveMessagingPolicy(creatorId, pid, 'group_dm');
    if (policy === 'dont_allow') {
      const user = await db('users').where('id', pid).select('username').first();
      throw new BadRequestError(`${user?.username || 'This user'} does not accept group messages from you`);
    }
    memberStatuses.push({
      userId: pid,
      status: policy === 'accept_all' ? 'accepted' : 'pending',
    });
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

  const members = memberStatuses.map((m) => ({
    conversation_id: id,
    user_id: m.userId,
    status: m.status,
  }));
  await db('conversation_members').insert(members);

  const conversation = await getConversation(id, creatorId);

  eventBus.emit('conversation.created', {
    conversation,
    participantIds: [creatorId, ...participantIds],
  });

  return conversation;
}

export async function addGroupDMMembers(conversationId: string, userId: string, newMemberIds: string[]) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) throw new NotFoundError('Conversation');
  if (conv.type !== 'group') throw new BadRequestError('Can only add members to group conversations');

  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new ForbiddenError('Not a member of this conversation');

  // Check current member count
  const currentMembers = await db('conversation_members')
    .where('conversation_id', conversationId)
    .select('user_id');
  const currentMemberIds = new Set(currentMembers.map((m: any) => String(m.user_id)));

  // Filter out users already in the group
  const toAdd = newMemberIds.filter((id) => !currentMemberIds.has(id));
  if (toAdd.length === 0) throw new BadRequestError('All selected users are already members');

  if (currentMemberIds.size + toAdd.length > 10) {
    throw new BadRequestError('Group DMs can have at most 10 members');
  }

  // Resolve messaging privacy for each new member
  const newMembers: { user_id: string; status: string }[] = [];
  for (const mid of toAdd) {
    const policy = await resolveMessagingPolicy(userId, mid, 'group_dm');
    if (policy === 'dont_allow') {
      const user = await db('users').where('id', mid).select('username').first();
      throw new BadRequestError(`${user?.username || 'This user'} does not accept group messages from you`);
    }
    newMembers.push({
      user_id: mid,
      status: policy === 'accept_all' ? 'accepted' : 'pending',
    });
  }

  await db('conversation_members').insert(
    newMembers.map((m) => ({
      conversation_id: conversationId,
      ...m,
    })),
  );

  const conversation = await getConversation(conversationId, userId);

  eventBus.emit('conversation.members_added', {
    conversation,
    addedMemberIds: toAdd,
    existingMemberIds: Array.from(currentMemberIds),
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

  return buildConversationResponse(conv, userId);
}

// ─── Mute / Delete ───

export async function muteConversation(conversationId: string, userId: string) {
  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new NotFoundError('Conversation');

  await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .update({ muted: true });
}

export async function unmuteConversation(conversationId: string, userId: string) {
  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new NotFoundError('Conversation');

  await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .update({ muted: false });
}

export async function isConversationMuted(conversationId: string, userId: string): Promise<boolean> {
  const row = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  return !!row?.muted;
}

export async function deleteConversation(conversationId: string, userId: string) {
  const conv = await db('conversations').where('id', conversationId).first();
  if (!conv) throw new NotFoundError('Conversation');
  if (conv.type !== 'dm') throw new BadRequestError('Use leave for group conversations');

  const membership = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!membership) throw new ForbiddenError('Not a member of this conversation');

  await db('direct_messages').where('conversation_id', conversationId).delete();
  await db('dm_reads').where('conversation_id', conversationId).delete();
  await db('conversation_members').where('conversation_id', conversationId).delete();
  await db('conversations').where('id', conversationId).delete();
}

export async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const row = await db('conversation_members')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  return !!row;
}

// ─── Direct Messages ───

export async function listMessages(conversationId: string, options: { before?: string; limit: number; blockedUserIds?: string[] }) {
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

  if (options.blockedUserIds && options.blockedUserIds.length > 0) {
    query = query.whereNotIn('direct_messages.author_id', options.blockedUserIds);
  }

  const rows = await query;
  const messageIds = rows.map((r: any) => String(r.id));
  const [reactionsMap, attachmentsMap, embedsMap] = await Promise.all([
    getDMReactionsForMessages(messageIds),
    getDMAttachmentsForMessages(messageIds),
    getDMEmbedsForMessages(messageIds),
  ]);

  return rows.map((r: any) => formatDM(
    r,
    reactionsMap.get(String(r.id)) || [],
    attachmentsMap.get(String(r.id)) || [],
    embedsMap.get(String(r.id)) || [],
  )).reverse();
}

export async function sendMessage(conversationId: string, authorId: string, content: string, opts?: { skipEvent?: boolean }) {
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
  if (!opts?.skipEvent) {
    eventBus.emit('dm.created', { message, conversationId });
  }

  // Handle link embeds (fire-and-forget)
  if (content) {
    processDMEmbeds(String(id), String(conversationId), content)
      .catch((err) => console.error('DM embed processing error:', err));
  }

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

  // Re-process embeds on edit (fire-and-forget)
  reprocessDMEmbeds(String(messageId), String(conversationId), content)
    .catch((err) => console.error('DM embed reprocess error:', err));

  return message;
}

export async function deleteMessage(conversationId: string, messageId: string, userId: string, isAdmin = false) {
  const msg = await db('direct_messages').where({ id: messageId, conversation_id: conversationId }).first();
  if (!msg) throw new NotFoundError('Message');
  if (msg.author_id !== userId && !isAdmin) throw new ForbiddenError('You can only delete your own messages');

  await db('direct_messages').where({ id: messageId }).delete();
  eventBus.emit('dm.deleted', { conversationId, messageId });
}

// ─── Single message lookup (public) ───

export async function getMessageById(messageId: string) {
  return getDM(messageId);
}

// ─── Reactions ───

export async function addDMReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
  const msg = await db('direct_messages').where({ id: messageId, conversation_id: conversationId }).first();
  if (!msg) throw new NotFoundError('Message');

  await db('dm_message_reactions')
    .insert({ dm_message_id: messageId, user_id: userId, emoji })
    .onConflict(['dm_message_id', 'user_id', 'emoji'])
    .ignore();

  const reactions = await getDMReactionsForMessage(messageId);
  eventBus.emit('dm.reactions_updated', { conversationId, messageId, reactions });
  return reactions;
}

export async function removeDMReaction(conversationId: string, messageId: string, userId: string, emoji: string) {
  const msg = await db('direct_messages').where({ id: messageId, conversation_id: conversationId }).first();
  if (!msg) throw new NotFoundError('Message');

  await db('dm_message_reactions')
    .where({ dm_message_id: messageId, user_id: userId, emoji })
    .delete();

  const reactions = await getDMReactionsForMessage(messageId);
  eventBus.emit('dm.reactions_updated', { conversationId, messageId, reactions });
  return reactions;
}

// ─── DM Attachments ───

export async function createDMAttachment(
  messageId: string,
  file: { filename: string; originalName: string; mimeType: string; size: number; url: string },
  metadata?: Record<string, any> | null,
) {
  const id = snowflake.generate();
  await db('dm_attachments').insert({
    id,
    dm_message_id: messageId,
    filename: file.filename,
    original_name: file.originalName,
    mime_type: file.mimeType,
    size: file.size,
    url: file.url,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
  return { id, messageId, filename: file.filename, originalName: file.originalName, mimeType: file.mimeType, size: file.size, url: file.url, metadata: metadata ?? null };
}

export async function emitDMCreated(conversationId: string, messageId: string) {
  const message = await getDM(messageId);
  eventBus.emit('dm.created', { message, conversationId });
}

// ─── DM Search ───

export async function searchDMs(
  userId: string,
  query: string,
  options: { conversationId?: string; limit?: number; before?: string; blockedUserIds?: string[] } = {},
) {
  // Get user's accepted conversations (or verify single conversation membership)
  let conversationIds: string[];

  if (options.conversationId) {
    const membership = await db('conversation_members')
      .where({ conversation_id: options.conversationId, user_id: userId, status: 'accepted' })
      .first();
    if (!membership) throw new ForbiddenError('Not a member of this conversation');
    conversationIds = [options.conversationId];
  } else {
    const memberships = await db('conversation_members')
      .where({ user_id: userId, status: 'accepted' })
      .select('conversation_id');
    conversationIds = memberships.map((m: any) => String(m.conversation_id));
    if (conversationIds.length === 0) return [];
  }

  const tsResults = await searchService.searchDirectMessages(conversationIds, query, {
    conversationId: options.conversationId,
    limit: options.limit || 25,
    before: options.before,
  });

  if (tsResults.length === 0) return [];

  // Hydrate from MySQL
  const ids = tsResults.map((r) => r.id);
  const rows = await db('direct_messages')
    .join('users', 'direct_messages.author_id', 'users.id')
    .whereIn('direct_messages.id', ids)
    .select(
      'direct_messages.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    );

  // Filter blocked users
  const blockedSet = new Set(options.blockedUserIds || []);
  const rowMap = new Map(rows.map((r: any) => [String(r.id), r]));

  return ids
    .map((id) => rowMap.get(id))
    .filter((r: any) => r && !blockedSet.has(String(r.author_id)))
    .map((r: any) => formatDM(r));
}

// ─── Read Tracking ───

export async function markDMRead(conversationId: string, userId: string, messageId: string) {
  await db('dm_reads')
    .insert({ conversation_id: conversationId, user_id: userId, last_read_id: messageId })
    .onConflict(['conversation_id', 'user_id'])
    .merge({ last_read_id: messageId });
}

export async function getDMUnreadCounts(userId: string): Promise<Record<string, number>> {
  // Get all conversations the user is a member of (accepted, not muted)
  const memberships = await db('conversation_members')
    .where({ user_id: userId, status: 'accepted', muted: false })
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

async function buildConversationResponse(conv: any, forUserId?: string) {
  const conversationId = conv.id;

  // Get participants
  const participants = await db('conversation_members')
    .join('users', 'conversation_members.user_id', 'users.id')
    .where('conversation_members.conversation_id', conversationId)
    .select('users.id', 'users.username', 'users.display_name', 'users.avatar_url', 'users.base_color', 'users.accent_color', 'users.status', 'conversation_members.muted');

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

  // Determine muted state for requesting user
  let muted: boolean | undefined;
  if (forUserId) {
    const userParticipant = participants.find((p: any) => String(p.id) === forUserId);
    muted = !!userParticipant?.muted;
  }

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
    ...(muted !== undefined && { muted }),
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
  const [reactions, attachments, embeds] = await Promise.all([
    getDMReactionsForMessage(messageId),
    getDMAttachmentsForMessages([messageId]),
    getDMEmbedsForMessages([messageId]),
  ]);
  return formatDM(row, reactions, attachments.get(messageId) || [], embeds.get(messageId) || []);
}

function formatDM(row: any, reactions: any[] = [], attachments: any[] = [], embeds: any[] = []) {
  return {
    id: row.id.toString(),
    conversationId: row.conversation_id.toString(),
    authorId: row.author_id.toString(),
    content: row.content,
    editedAt: row.edited_at,
    reactions,
    attachments,
    embeds,
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

// ─── Reaction Helpers ───

async function getDMReactionsForMessage(messageId: string) {
  const rows = await db('dm_message_reactions')
    .where('dm_message_id', messageId)
    .join('users', 'dm_message_reactions.user_id', 'users.id')
    .select('dm_message_reactions.emoji', 'dm_message_reactions.user_id', 'users.username');

  return aggregateReactions(rows);
}

async function getDMReactionsForMessages(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('dm_message_reactions')
    .whereIn('dm_message_id', messageIds)
    .join('users', 'dm_message_reactions.user_id', 'users.id')
    .select('dm_message_reactions.dm_message_id', 'dm_message_reactions.emoji', 'dm_message_reactions.user_id', 'users.username');

  const byMessage = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.dm_message_id);
    const list = byMessage.get(key) || [];
    list.push(row);
    byMessage.set(key, list);
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
      existing.users.push({ id: String(row.user_id), username: row.username });
    } else {
      byEmoji.set(row.emoji, {
        emoji: row.emoji,
        count: 1,
        users: [{ id: String(row.user_id), username: row.username }],
      });
    }
  }
  return Array.from(byEmoji.values());
}

// ─── Attachment Helpers ───

async function getDMAttachmentsForMessages(messageIds: string[]): Promise<Map<string, any[]>> {
  if (messageIds.length === 0) return new Map();

  const rows = await db('dm_attachments').whereIn('dm_message_id', messageIds).select('*');

  const result = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.dm_message_id);
    const list = result.get(key) || [];
    let meta = row.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    list.push({
      id: String(row.id),
      messageId: key,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      url: row.url,
      metadata: meta ?? null,
    });
    result.set(key, list);
  }
  return result;
}

/**
 * Resolves the applicable messaging privacy policy for a sender → recipient.
 * Checks: does recipient follow the sender? share a space? falls back to msg_privacy_all.
 */
async function resolveMessagingPolicy(
  senderId: string,
  recipientId: string,
  category: 'dm' | 'group_dm',
): Promise<'accept_all' | 'require_approval' | 'dont_allow'> {
  const prefs = await getPreferences(recipientId);

  if (category === 'group_dm') {
    return prefs.msgPrivacyGroupDm;
  }

  // Check if recipient follows the sender
  const followRow = await db('follows')
    .where({ follower_id: recipientId, following_id: senderId, status: 'accepted' })
    .first();

  if (followRow) {
    return prefs.msgPrivacyFollowed;
  }

  // Check shared space
  const sharedSpace = await db('space_members as sm1')
    .join('space_members as sm2', 'sm1.space_id', 'sm2.space_id')
    .where('sm1.user_id', senderId)
    .where('sm2.user_id', recipientId)
    .first();

  if (sharedSpace) {
    return prefs.msgPrivacySpaces;
  }

  return prefs.msgPrivacyAll;
}
