import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { BadRequestError } from '../../lib/errors.js';
import { areFriends } from '../friends/friends.service.js';
import { resolveVisibleLevels } from '../personal-collections/privacy.service.js';
import type { FollowUser, FollowCounts } from '@crabac/shared';

// ─── Follow / Unfollow ───

export async function followUser(followerId: string, targetId: string) {
  if (followerId === targetId) {
    throw new BadRequestError('Cannot follow yourself');
  }

  // If already friends, don't create explicit follow
  const friends = await areFriends(followerId, targetId);
  if (friends) {
    return; // friendship implies follow
  }

  const existing = await db('follows')
    .where({ follower_id: followerId, following_id: targetId })
    .first();

  if (existing) return; // already following

  const id = snowflake.generate();
  await db('follows').insert({
    id,
    follower_id: followerId,
    following_id: targetId,
  });
}

export async function unfollowUser(followerId: string, targetId: string) {
  // Can't unfollow a friend (they'd need to unfriend)
  const friends = await areFriends(followerId, targetId);
  if (friends) {
    throw new BadRequestError('Cannot unfollow a friend. Remove the friendship instead.');
  }

  await db('follows')
    .where({ follower_id: followerId, following_id: targetId })
    .delete();
}

// ─── Status ───

export async function getFollowStatus(followerId: string, targetId: string) {
  const [followRow, isFriend] = await Promise.all([
    db('follows')
      .where({ follower_id: followerId, following_id: targetId })
      .first(),
    areFriends(followerId, targetId),
  ]);

  return {
    isFollowing: !!followRow || isFriend,
    isFriend,
  };
}

// ─── Counts ───

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  // Following: explicit follows + accepted friendships (deduplicated)
  const [explicitFollowing, explicitFollowers, friendCount] = await Promise.all([
    db('follows').where('follower_id', userId).count('* as count').first(),
    db('follows').where('following_id', userId).count('* as count').first(),
    db('friendships')
      .where(function () {
        this.where({ user_id: userId, status: 'accepted' })
          .orWhere({ friend_id: userId, status: 'accepted' });
      })
      .count('* as count')
      .first(),
  ]);

  // Overlap: people who are both explicitly followed AND friends
  const followingOverlap = await db('follows')
    .where('follower_id', userId)
    .whereExists(function () {
      this.select(db.raw(1))
        .from('friendships')
        .where('status', 'accepted')
        .where(function () {
          this.where(function () {
            this.whereRaw('friendships.user_id = follows.following_id')
              .where('friendships.friend_id', userId);
          }).orWhere(function () {
            this.whereRaw('friendships.friend_id = follows.following_id')
              .where('friendships.user_id', userId);
          });
        });
    })
    .count('* as count')
    .first();

  const followerOverlap = await db('follows')
    .where('following_id', userId)
    .whereExists(function () {
      this.select(db.raw(1))
        .from('friendships')
        .where('status', 'accepted')
        .where(function () {
          this.where(function () {
            this.whereRaw('friendships.user_id = follows.follower_id')
              .where('friendships.friend_id', userId);
          }).orWhere(function () {
            this.whereRaw('friendships.friend_id = follows.follower_id')
              .where('friendships.user_id', userId);
          });
        });
    })
    .count('* as count')
    .first();

  const fc = Number(friendCount?.count || 0);

  return {
    followingCount: Number(explicitFollowing?.count || 0) + fc - Number(followingOverlap?.count || 0),
    followerCount: Number(explicitFollowers?.count || 0) + fc - Number(followerOverlap?.count || 0),
  };
}

// ─── Lists ───

