import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';

export async function sendFriendRequest(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new BadRequestError('Cannot send a friend request to yourself');
  }

  // Check if friendship already exists in either direction
  const existing = await db('friendships')
    .where(function () {
      this.where({ user_id: userId, friend_id: targetUserId })
        .orWhere({ user_id: targetUserId, friend_id: userId });
    })
    .first();

  if (existing) {
    if (existing.status === 'accepted') {
      throw new BadRequestError('Already friends');
    }
    // If target already sent us a request, auto-accept both
    if (String(existing.user_id) === targetUserId && existing.status === 'pending') {
      await db('friendships').where('id', existing.id).update({
        status: 'accepted',
        updated_at: db.fn.now(3),
      });
      const friendship = await getFriendship(existing.id);
      eventBus.emit('friend.accepted', {
        friendshipId: String(existing.id),
        accepterId: userId,
        requesterId: targetUserId,
      });
      return friendship;
    }
    // We already sent a request
    throw new BadRequestError('Friend request already sent');
  }

  const id = snowflake.generate();
  await db('friendships').insert({
    id,
    user_id: userId,
    friend_id: targetUserId,
    status: 'pending',
  });

  const friendship = await getFriendship(id);
  eventBus.emit('friend.request_sent', {
    friendshipId: String(id),
    senderId: userId,
    recipientId: targetUserId,
  });
  return friendship;
}

export async function acceptFriendRequest(userId: string, friendshipId: string) {
  const friendship = await db('friendships').where('id', friendshipId).first();
  if (!friendship) throw new NotFoundError('Friend request');
  if (String(friendship.friend_id) !== userId) {
    throw new ForbiddenError('Only the recipient can accept a friend request');
  }
  if (friendship.status !== 'pending') {
    throw new BadRequestError('Request is not pending');
  }

  await db('friendships').where('id', friendshipId).update({
    status: 'accepted',
    updated_at: db.fn.now(3),
  });

  eventBus.emit('friend.accepted', {
    friendshipId: String(friendshipId),
    accepterId: userId,
    requesterId: String(friendship.user_id),
  });

  return getFriendship(friendshipId);
}

export async function declineFriendRequest(userId: string, friendshipId: string) {
  const friendship = await db('friendships').where('id', friendshipId).first();
  if (!friendship) throw new NotFoundError('Friend request');
  if (String(friendship.friend_id) !== userId) {
    throw new ForbiddenError('Only the recipient can decline a friend request');
  }
  if (friendship.status !== 'pending') {
    throw new BadRequestError('Request is not pending');
  }

  await db('friendships').where('id', friendshipId).delete();
}

export async function removeFriend(userId: string, friendshipId: string) {
  const friendship = await db('friendships').where('id', friendshipId).first();
  if (!friendship) throw new NotFoundError('Friendship');

  const isParty = String(friendship.user_id) === userId || String(friendship.friend_id) === userId;
  if (!isParty) throw new ForbiddenError('Not part of this friendship');

  const otherId = String(friendship.user_id) === userId
    ? String(friendship.friend_id)
    : String(friendship.user_id);

  await db('friendships').where('id', friendshipId).delete();

  eventBus.emit('friend.removed', {
    friendshipId: String(friendshipId),
    removerId: userId,
    removedId: otherId,
  });
}

export async function listFriends(userId: string) {
  const rows = await db('friendships')
    .where(function () {
      this.where({ user_id: userId, status: 'accepted' })
        .orWhere({ friend_id: userId, status: 'accepted' });
    });

  return Promise.all(rows.map((row: any) => formatFriendListItem(row, userId)));
}

export async function listPendingRequests(userId: string) {
  const rows = await db('friendships')
    .where({ friend_id: userId, status: 'pending' });

  return Promise.all(rows.map((row: any) => formatFriendListItem(row, userId)));
}

export async function listSentRequests(userId: string) {
  const rows = await db('friendships')
    .where({ user_id: userId, status: 'pending' });

  return Promise.all(rows.map((row: any) => formatFriendListItem(row, userId)));
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const row = await db('friendships')
    .where(function () {
      this.where({ user_id: userId1, friend_id: userId2 })
        .orWhere({ user_id: userId2, friend_id: userId1 });
    })
    .where('status', 'accepted')
    .first();
  return !!row;
}

export async function getFriendshipStatus(userId1: string, userId2: string) {
  const row = await db('friendships')
    .where(function () {
      this.where({ user_id: userId1, friend_id: userId2 })
        .orWhere({ user_id: userId2, friend_id: userId1 });
    })
    .first();

  if (!row) return null;

  return {
    id: String(row.id),
    status: row.status as 'pending' | 'accepted',
    direction: String(row.user_id) === userId1 ? 'sent' as const : 'received' as const,
  };
}

// ─── Helpers ───

async function getFriendship(id: string) {
  const row = await db('friendships').where('id', id).first();
  if (!row) throw new NotFoundError('Friendship');
  return row;
}

async function formatFriendListItem(row: any, currentUserId: string) {
  const otherUserId = String(row.user_id) === currentUserId ? String(row.friend_id) : String(row.user_id);
  const user = await db('users')
    .where('id', otherUserId)
    .select('id', 'username', 'display_name', 'avatar_url', 'base_color', 'accent_color', 'status', 'created_at', 'updated_at')
    .first();

  return {
    id: String(row.id),
    user: user ? {
      id: String(user.id),
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      baseColor: user.base_color || null,
      accentColor: user.accent_color || null,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    } : null,
    status: row.status,
    direction: String(row.user_id) === currentUserId ? 'sent' : 'received',
    createdAt: row.created_at,
  };
}
