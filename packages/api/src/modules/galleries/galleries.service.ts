import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';

export async function listGalleryItems(
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
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('gi.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('gi.id', '<', options.before);
  }

  const rows = await query;
  const itemIds = rows.map((r: any) => r.id);

  // Batch load attachments
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

  return rows.map((row: any) => formatGalleryItem(row, attachmentsByItem.get(String(row.id)) || []));
}

export async function createGalleryItem(
  channelId: string,
  authorId: string,
  caption: string | null,
) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'media_gallery') throw new BadRequestError('Channel is not a media gallery');

  const id = snowflake.generate();
  await db('gallery_items').insert({
    id,
    channel_id: channelId,
    author_id: authorId,
    caption: caption || null,
  });

  return { id: String(id), channelId, authorId };
}

export async function createGalleryAttachment(
  galleryItemId: string,
  fileData: { filename: string; originalName: string; mimeType: string; size: number; url: string },
  position: number,
) {
  const id = snowflake.generate();
  await db('gallery_item_attachments').insert({
    id,
    gallery_item_id: galleryItemId,
    filename: fileData.filename,
    original_name: fileData.originalName,
    mime_type: fileData.mimeType,
    size: fileData.size,
    url: fileData.url,
    position,
  });
  return { id: String(id) };
}

export async function getGalleryItem(itemId: string) {
  const row = await db('gallery_items as gi')
    .join('users', 'gi.author_id', 'users.id')
    .where('gi.id', itemId)
    .select(
      'gi.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Gallery item');

  const attachments = await db('gallery_item_attachments')
    .where('gallery_item_id', itemId)
    .orderBy('position', 'asc');

  return formatGalleryItem(row, attachments);
}

export async function deleteGalleryItem(itemId: string, userId: string, canManage: boolean) {
  const item = await db('gallery_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Gallery item');

  const isAuthor = String(item.author_id) === userId;
  if (!isAuthor && !canManage) {
    throw new ForbiddenError('You can only delete your own gallery items');
  }

  const channelId = String(item.channel_id);
  await db('gallery_items').where('id', itemId).delete();

  eventBus.emit('gallery.item_deleted', { itemId, channelId });
  return { channelId };
}

export async function emitGalleryItemCreated(channelId: string, itemId: string) {
  const item = await getGalleryItem(itemId);
  eventBus.emit('gallery.item_created', { item, channelId });
}

// ─── Helpers ───

function formatGalleryItem(row: any, attachments: any[]) {
  return {
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
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
    attachments: attachments.map(formatAttachment),
  };
}

function formatAttachment(att: any) {
  return {
    id: String(att.id),
    galleryItemId: String(att.gallery_item_id),
    url: att.url,
    filename: att.filename,
    originalName: att.original_name,
    mimeType: att.mime_type,
    size: att.size,
    position: att.position,
  };
}