export async function getFollowers(userId: string): Promise<FollowUser[]> {
  // Explicit followers
  const explicitFollowers = await db('follows')
    .join('users', 'follows.follower_id', 'users.id')
    .where('follows.following_id', userId)
    .select(
      'users.id',
      'users.username',
      'users.display_name',
      'users.avatar_url',
      'users.base_color',
      'users.accent_color',
    );

  // Friends (accepted)
  const friendRows = await db('friendships')
    .where(function () {
      this.where({ user_id: userId, status: 'accepted' })
        .orWhere({ friend_id: userId, status: 'accepted' });
    });

  const friendUserIds = friendRows.map((r: any) =>
    String(r.user_id) === userId ? String(r.friend_id) : String(r.user_id),
  );

  let friendUsers: any[] = [];
  if (friendUserIds.length > 0) {
    friendUsers = await db('users')
      .whereIn('id', friendUserIds)
      .select('id', 'username', 'display_name', 'avatar_url', 'base_color', 'accent_color');
  }

  // Deduplicate
  const seen = new Set<string>();
  const result: FollowUser[] = [];

  for (const row of [...explicitFollowers, ...friendUsers]) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      baseColor: row.base_color || null,
      accentColor: row.accent_color || null,
    });
  }

  return result;
}

export async function getFollowing(userId: string): Promise<FollowUser[]> {
  // Explicit following
  const explicitFollowing = await db('follows')
    .join('users', 'follows.following_id', 'users.id')
    .where('follows.follower_id', userId)
    .select(
      'users.id',
      'users.username',
      'users.display_name',
      'users.avatar_url',
      'users.base_color',
      'users.accent_color',
    );

  // Friends (accepted)
  const friendRows = await db('friendships')
    .where(function () {
      this.where({ user_id: userId, status: 'accepted' })
        .orWhere({ friend_id: userId, status: 'accepted' });
    });

  const friendUserIds = friendRows.map((r: any) =>
    String(r.user_id) === userId ? String(r.friend_id) : String(r.user_id),
  );

  let friendUsers: any[] = [];
  if (friendUserIds.length > 0) {
    friendUsers = await db('users')
      .whereIn('id', friendUserIds)
      .select('id', 'username', 'display_name', 'avatar_url', 'base_color', 'accent_color');
  }

  // Deduplicate
  const seen = new Set<string>();
  const result: FollowUser[] = [];

  for (const row of [...explicitFollowing, ...friendUsers]) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      baseColor: row.base_color || null,
      accentColor: row.accent_color || null,
    });
  }

  return result;
}

// ─── Feed ───

