import { db } from '../../database/connection.js';
import * as notificationsService from '../notifications/notifications.service.js';

interface ParsedMention {
  type: 'user' | 'everyone' | 'here';
  value: string;
}

export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = /@(everyone|here|[a-zA-Z0-9_-]+)/g;
  let match;
  const seen = new Set<string>();

  while ((match = regex.exec(content)) !== null) {
    const value = match[1];
    if (seen.has(value)) continue;
    seen.add(value);

    if (value === 'everyone') {
      mentions.push({ type: 'everyone', value });
    } else if (value === 'here') {
      mentions.push({ type: 'here', value });
    } else {
      mentions.push({ type: 'user', value });
    }
  }

  return mentions;
}

export async function storeMentions(
  messageId: string,
  mentions: ParsedMention[],
  spaceId: string,
) {
  if (mentions.length === 0) return;

  const hasGroupMention = mentions.some((m) => m.type === 'everyone' || m.type === 'here');

  if (hasGroupMention) {
    // Insert all space members for @everyone/@here
    const members = await db('space_members')
      .where('space_id', spaceId)
      .select('user_id');

    const mentionType = mentions.find((m) => m.type === 'everyone')
      ? 'everyone'
      : 'here';

    const rows = members.map((m: any) => ({
      message_id: messageId,
      user_id: m.user_id,
      mention_type: mentionType,
    }));

    if (rows.length > 0) {
      await db('message_mentions').insert(rows).onConflict(['message_id', 'user_id']).ignore();
    }
  }

  // Individual user mentions
  const userMentions = mentions.filter((m) => m.type === 'user');
  if (userMentions.length > 0) {
    const usernames = userMentions.map((m) => m.value);
    // Resolve usernames to user IDs via space_members join
    const users = await db('users')
      .join('space_members', 'users.id', 'space_members.user_id')
      .where('space_members.space_id', spaceId)
      .whereIn('users.username', usernames)
      .select('users.id as user_id');

    const rows = users.map((u: any) => ({
      message_id: messageId,
      user_id: u.user_id,
      mention_type: 'user',
    }));

    if (rows.length > 0) {
      await db('message_mentions').insert(rows).onConflict(['message_id', 'user_id']).ignore();
    }
  }
}

export async function createMentionNotifications(
  messageId: string,
  channelId: string,
  spaceId: string,
  authorId: string,
  content: string,
) {
  const mentions = parseMentions(content);
  if (mentions.length === 0) return;

  // Get channel and space info for the notification
  const channel = await db('channels').where('id', channelId).select('name').first();
  const space = await db('spaces').where('id', spaceId).select('name').first();
  const author = await db('users').where('id', authorId).select('username').first();
  if (!channel || !space || !author) return;

  // Get mentioned user IDs from message_mentions
  const mentionedUsers = await db('message_mentions')
    .where('message_id', messageId)
    .select('user_id', 'mention_type');

  // Get muted users (users who have muted the author)
  const mutedEntries = await db('user_mutes')
    .where('muted_user_id', authorId)
    .select('user_id');
  const muterIds = new Set(mutedEntries.map((m: any) => String(m.user_id)));

  // Load space member settings for all mentioned users
  const mentionedUserIds = mentionedUsers.map((m: any) => String(m.user_id));
  const spaceSettings = await db('space_member_settings')
    .where('space_id', spaceId)
    .whereIn('user_id', mentionedUserIds)
    .select('user_id', 'suppress_mentions', 'suppress_everyone', 'mute_all');
  const settingsMap = new Map(
    spaceSettings.map((s: any) => [String(s.user_id), s]),
  );

  const preview = content.slice(0, 100);

  for (const mention of mentionedUsers) {
    const targetUserId = String(mention.user_id);
    // Skip self-mentions and muted
    if (targetUserId === authorId) continue;
    if (muterIds.has(targetUserId)) continue;

    // Check space member notification preferences
    const prefs = settingsMap.get(targetUserId);
    if (prefs) {
      if (prefs.mute_all) continue;
      if (prefs.suppress_mentions && mention.mention_type === 'user') continue;
      if (prefs.suppress_everyone && (mention.mention_type === 'everyone' || mention.mention_type === 'here')) continue;
    }

    await notificationsService.createNotification(targetUserId, 'mention', {
      messageId,
      channelId,
      spaceId,
      authorUsername: author.username,
      channelName: channel.name,
      spaceName: space.name,
      messagePreview: preview,
      mentionType: mention.mention_type,
    });
  }
}
