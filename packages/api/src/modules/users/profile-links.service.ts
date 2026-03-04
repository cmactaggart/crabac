import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';

const MAX_LINKS = 10;

export async function listProfileLinks(userId: string) {
  const rows = await db('user_profile_links')
    .where('user_id', userId)
    .orderBy('position', 'asc');
  return rows.map(formatLink);
}

export async function createProfileLink(userId: string, data: { label: string; url: string }) {
  const count = await db('user_profile_links').where('user_id', userId).count('* as c').first();
  if (Number(count?.c || 0) >= MAX_LINKS) {
    throw new BadRequestError(`Maximum of ${MAX_LINKS} profile links allowed`);
  }

  const maxPos = await db('user_profile_links').where('user_id', userId).max('position as m').first();
  const position = (maxPos?.m ?? -1) + 1;

  const id = snowflake.generate();
  await db('user_profile_links').insert({
    id,
    user_id: userId,
    label: data.label,
    url: data.url,
    position,
  });

  const row = await db('user_profile_links').where('id', id).first();
  return formatLink(row);
}

export async function updateProfileLink(linkId: string, userId: string, data: { label?: string; url?: string }) {
  const link = await db('user_profile_links').where('id', linkId).first();
  if (!link) throw new NotFoundError('Profile link');
  if (String(link.user_id) !== userId) throw new ForbiddenError('Not your profile link');

  const updates: Record<string, any> = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.url !== undefined) updates.url = data.url;

  if (Object.keys(updates).length > 0) {
    await db('user_profile_links').where('id', linkId).update(updates);
  }

  const row = await db('user_profile_links').where('id', linkId).first();
  return formatLink(row);
}

export async function deleteProfileLink(linkId: string, userId: string) {
  const link = await db('user_profile_links').where('id', linkId).first();
  if (!link) throw new NotFoundError('Profile link');
  if (String(link.user_id) !== userId) throw new ForbiddenError('Not your profile link');

  await db('user_profile_links').where('id', linkId).delete();
}

export async function reorderProfileLinks(userId: string, linkIds: string[]) {
  for (let i = 0; i < linkIds.length; i++) {
    await db('user_profile_links')
      .where({ id: linkIds[i], user_id: userId })
      .update({ position: i });
  }
  return listProfileLinks(userId);
}

function formatLink(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    label: row.label,
    url: row.url,
    position: row.position,
    createdAt: row.created_at,
  };
}