export async function getFeed(
  userId: string,
  options: { before?: string; limit: number },
) {
  // Get IDs of people to include in feed
  const [explicitFollowRows, friendRows] = await Promise.all([
    db('follows').where('follower_id', userId).select('following_id'),
    db('friendships')
      .where(function () {
        this.where({ user_id: userId, status: 'accepted' })
          .orWhere({ friend_id: userId, status: 'accepted' });
      })
      .select('user_id', 'friend_id'),
  ]);

  const explicitFollowIds = explicitFollowRows.map((r: any) => String(r.following_id));
  const friendIds = friendRows.map((r: any) =>
    String(r.user_id) === userId ? String(r.friend_id) : String(r.user_id),
  );
  const friendIdSet = new Set(friendIds);

  // All user IDs whose posts we want (deduped), plus self
  const allIds = new Set([userId, ...explicitFollowIds, ...friendIds]);
  const allIdsArr = [...allIds];

  // Get spaces with social_enabled where user is a member
  const memberSpaces = await db('space_members')
    .join('space_settings', 'space_members.space_id', 'space_settings.space_id')
    .where('space_members.user_id', userId)
    .where('space_settings.social_enabled', true)
    .select('space_members.space_id');
  const memberSpaceIds = memberSpaces.map((r: any) => String(r.space_id));

  if (allIdsArr.length === 0 && memberSpaceIds.length === 0) return [];

  // Build query with visibility filtering per user relationship
  // Own posts: all visibilities
  // Friends' posts: public + friends
  // Followed (non-friend) posts: public only
  // Space posts: always included (public)
  let query = db('user_posts as up')
    .join('users', 'up.user_id', 'users.id')
    .leftJoin('spaces', 'up.space_id', 'spaces.id')
    .leftJoin('space_settings as ss', 'up.space_id', 'ss.space_id')
    .where(function () {
      // User posts (non-space)
      this.where(function () {
        this.whereNull('up.space_id')
          .where(function () {
            // Own posts: any visibility
            this.where(function () {
              this.where('up.user_id', userId);
            })
              // Friends' posts: public + friends
              .orWhere(function () {
                if (friendIds.length > 0) {
                  this.whereIn('up.user_id', friendIds)
                    .whereIn('up.visibility', ['public', 'friends']);
                } else {
                  this.whereRaw('1=0');
                }
              })
              // Followed non-friends: public only
              .orWhere(function () {
                const followOnlyIds = explicitFollowIds.filter((id) => !friendIdSet.has(id));
                if (followOnlyIds.length > 0) {
                  this.whereIn('up.user_id', followOnlyIds)
                    .where('up.visibility', 'public');
                } else {
                  this.whereRaw('1=0');
                }
              });
          });
      })
        // Space posts from member spaces
        .orWhere(function () {
          if (memberSpaceIds.length > 0) {
            this.whereIn('up.space_id', memberSpaceIds);
          } else {
            this.whereRaw('1=0');
          }
        });
    })
    .select(
      'up.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'spaces.name as space_name',
      'spaces.slug as space_slug',
      'spaces.icon_url as space_icon_url',
      'ss.base_color as space_base_color',
      'ss.accent_color as space_accent_color',
    )
    .orderBy('up.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('up.id', '<', options.before);
  }

  const rows = await query;
  const postIds = rows.map((r: any) => String(r.id));

  if (postIds.length === 0) return [];

  // Batch load attachments, tags, reactions, comment counts, reposts
  const [attachments, tags, reactions, commentCounts, repostData] = await Promise.all([
    db('user_post_attachments')
      .whereIn('post_id', postIds)
      .orderBy('position', 'asc'),
    db('user_post_tags as upt')
      .join('users', 'upt.tagged_user_id', 'users.id')
      .whereIn('upt.post_id', postIds)
      .select(
        'upt.post_id',
        'users.id as user_id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
      ),
    getReactionsForPosts(postIds),
    getCommentCountsForPosts(postIds),
    hydrateReposts(rows),
  ]);

  const attachmentsByPost = new Map<string, any[]>();
  for (const att of attachments) {
    const key = String(att.post_id);
    const list = attachmentsByPost.get(key) || [];
    list.push(att);
    attachmentsByPost.set(key, list);
  }

  const tagsByPost = new Map<string, any[]>();
  for (const tag of tags) {
    const key = String(tag.post_id);
    const list = tagsByPost.get(key) || [];
    list.push(tag);
    tagsByPost.set(key, list);
  }

  return rows.map((row: any) => {
    const pid = String(row.id);
    return formatPost(
      row,
      attachmentsByPost.get(pid) || [],
      tagsByPost.get(pid) || [],
      reactions.get(pid) || [],
      commentCounts.get(pid) || 0,
      repostData.get(pid) || null,
    );
  });
}

// ─── Helpers (copied from user-posts.service.ts to avoid circular deps) ───

async function getReactionsForPosts(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, any[]>();

  const rows = await db('user_post_reactions as r')
    .join('users', 'r.user_id', 'users.id')
    .whereIn('r.post_id', postIds)
    .select('r.post_id', 'r.emoji', 'users.id as user_id', 'users.username');

  const byPost = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.post_id);
    const list = byPost.get(key) || [];
    list.push(row);
    byPost.set(key, list);
  }

  const result = new Map<string, any[]>();
  for (const [pid, reactionRows] of byPost) {
    result.set(pid, aggregateReactions(reactionRows));
  }
  return result;
}

async function getCommentCountsForPosts(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, number>();

  const rows = await db('user_post_comments')
    .whereIn('post_id', postIds)
    .groupBy('post_id')
    .select('post_id', db.raw('count(*) as count'));

  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(String(row.post_id), Number(row.count));
  }
  return result;
}

