import { db } from '../../database/connection.js';
import { snowflake } from '../../modules/_shared.js';
import { NotFoundError } from '../../lib/errors.js';

export async function listAllSpaces() {
  const spaces = await db('spaces')
    .select('spaces.*')
    .select(db.raw('(SELECT COUNT(*) FROM space_members WHERE space_members.space_id = spaces.id) as member_count'))
    .orderBy('spaces.created_at', 'desc');

  return spaces.map((s: any) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    iconUrl: s.icon_url,
    ownerId: s.owner_id,
    memberCount: Number(s.member_count),
    createdAt: s.created_at,
  }));
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
