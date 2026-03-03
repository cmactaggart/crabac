import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { resolveVisibleLevels } from './privacy.service.js';
import { areFriends } from '../friends/friends.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { parseGpxFile } from '../messages/gpx.service.js';
import * as collectionsService from './personal-collections.service.js';

// ─── Create Post ───

export async function createPost(
  userId: string,
  data: {
    body?: string | null;
    visibility: string;
    taggedUserIds?: string[];
    existingGalleryItemIds?: string[];
    existingRouteItemIds?: string[];
  },
  files: Express.Multer.File[],
) {
  const postId = snowflake.generate();

  await db('user_posts').insert({
    id: postId,
    user_id: userId,
    body: data.body || null,
    visibility: data.visibility || 'private',
  });

  let position = 0;

  // Process uploaded files
  const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.ogg', '.ogv', '.avi', '.mkv']);

  for (const file of files) {
    const ext = file.originalname.toLowerCase().split('.').pop() || '';
    const isGpx = ext === 'gpx';
    const isVideo = file.mimetype.startsWith('video/') || VIDEO_EXTENSIONS.has(`.${ext}`);
    const attachType = isGpx ? 'gpx' : isVideo ? 'video' : 'image';

    let galleryItemId: string | null = null;
    let routeItemId: string | null = null;

    if (isGpx) {
      // Auto-create personal route item
      const gpxMeta = await parseGpxFile(file.path);
      if (gpxMeta) {
        const route = await collectionsService.createPersonalRouteItem(
          userId,
          {
            name: file.originalname.replace(/\.gpx$/i, ''),
            visibility: data.visibility,
          },
          gpxMeta,
          {
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            url: `/uploads/${file.filename}`,
          },
        );
        routeItemId = route.id;
      }
    } else {
      // Auto-create personal gallery item
      const galleryItem = await collectionsService.createPersonalGalleryItem(userId, {
        visibility: data.visibility,
      });
      await collectionsService.createPersonalGalleryAttachment(galleryItem.id, {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/${file.filename}`,
      }, 0);
      galleryItemId = galleryItem.id;
    }

    const attId = snowflake.generate();
    await db('user_post_attachments').insert({
      id: attId,
      post_id: String(postId),
      type: attachType,
      filename: file.filename,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
      position: position++,
      personal_gallery_item_id: galleryItemId,
      personal_route_item_id: routeItemId,
    });
  }

  // Attach existing gallery items
  if (data.existingGalleryItemIds?.length) {
    for (const itemId of data.existingGalleryItemIds) {
      const item = await db('personal_gallery_items').where('id', itemId).first();
      if (!item || String(item.user_id) !== userId) continue;

      const att = await db('personal_gallery_attachments')
        .where('gallery_item_id', itemId)
        .orderBy('position', 'asc')
        .first();
      if (!att) continue;

      const attId = snowflake.generate();
      await db('user_post_attachments').insert({
        id: attId,
        post_id: String(postId),
        type: att.mime_type.startsWith('video/') ? 'video' : 'image',
        filename: att.filename,
        original_name: att.original_name,
        mime_type: att.mime_type,
        size: att.size,
        url: att.url,
        position: position++,
        personal_gallery_item_id: itemId,
        personal_route_item_id: null,
      });
    }
  }

  // Attach existing route items
  if (data.existingRouteItemIds?.length) {
    for (const itemId of data.existingRouteItemIds) {
      const item = await db('personal_route_items').where('id', itemId).first();
      if (!item || String(item.user_id) !== userId) continue;

      const attId = snowflake.generate();
      await db('user_post_attachments').insert({
        id: attId,
        post_id: String(postId),
        type: 'gpx',
        filename: item.filename,
        original_name: item.original_name,
        mime_type: 'application/gpx+xml',
        size: item.file_size,
        url: item.url,
        position: position++,
        personal_gallery_item_id: null,
        personal_route_item_id: itemId,
      });
    }
  }

  // Process friend tags
  if (data.taggedUserIds?.length) {
    const author = await db('users').where('id', userId).select('username', 'display_name', 'avatar_url').first();
    for (const taggedId of data.taggedUserIds) {
      if (taggedId === userId) continue;
      const isFriend = await areFriends(userId, taggedId);
      if (!isFriend) continue;

      await db('user_post_tags').insert({
        post_id: String(postId),
        tagged_user_id: taggedId,
      });

      await createNotification(taggedId, 'post_tag', {
        postId: String(postId),
        taggedByUsername: author?.username || '',
        taggedByDisplayName: author?.display_name || '',
        taggedByUserId: userId,
        taggedByAvatarUrl: author?.avatar_url || null,
        postPreview: data.body ? data.body.substring(0, 100) : null,
      });
    }
  }

  return getPost(String(postId));
}

// ─── List Posts ───

export async function listPosts(
  userId: string,
  viewerId: string | null,
  options: { before?: string; limit: number },
) {
  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('user_posts as up')
    .join('users', 'up.user_id', 'users.id')
    .where('up.user_id', userId)
    .whereIn('up.visibility', [...visibleLevels])
    .select(
      'up.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('up.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('up.id', '<', options.before);
  }

  const rows = await query;
  const postIds = rows.map((r: any) => String(r.id));

  if (postIds.length === 0) return [];

  // Batch load attachments, tags, reactions, comment counts, reposts in parallel
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

// ─── Get Single Post ───

export async function getPost(postId: string) {
  const row = await db('user_posts as up')
    .join('users', 'up.user_id', 'users.id')
    .where('up.id', postId)
    .select(
      'up.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Post');

  const [attachments, tags, reactions, commentCounts, repostData] = await Promise.all([
    db('user_post_attachments')
      .where('post_id', postId)
      .orderBy('position', 'asc'),
    db('user_post_tags as upt')
      .join('users', 'upt.tagged_user_id', 'users.id')
      .where('upt.post_id', postId)
      .select(
        'upt.post_id',
        'users.id as user_id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
      ),
    getReactionsForPosts([postId]),
    getCommentCountsForPosts([postId]),
    hydrateReposts([row]),
  ]);

  return formatPost(
    row,
    attachments,
    tags,
    reactions.get(postId) || [],
    commentCounts.get(postId) || 0,
    repostData.get(postId) || null,
  );
}

// ─── Update Post ───

export async function updatePost(
  postId: string,
  userId: string,
  data: { body?: string | null; visibility?: string },
) {
  const post = await db('user_posts').where('id', postId).first();
  if (!post) throw new NotFoundError('Post');
  if (String(post.user_id) !== userId) throw new ForbiddenError('You can only edit your own posts');

  const updates: any = { updated_at: db.fn.now(3) };
  if (data.body !== undefined) updates.body = data.body;
  if (data.visibility !== undefined) updates.visibility = data.visibility;

  await db('user_posts').where('id', postId).update(updates);
  return getPost(postId);
}

// ─── Delete Post ───

export async function deletePost(postId: string, userId: string) {
  const post = await db('user_posts').where('id', postId).first();
  if (!post) throw new NotFoundError('Post');
  if (String(post.user_id) !== userId) throw new ForbiddenError('You can only delete your own posts');

  await db('user_posts').where('id', postId).delete();
}

// ─── Post Reactions ───

export async function addPostReaction(postId: string, userId: string, emoji: string) {
  const post = await db('user_posts').where('id', postId).first();
  if (!post) throw new NotFoundError('Post');

  await db('user_post_reactions')
    .insert({ post_id: postId, user_id: userId, emoji })
    .onConflict(['post_id', 'user_id', 'emoji'])
    .ignore();

  return getAggregatedPostReactions(postId);
}

export async function removePostReaction(postId: string, userId: string, emoji: string) {
  await db('user_post_reactions')
    .where({ post_id: postId, user_id: userId, emoji })
    .delete();

  return getAggregatedPostReactions(postId);
}

async function getAggregatedPostReactions(postId: string) {
  const rows = await db('user_post_reactions as r')
    .join('users', 'r.user_id', 'users.id')
    .where('r.post_id', postId)
    .select('r.emoji', 'users.id as user_id', 'users.username');

  return aggregateReactions(rows);
}

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

// ─── Comments ───

export async function createComment(postId: string, userId: string, body: string) {
  const post = await db('user_posts').where('id', postId).first();
  if (!post) throw new NotFoundError('Post');

  const commentId = snowflake.generate();
  await db('user_post_comments').insert({
    id: commentId,
    post_id: postId,
    user_id: userId,
    body,
  });

  // Notify post owner if commenter is someone else
  if (String(post.user_id) !== userId) {
    const [commenter, postOwner] = await Promise.all([
      db('users').where('id', userId).select('username', 'display_name', 'avatar_url').first(),
      db('users').where('id', post.user_id).select('username').first(),
    ]);
    createNotification(String(post.user_id), 'post_comment', {
      postId: String(postId),
      commentId: String(commentId),
      commenterUsername: commenter?.username || '',
      commenterDisplayName: commenter?.display_name || '',
      commenterUserId: userId,
      commenterAvatarUrl: commenter?.avatar_url || null,
      postOwnerUsername: postOwner?.username || '',
      commentPreview: body.substring(0, 100),
    }).catch(() => {});
  }

  return getComment(String(commentId));
}

export async function listComments(
  postId: string,
  options: { before?: string; limit: number },
) {
  let query = db('user_post_comments as c')
    .join('users', 'c.user_id', 'users.id')
    .where('c.post_id', postId)
    .select(
      'c.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('c.id', 'asc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('c.id', '<', options.before);
  }

  const rows = await query;
  if (rows.length === 0) return [];

  const commentIds = rows.map((r: any) => String(r.id));
  const reactions = await getReactionsForComments(commentIds);

  return rows.map((row: any) => formatComment(row, reactions.get(String(row.id)) || []));
}

export async function deleteComment(commentId: string, userId: string) {
  const comment = await db('user_post_comments').where('id', commentId).first();
  if (!comment) throw new NotFoundError('Comment');

  // Allow comment author or post owner
  const post = await db('user_posts').where('id', comment.post_id).first();
  if (String(comment.user_id) !== userId && (!post || String(post.user_id) !== userId)) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await db('user_post_comments').where('id', commentId).delete();
}

async function getComment(commentId: string) {
  const row = await db('user_post_comments as c')
    .join('users', 'c.user_id', 'users.id')
    .where('c.id', commentId)
    .select(
      'c.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Comment');

  const reactions = await getReactionsForComments([String(row.id)]);
  return formatComment(row, reactions.get(String(row.id)) || []);
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

// ─── Comment Reactions ───

export async function addCommentReaction(commentId: string, userId: string, emoji: string) {
  const comment = await db('user_post_comments').where('id', commentId).first();
  if (!comment) throw new NotFoundError('Comment');

  await db('user_post_comment_reactions')
    .insert({ comment_id: commentId, user_id: userId, emoji })
    .onConflict(['comment_id', 'user_id', 'emoji'])
    .ignore();

  return getAggregatedCommentReactions(commentId);
}

export async function removeCommentReaction(commentId: string, userId: string, emoji: string) {
  await db('user_post_comment_reactions')
    .where({ comment_id: commentId, user_id: userId, emoji })
    .delete();

  return getAggregatedCommentReactions(commentId);
}

async function getAggregatedCommentReactions(commentId: string) {
  const rows = await db('user_post_comment_reactions as r')
    .join('users', 'r.user_id', 'users.id')
    .where('r.comment_id', commentId)
    .select('r.emoji', 'users.id as user_id', 'users.username');

  return aggregateReactions(rows);
}

async function getReactionsForComments(commentIds: string[]) {
  if (commentIds.length === 0) return new Map<string, any[]>();

  const rows = await db('user_post_comment_reactions as r')
    .join('users', 'r.user_id', 'users.id')
    .whereIn('r.comment_id', commentIds)
    .select('r.comment_id', 'r.emoji', 'users.id as user_id', 'users.username');

  const byComment = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.comment_id);
    const list = byComment.get(key) || [];
    list.push(row);
    byComment.set(key, list);
  }

  const result = new Map<string, any[]>();
  for (const [cid, reactionRows] of byComment) {
    result.set(cid, aggregateReactions(reactionRows));
  }
  return result;
}

// ─── Repost ───

export async function createRepost(
  userId: string,
  originalPostId: string,
  data: { visibility: string; body?: string | null },
) {
  const original = await db('user_posts').where('id', originalPostId).first();
  if (!original) throw new NotFoundError('Original post');

  // Can't repost own posts
  if (String(original.user_id) === userId) {
    throw new BadRequestError('Cannot repost your own post');
  }

  // Check visibility — viewer must be able to see the original
  const visibleLevels = await resolveVisibleLevels(String(original.user_id), userId);
  if (!visibleLevels.has(original.visibility)) {
    throw new ForbiddenError('Cannot repost a post you cannot see');
  }

  // Prevent double-repost of same original
  const existing = await db('user_posts')
    .where({ user_id: userId, repost_of_id: originalPostId })
    .first();
  if (existing) {
    throw new BadRequestError('You have already reposted this');
  }

  const postId = snowflake.generate();
  await db('user_posts').insert({
    id: postId,
    user_id: userId,
    body: data.body || null,
    visibility: data.visibility || 'private',
    repost_of_id: originalPostId,
  });

  return getPost(String(postId));
}

// ─── Share Post to Channel ───

export async function sharePostToChannel(
  postId: string,
  userId: string,
  channelId: string,
  content?: string,
) {
  const post = await getPost(postId);

  // Build shared post metadata
  const sharedPost = {
    id: post.id,
    body: post.body,
    author: post.author,
    attachments: post.attachments.map((a: any) => ({
      type: a.type,
      url: a.url,
      originalName: a.originalName,
    })),
    createdAt: post.createdAt,
  };

  const { createMessage } = await import('../messages/messages.service.js');
  const message = await createMessage(channelId, userId, {
    content: content || `Shared a post by @${post.author?.username || 'unknown'}`,
    metadata: { sharedPost },
  });

  return message;
}

// ─── Hydrate Reposts ───

async function hydrateReposts(rows: any[]) {
  const repostIds = rows
    .filter((r: any) => r.repost_of_id)
    .map((r: any) => String(r.repost_of_id));

  const result = new Map<string, any>();
  if (repostIds.length === 0) return result;

  const uniqueIds = [...new Set(repostIds)];

  const originals = await db('user_posts as up')
    .join('users', 'up.user_id', 'users.id')
    .whereIn('up.id', uniqueIds)
    .select(
      'up.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    );

  const originalIds = originals.map((o: any) => String(o.id));

  const [attachments, tags] = await Promise.all([
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
  for (const att of attachments) {
    const key = String(att.post_id);
    (attByPost.get(key) || (attByPost.set(key, []), attByPost.get(key)!)).push(att);
  }

  const tagsByPost = new Map<string, any[]>();
  for (const tag of tags) {
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
      [], // skip reactions for repost preview
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

// ─── Helpers ───

function formatPost(
  row: any,
  attachments: any[],
  tags: any[],
  reactions: any[] = [],
  commentCount: number = 0,
  repostOf: any = null,
) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    body: row.body,
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
    author: {
      id: String(row.user_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatComment(row: any, reactions: any[]) {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    userId: String(row.user_id),
    body: row.body,
    reactions,
    author: {
      id: String(row.user_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