async function hydrateReposts(rows: any[]) {
  const repostIds = rows
    .filter((r: any) => r.repost_of_id)
    .map((r: any) => String(r.repost_of_id));

  const result = new Map<string, any>();
  if (repostIds.length === 0) return result;

  const uniqueIds = [...new Set(repostIds)];

  const originals = await db('user_posts as up')
    .join('users', 'up.user_id', 'users.id')
    .leftJoin('spaces', 'up.space_id', 'spaces.id')
    .leftJoin('space_settings as ss', 'up.space_id', 'ss.space_id')
    .whereIn('up.id', uniqueIds)
    .select(
      'up.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'spaces.name as space_name',
      'spaces.slug as space_slug',
      'spaces.icon_url as space_icon_url',
      'ss.base_color as space_base_color',
      'ss.accent_color as space_accent_color',
    );

  const originalIds = originals.map((o: any) => String(o.id));

  const [origAttachments, origTags] = await Promise.all([
    originalIds.length > 0
      ? db('user_post_attachments').whereIn('post_id', originalIds).orderBy('position', 'asc')
      : [],
    originalIds.length > 0
      ? db('user_post_tags as upt')
          .join('users', 'upt.tagged_user_id', 'users.id')
          .whereIn('upt.post_id', originalIds)
          .select('upt.post_id', 'users.id as user_id', 'users.username', 'users.display_name', 'users.avatar_url')
      : [],
  ]);

  const attByPost = new Map<string, any[]>();
  for (const att of origAttachments) {
    const key = String(att.post_id);
    (attByPost.get(key) || (attByPost.set(key, []), attByPost.get(key)!)).push(att);
  }

  const tagsByPost = new Map<string, any[]>();
  for (const tag of origTags) {
    const key = String(tag.post_id);
    (tagsByPost.get(key) || (tagsByPost.set(key, []), tagsByPost.get(key)!)).push(tag);
  }

  const originalMap = new Map<string, any>();
  for (const orig of originals) {
    const oid = String(orig.id);
    originalMap.set(oid, formatPost(
      orig,
      attByPost.get(oid) || [],
      tagsByPost.get(oid) || [],
      [],
      0,
      null,
    ));
  }

  for (const row of rows) {
    const pid = String(row.id);
    const repostOfId = row.repost_of_id ? String(row.repost_of_id) : null;
    if (repostOfId) {
      result.set(pid, originalMap.get(repostOfId) || null);
    }
  }

  return result;
}

function formatPost(
  row: any,
  attachments: any[],
  tags: any[],
  reactions: any[] = [],
  commentCount: number = 0,
  repostOf: any = null,
) {
  const isSpacePost = !!row.space_id;

  let metadata = row.metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = null; }
  }

  const post: any = {
    id: String(row.id),
    userId: String(row.user_id),
    spaceId: row.space_id ? String(row.space_id) : null,
    body: row.body,
    metadata: metadata || null,
    visibility: row.visibility,
    attachments: attachments.map(formatPostAttachment),
    tags: tags.map((t: any) => ({
      userId: String(t.user_id),
      username: t.username,
      displayName: t.display_name,
      avatarUrl: t.avatar_url,
    })),
    reactions,
    commentCount,
    repostOfId: row.repost_of_id ? String(row.repost_of_id) : null,
    repostOf,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (isSpacePost && row.space_name) {
    post.author = {
      id: String(row.space_id),
      username: row.space_slug,
      displayName: row.space_name,
      avatarUrl: row.space_icon_url || null,
      baseColor: row.space_base_color || null,
      accentColor: row.space_accent_color || null,
    };
    post.spaceAuthor = {
      id: String(row.space_id),
      name: row.space_name,
      slug: row.space_slug,
      iconUrl: row.space_icon_url || null,
      baseColor: row.space_base_color || null,
      accentColor: row.space_accent_color || null,
    };
  } else {
    post.author = {
      id: String(row.user_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    };
    post.spaceAuthor = null;
  }

  return post;
}

function formatPostAttachment(att: any) {
  return {
    id: String(att.id),
    postId: String(att.post_id),
    type: att.type,
    filename: att.filename,
    originalName: att.original_name,
    mimeType: att.mime_type,
    size: att.size,
    url: att.url,
    position: att.position,
    personalGalleryItemId: att.personal_gallery_item_id ? String(att.personal_gallery_item_id) : null,
    personalRouteItemId: att.personal_route_item_id ? String(att.personal_route_item_id) : null,
  };
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
