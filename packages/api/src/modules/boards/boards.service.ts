import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';
import * as calendarService from '../calendar/calendar.service.js';

export async function getPublicSpace(slug: string) {
  const space = await db('spaces').where('slug', slug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_boards) throw new NotFoundError('Space');

  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    iconUrl: space.icon_url,
  };
}

export async function listPublicChannels(spaceId: string) {
  const settings = await db('space_settings').where('space_id', spaceId).first();
  const allowedTypes: string[] = [];
  if (settings?.allow_public_boards) allowedTypes.push('forum');
  if (settings?.allow_public_galleries) allowedTypes.push('media_gallery');

  if (allowedTypes.length === 0) return [];

  const channels = await db('channels')
    .where({ space_id: spaceId, is_public: true })
    .whereIn('type', allowedTypes)
    .orderBy('position', 'asc');

  return channels.map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    topic: ch.topic,
    type: ch.type,
  }));
}

export async function listPublicGalleryItems(
  channelId: string,
  options: { before?: string; limit: number },
) {
  let query = db('gallery_items as gi')
    .join('users', 'gi.author_id', 'users.id')
    .where('gi.channel_id', channelId)
    .select(
      'gi.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
    )
    .orderBy('gi.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('gi.id', '<', options.before);
  }

  const rows = await query;
  const itemIds = rows.map((r: any) => r.id);

  const attachments = itemIds.length > 0
    ? await db('gallery_item_attachments')
        .whereIn('gallery_item_id', itemIds)
        .orderBy('position', 'asc')
    : [];

  const attachmentsByItem = new Map<string, any[]>();
  for (const att of attachments) {
    const key = String(att.gallery_item_id);
    const list = attachmentsByItem.get(key) || [];
    list.push(att);
    attachmentsByItem.set(key, list);
  }

  return rows.map((row: any) => ({
    id: String(row.id),
    channelId: String(row.channel_id),
    authorId: String(row.author_id),
    caption: row.caption,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: String(row.author_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
    },
    attachments: (attachmentsByItem.get(String(row.id)) || []).map((att: any) => ({
      id: String(att.id),
      url: att.url,
      originalName: att.original_name,
      mimeType: att.mime_type,
      size: att.size,
      position: att.position,
    })),
  }));
}

export async function getPublicCalendarSpace(slug: string) {
  const space = await db('spaces').where('slug', slug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  if (!settings?.allow_public_calendar) throw new NotFoundError('Space');

  const categories = await calendarService.listCategories(String(space.id));

  return {
    space: {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      iconUrl: space.icon_url,
    },
    categories,
    allowAnonymousBrowsing: !!settings.allow_anonymous_browsing,
  };
}

export async function isSpaceMember(spaceId: string, userId: string): Promise<boolean> {
  const row = await db('space_members')
    .where({ space_id: spaceId, user_id: userId })
    .first();
  return !!row;
}
