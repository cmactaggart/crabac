import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';

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
  const channels = await db('channels')
    .where({ space_id: spaceId, is_public: true, type: 'forum' })
    .orderBy('position', 'asc');

  return channels.map((ch: any) => ({
    id: ch.id,
    name: ch.name,
    topic: ch.topic,
    type: ch.type,
  }));
}
