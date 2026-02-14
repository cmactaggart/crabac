import { db } from '../../database/connection.js';
import { snowflake } from '../../modules/_shared.js';
import { NotFoundError } from '../../lib/errors.js';

export async function listAllSpaces() {
  const spaces = await db('spaces')
    .select('spaces.*')
    .select(db.raw('(SELECT COUNT(*) FROM space_members WHERE space_members.space_id = spaces.id) as member_count'))
    .leftJoin('space_settings', 'spaces.id', 'space_settings.space_id')
    .select('space_settings.is_public', 'space_settings.is_featured')
    .orderBy('spaces.created_at', 'desc');

  return spaces.map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    iconUrl: s.icon_url,
    ownerId: s.owner_id,
    memberCount: Number(s.member_count),
    isPublic: !!s.is_public,
    isFeatured: !!s.is_featured,
    createdAt: s.created_at,
  }));
}

export async function toggleFeatured(spaceId: string) {
  const settings = await db('space_settings').where('space_id', spaceId).first();
  if (!settings) throw new NotFoundError('Space settings');

  const newValue = !settings.is_featured;
  await db('space_settings').where('space_id', spaceId).update({ is_featured: newValue });

  // Send system message to admin channel
  try {
    const space = await db('spaces').where('id', spaceId).first();
    const adminChannel = await db('channels')
      .where({ space_id: spaceId, is_admin: true })
      .first();

    if (adminChannel && space) {
      const content = newValue
        ? `This space has been **featured** in the public directory.`
        : `This space has been **unfeatured** from the public directory.`;

      await db('messages').insert({
        id: snowflake.generate(),
        channel_id: adminChannel.id,
        author_id: space.owner_id,
        content,
        message_type: 'system',
      });
    }
  } catch {
    // non-critical
  }

  return { spaceId, isFeatured: newValue };
}

export async function listPredefinedTags() {
  const tags = await db('predefined_tags').orderBy('name');
  return tags.map((t: any) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.created_at,
  }));
}

export async function createPredefinedTag(name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const existing = await db('predefined_tags').where('slug', slug).first();
  if (existing) throw new NotFoundError('Tag already exists');

  const id = snowflake.generate();
  await db('predefined_tags').insert({ id, name, slug });
  return { id, name, slug };
}

export async function deletePredefinedTag(id: string) {
  const count = await db('predefined_tags').where('id', id).delete();
  if (count === 0) throw new NotFoundError('Tag');
}

export async function listAllUsers() {
  const users = await db('users')
    .select('id', 'email', 'username', 'display_name', 'status', 'created_at')
    .orderBy('created_at', 'desc');

  return users.map((u: any) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.display_name,
    status: u.status,
    createdAt: u.created_at,
  }));
}

export async function listAnnouncements() {
  const rows = await db('system_announcements').orderBy('created_at', 'desc');
  return rows.map(formatAnnouncement);
}

export async function getActiveAnnouncements() {
  const rows = await db('system_announcements')
    .where('active', true)
    .orderBy('created_at', 'desc');
  return rows.map(formatAnnouncement);
}

export async function createAnnouncement(title: string, content: string) {
  const id = snowflake.generate();
  await db('system_announcements').insert({ id, title, content, active: true });
  const row = await db('system_announcements').where('id', id).first();
  return formatAnnouncement(row);
}

export async function updateAnnouncement(id: string, data: { title?: string; content?: string; active?: boolean }) {
  const updates: Record<string, any> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) updates.content = data.content;
  if (data.active !== undefined) updates.active = data.active;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = db.fn.now(3);
    const count = await db('system_announcements').where('id', id).update(updates);
    if (count === 0) throw new NotFoundError('Announcement');
  }

  const row = await db('system_announcements').where('id', id).first();
  if (!row) throw new NotFoundError('Announcement');
  return formatAnnouncement(row);
}

export async function deleteAnnouncement(id: string) {
  const count = await db('system_announcements').where('id', id).delete();
  if (count === 0) throw new NotFoundError('Announcement');
}

export async function getUnseenAnnouncements(userId: string) {
  const user = await db('users').where('id', userId).select('last_seen_announcement_id').first();
  const lastSeenId = user?.last_seen_announcement_id;

  let query = db('system_announcements').where('active', true);
  if (lastSeenId) {
    query = query.where('id', '>', lastSeenId);
  }

  const rows = await query.orderBy('created_at', 'desc');
  return rows.map(formatAnnouncement);
}

export async function dismissAnnouncements(userId: string, lastSeenId: string) {
  await db('users').where('id', userId).update({ last_seen_announcement_id: lastSeenId });
}

function formatAnnouncement(row: any) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
