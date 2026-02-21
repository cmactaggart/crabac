import { db } from '../../database/connection.js';
import { BadRequestError } from '../../lib/errors.js';

export async function blockUser(userId: string, blockedUserId: string) {
  if (userId === blockedUserId) throw new BadRequestError('Cannot block yourself');

  await db('user_blocks')
    .insert({ user_id: userId, blocked_user_id: blockedUserId })
    .onConflict(['user_id', 'blocked_user_id'])
    .ignore();

  // Remove from friends if they are friends
  await db('friendships')
    .where(function () {
      this.where({ user_id: userId, friend_id: blockedUserId })
        .orWhere({ user_id: blockedUserId, friend_id: userId });
    })
    .delete();

  // Decline any pending DM requests between the two users
  const sharedConvs = await db('conversation_members as cm1')
    .join('conversation_members as cm2', 'cm1.conversation_id', 'cm2.conversation_id')
    .join('conversations as c', 'c.id', 'cm1.conversation_id')
    .where('cm1.user_id', userId)
    .where('cm2.user_id', blockedUserId)
    .where('c.type', 'dm')
    .select('cm1.conversation_id');

  for (const conv of sharedConvs) {
    await db('conversation_members')
      .where({ conversation_id: conv.conversation_id, status: 'pending' })
      .update({ status: 'declined' });
  }
}

export async function unblockUser(userId: string, blockedUserId: string) {
  await db('user_blocks')
    .where({ user_id: userId, blocked_user_id: blockedUserId })
    .delete();
}

export async function getBlocks(userId: string): Promise<{ blockedByMe: string[]; blockedMe: string[] }> {
  const blockedByMe = await db('user_blocks')
    .where('user_id', userId)
    .select('blocked_user_id');

  const blockedMe = await db('user_blocks')
    .where('blocked_user_id', userId)
    .select('user_id');

  return {
    blockedByMe: blockedByMe.map((r: any) => String(r.blocked_user_id)),
    blockedMe: blockedMe.map((r: any) => String(r.user_id)),
  };
}

export async function isBlocked(userId: string, otherUserId: string): Promise<boolean> {
  const row = await db('user_blocks')
    .where(function () {
      this.where({ user_id: userId, blocked_user_id: otherUserId })
        .orWhere({ user_id: otherUserId, blocked_user_id: userId });
    })
    .first();
  return !!row;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const rows = await db('user_blocks')
    .where(function () {
      this.where('user_id', userId).orWhere('blocked_user_id', userId);
    })
    .select('user_id', 'blocked_user_id');

  const ids = new Set<string>();
  for (const row of rows) {
    if (String(row.user_id) === userId) {
      ids.add(String(row.blocked_user_id));
    } else {
      ids.add(String(row.user_id));
    }
  }
  return Array.from(ids);
}
