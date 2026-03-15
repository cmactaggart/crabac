import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';

function postBaseQuery() {
  return db('blog_posts')
    .leftJoin('users', 'blog_posts.author_id', 'users.id')
    .select(
      'blog_posts.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    );
}

export async function listPosts(
  spaceId: string,
  userId: string,
  options: { limit: number; before?: string; status?: string },
) {
  let query = postBaseQuery()
    .where('blog_posts.space_id', spaceId)
    .limit(options.limit);

  if (options.status) {
    query = query.where('blog_posts.status', options.status);
  } else {
    // Published + author's own drafts
    query = query.where(function () {
      this.where('blog_posts.status', 'published')
        .orWhere(function () {
          this.where('blog_posts.status', 'draft')
            .where('blog_posts.author_id', userId);
        });
    });
  }

  if (options.before) {
    query = query.where('blog_posts.id', '<', options.before);
  }

  query = query.orderBy('blog_posts.id', 'desc');

  const rows = await query;
  return rows.map(formatPost);
}

export async function getPost(postId: string) {
  const row = await postBaseQuery()
    .where('blog_posts.id', postId)
    .first();

  if (!row) throw new NotFoundError('Blog post');
  return formatPost(row);
}

export async function createPost(
  spaceId: string,
  authorId: string,
  data: {
    title: string;
    summary?: string | null;
    content: string;
    status?: 'draft' | 'published';
    isPublic?: boolean;
  },
) {
  const id = snowflake.generate();
  const status = data.status || 'draft';

  await db('blog_posts').insert({
    id,
    space_id: spaceId,
    author_id: authorId,
    title: data.title,
    summary: data.summary || null,
    content: data.content,
    status,
    is_public: data.isPublic ?? false,
    published_at: status === 'published' ? db.fn.now() : null,
  });

  if (status === 'published') {
    eventBus.emit('blog.post.published', {
      post: { id: String(id), authorId: authorId, title: data.title },
      spaceId,
    });
  }

  return getPost(String(id));
}

export async function updatePost(
  postId: string,
  data: {
    title?: string;
    summary?: string | null;
    content?: string;
    status?: 'draft' | 'published';
    isPublic?: boolean;
  },
) {
  const existing = await db('blog_posts').where('id', postId).first();
  if (!existing) throw new NotFoundError('Blog post');

  const updates: Record<string, any> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.summary !== undefined) updates.summary = data.summary;
  if (data.content !== undefined) updates.content = data.content;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;
  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === 'published' && existing.status !== 'published') {
      updates.published_at = db.fn.now();
    } else if (data.status === 'draft') {
      updates.published_at = null;
    }
  }
  updates.updated_at = db.fn.now(3);

  await db('blog_posts').where('id', postId).update(updates);

  // Emit notification when first published
  if (data.status === 'published' && existing.status !== 'published') {
    eventBus.emit('blog.post.published', {
      post: { id: postId, authorId: String(existing.author_id), title: data.title || existing.title },
      spaceId: String(existing.space_id),
    });
  }

  return getPost(postId);
}

export async function deletePost(postId: string) {
  const deleted = await db('blog_posts').where('id', postId).delete();
  if (!deleted) throw new NotFoundError('Blog post');
}

// Public blog functions
export async function listPublicPosts(
  spaceId: string,
  options: { limit: number; before?: string },
) {
  let query = postBaseQuery()
    .where('blog_posts.space_id', spaceId)
    .where('blog_posts.status', 'published')
    .where('blog_posts.is_public', true)
    .orderBy('blog_posts.published_at', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('blog_posts.id', '<', options.before);
  }

  const rows = await query;
  return rows.map(formatPost);
}

export async function getPublicPost(postId: string) {
  const row = await postBaseQuery()
    .where('blog_posts.id', postId)
    .where('blog_posts.status', 'published')
    .where('blog_posts.is_public', true)
    .first();

  if (!row) throw new NotFoundError('Blog post');
  return formatPost(row);
}

function formatPost(row: any) {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    authorId: String(row.author_id),
    title: row.title,
    summary: row.summary,
    content: row.content,
    status: row.status,
    isPublic: !!row.is_public,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author_username ? {
      id: String(row.author_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    } : undefined,
  };
}
