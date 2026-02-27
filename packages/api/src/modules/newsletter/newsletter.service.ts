import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';

function newsletterBaseQuery() {
  return db('newsletters')
    .leftJoin('users', 'newsletters.author_id', 'users.id')
    .select(
      'newsletters.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    );
}

export async function listNewsletters(
  spaceId: string,
  userId: string,
  options: { limit: number; before?: string; status?: string },
) {
  let query = newsletterBaseQuery()
    .where('newsletters.space_id', spaceId)
    .limit(options.limit);

  if (options.status) {
    query = query.where('newsletters.status', options.status);
  } else {
    query = query.where(function () {
      this.where('newsletters.status', 'published')
        .orWhere(function () {
          this.where('newsletters.status', 'draft')
            .where('newsletters.author_id', userId);
        });
    });
  }

  if (options.before) {
    query = query.where('newsletters.id', '<', options.before);
  }

  query = query.orderBy('newsletters.id', 'desc');
  const rows = await query;
  return rows.map(formatNewsletter);
}

export async function listPersonalNewsletters(
  authorId: string,
  options: { limit: number; before?: string; status?: string },
) {
  let query = newsletterBaseQuery()
    .whereNull('newsletters.space_id')
    .where('newsletters.author_id', authorId)
    .limit(options.limit);

  if (options.status) {
    query = query.where('newsletters.status', options.status);
  }

  if (options.before) {
    query = query.where('newsletters.id', '<', options.before);
  }

  query = query.orderBy('newsletters.id', 'desc');
  const rows = await query;
  return rows.map(formatNewsletter);
}

export async function getNewsletter(newsletterId: string) {
  const row = await newsletterBaseQuery()
    .where('newsletters.id', newsletterId)
    .first();

  if (!row) throw new NotFoundError('Newsletter');
  return formatNewsletter(row);
}

export async function createNewsletter(
  spaceId: string | null,
  authorId: string,
  data: {
    subject: string;
    summary?: string | null;
    headerImageUrl?: string | null;
    blocks: any[];
    status?: 'draft' | 'published';
    isPublic?: boolean;
  },
) {
  const id = snowflake.generate();
  const status = data.status || 'draft';

  await db('newsletters').insert({
    id,
    space_id: spaceId,
    author_id: authorId,
    subject: data.subject,
    summary: data.summary || null,
    header_image_url: data.headerImageUrl || null,
    blocks: JSON.stringify(data.blocks),
    status,
    is_public: data.isPublic ?? false,
    published_at: status === 'published' ? db.fn.now() : null,
  });

  return getNewsletter(String(id));
}

export async function updateNewsletter(
  newsletterId: string,
  data: {
    subject?: string;
    summary?: string | null;
    headerImageUrl?: string | null;
    blocks?: any[];
    status?: 'draft' | 'published';
    isPublic?: boolean;
  },
) {
  const existing = await db('newsletters').where('id', newsletterId).first();
  if (!existing) throw new NotFoundError('Newsletter');

  const updates: Record<string, any> = {};
  if (data.subject !== undefined) updates.subject = data.subject;
  if (data.summary !== undefined) updates.summary = data.summary;
  if (data.headerImageUrl !== undefined) updates.header_image_url = data.headerImageUrl;
  if (data.blocks !== undefined) updates.blocks = JSON.stringify(data.blocks);
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

  await db('newsletters').where('id', newsletterId).update(updates);
  return getNewsletter(newsletterId);
}

export async function deleteNewsletter(newsletterId: string) {
  const deleted = await db('newsletters').where('id', newsletterId).delete();
  if (!deleted) throw new NotFoundError('Newsletter');
}

// Public newsletter functions
export async function listPublicNewsletters(
  spaceId: string,
  options: { limit: number; before?: string },
) {
  let query = newsletterBaseQuery()
    .where('newsletters.space_id', spaceId)
    .where('newsletters.status', 'published')
    .where('newsletters.is_public', true)
    .orderBy('newsletters.published_at', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('newsletters.id', '<', options.before);
  }

  const rows = await query;
  return rows.map(formatNewsletter);
}

export async function getPublicNewsletter(newsletterId: string) {
  const row = await newsletterBaseQuery()
    .where('newsletters.id', newsletterId)
    .where('newsletters.status', 'published')
    .where('newsletters.is_public', true)
    .first();

  if (!row) throw new NotFoundError('Newsletter');
  return formatNewsletter(row);
}

export async function listPublicPersonalNewsletters(
  authorId: string,
  options: { limit: number; before?: string },
) {
  let query = newsletterBaseQuery()
    .whereNull('newsletters.space_id')
    .where('newsletters.author_id', authorId)
    .where('newsletters.status', 'published')
    .where('newsletters.is_public', true)
    .orderBy('newsletters.published_at', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('newsletters.id', '<', options.before);
  }

  const rows = await query;
  return rows.map(formatNewsletter);
}

export async function getPublicPersonalNewsletter(newsletterId: string) {
  const row = await newsletterBaseQuery()
    .whereNull('newsletters.space_id')
    .where('newsletters.id', newsletterId)
    .where('newsletters.status', 'published')
    .where('newsletters.is_public', true)
    .first();

  if (!row) throw new NotFoundError('Newsletter');
  return formatNewsletter(row);
}

function formatNewsletter(row: any) {
  let blocks: any[] = [];
  try {
    blocks = typeof row.blocks === 'string' ? JSON.parse(row.blocks) : row.blocks;
  } catch { blocks = []; }

  return {
    id: String(row.id),
    spaceId: row.space_id ? String(row.space_id) : null,
    authorId: String(row.author_id),
    subject: row.subject,
    summary: row.summary,
    headerImageUrl: row.header_image_url,
    blocks,
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
