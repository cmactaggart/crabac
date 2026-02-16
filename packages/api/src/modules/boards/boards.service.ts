import { db } from '../../database/connection.js';
import { NotFoundError } from '../../lib/errors.js';
import * as calendarService from '../calendar/calendar.service.js';

export async function getPublicSpace(slug: string) {
  const space = await db('spaces').where('slug', slug).first();
  if (!space) throw new NotFoundError('Space');

  const settings = await db('space_settings').where('space_id', space.id).first();
  const hasAnyPublic = settings?.allow_public_boards || settings?.allow_public_galleries || settings?.allow_public_routes || settings?.allow_public_blog;
  if (!hasAnyPublic) throw new NotFoundError('Space');

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
  if (settings?.allow_public_routes) allowedTypes.push('route_library');

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

export async function listPublicRouteItems(
  channelId: string,
  options: {
    before?: string;
    limit: number;
    search?: string;
    category?: string;
    author?: string;
    type?: string;
    sort?: string;
    order?: string;
    userId?: string;
  },
) {
  let query = db('route_items as ri')
    .join('users', 'ri.author_id', 'users.id')
    .leftJoin('route_categories as rc', 'ri.category_id', 'rc.id')
    .where('ri.channel_id', channelId)
    .where('ri.is_public', true)
    .select(
      'ri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'rc.name as category_name',
      'rc.space_id as category_space_id',
      'rc.created_at as category_created_at',
    )
    .limit(options.limit);

  if (options.search) {
    query = query.where(function () {
      this.where('ri.name', 'like', `%${options.search}%`)
        .orWhere('ri.description', 'like', `%${options.search}%`)
        .orWhere('users.display_name', 'like', `%${options.search}%`);
    });
  }

  if (options.category) {
    query = query.where('ri.category_id', options.category);
  }

  if (options.author) {
    query = query.where('users.display_name', 'like', `%${options.author}%`);
  }

  if (options.type) {
    query = query.where('ri.activity_type', options.type);
  }

  // Sorting
  const order = options.order === 'asc' ? 'asc' : 'desc';
  switch (options.sort) {
    case 'name':
      query = query.orderBy('ri.name', order);
      break;
    case 'distance':
      query = query.orderBy('ri.distance_km', order);
      break;
    case 'elevation':
      query = query.orderBy('ri.elevation_gain_m', order);
      break;
    case 'flatness':
      query = query.orderBy('ri.flatness', order);
      break;
    case 'newest':
    default:
      query = query.orderBy('ri.id', order);
      break;
  }

  if (options.before) {
    query = query.where('ri.id', '<', options.before);
  }

  const rows = await query;

  // Batch load starred status if user is authenticated
  let starredSet = new Set<string>();
  if (options.userId && rows.length > 0) {
    const routeIds = rows.map((r: any) => r.id);
    const stars = await db('route_stars')
      .where('user_id', options.userId)
      .whereIn('route_id', routeIds);
    starredSet = new Set(stars.map((s: any) => String(s.route_id)));
  }

  return rows.map((row: any) => {
    let bounds = row.bounds;
    if (typeof bounds === 'string') {
      try { bounds = JSON.parse(bounds); } catch { bounds = null; }
    }
    let geojson = row.geojson;
    if (typeof geojson === 'string') {
      try { geojson = JSON.parse(geojson); } catch { geojson = null; }
    }

    return {
      id: String(row.id),
      channelId: String(row.channel_id),
      authorId: String(row.author_id),
      name: row.name,
      description: row.description,
      categoryId: row.category_id ? String(row.category_id) : null,
      isPublic: true,
      filename: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      url: row.url,
      distanceKm: parseFloat(row.distance_km),
      elevationGainM: row.elevation_gain_m,
      elevationLossM: row.elevation_loss_m,
      flatness: row.flatness != null ? parseFloat(row.flatness) : null,
      durationSec: row.duration_sec,
      activityType: row.activity_type || null,
      startLat: row.start_lat != null ? parseFloat(row.start_lat) : null,
      startLng: row.start_lng != null ? parseFloat(row.start_lng) : null,
      bounds,
      geojson,
      trackName: row.track_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: {
        id: String(row.author_id),
        username: row.author_username,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
      },
      category: row.category_name
        ? {
            id: String(row.category_id),
            spaceId: String(row.category_space_id),
            name: row.category_name,
            createdAt: row.category_created_at,
          }
        : null,
      starred: starredSet.has(String(row.id)),
    };
  });
}

export async function listAllPublicRouteItems(
  spaceId: string,
  options: {
    before?: string;
    limit: number;
    search?: string;
    type?: string;
    channelId?: string;
    sort?: string;
    order?: string;
    userId?: string;
  },
) {
  // Find all public route_library channels in this space
  const publicChannels = await db('channels')
    .where({ space_id: spaceId, type: 'route_library', is_public: true })
    .select('id', 'name');

  if (publicChannels.length === 0) return { items: [], channels: publicChannels };

  const channelIds = options.channelId
    ? publicChannels.filter((c: any) => String(c.id) === options.channelId).map((c: any) => c.id)
    : publicChannels.map((c: any) => c.id);

  if (channelIds.length === 0) return { items: [], channels: publicChannels };

  let query = db('route_items as ri')
    .join('users', 'ri.author_id', 'users.id')
    .leftJoin('route_categories as rc', 'ri.category_id', 'rc.id')
    .leftJoin('channels as ch', 'ri.channel_id', 'ch.id')
    .whereIn('ri.channel_id', channelIds)
    .where('ri.is_public', true)
    .select(
      'ri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'rc.name as category_name',
      'rc.space_id as category_space_id',
      'rc.created_at as category_created_at',
      'ch.name as channel_name',
    )
    .limit(options.limit);

  if (options.search) {
    query = query.where(function () {
      this.where('ri.name', 'like', `%${options.search}%`)
        .orWhere('ri.description', 'like', `%${options.search}%`)
        .orWhere('users.display_name', 'like', `%${options.search}%`);
    });
  }

  if (options.type) {
    query = query.where('ri.activity_type', options.type);
  }

  const order = options.order === 'asc' ? 'asc' : 'desc';
  switch (options.sort) {
    case 'name': query = query.orderBy('ri.name', order); break;
    case 'distance': query = query.orderBy('ri.distance_km', order); break;
    case 'elevation': query = query.orderBy('ri.elevation_gain_m', order); break;
    case 'flatness': query = query.orderBy('ri.flatness', order); break;
    case 'newest':
    default: query = query.orderBy('ri.id', order); break;
  }

  if (options.before) {
    query = query.where('ri.id', '<', options.before);
  }

  const rows = await query;

  let starredSet = new Set<string>();
  if (options.userId && rows.length > 0) {
    const routeIds = rows.map((r: any) => r.id);
    const stars = await db('route_stars')
      .where('user_id', options.userId)
      .whereIn('route_id', routeIds);
    starredSet = new Set(stars.map((s: any) => String(s.route_id)));
  }

  const items = rows.map((row: any) => {
    let bounds = row.bounds;
    if (typeof bounds === 'string') {
      try { bounds = JSON.parse(bounds); } catch { bounds = null; }
    }
    let geojson = row.geojson;
    if (typeof geojson === 'string') {
      try { geojson = JSON.parse(geojson); } catch { geojson = null; }
    }

    return {
      id: String(row.id),
      channelId: String(row.channel_id),
      channelName: row.channel_name,
      authorId: String(row.author_id),
      name: row.name,
      description: row.description,
      categoryId: row.category_id ? String(row.category_id) : null,
      isPublic: true,
      filename: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      url: row.url,
      distanceKm: parseFloat(row.distance_km),
      elevationGainM: row.elevation_gain_m,
      elevationLossM: row.elevation_loss_m,
      flatness: row.flatness != null ? parseFloat(row.flatness) : null,
      durationSec: row.duration_sec,
      activityType: row.activity_type || null,
      startLat: row.start_lat != null ? parseFloat(row.start_lat) : null,
      startLng: row.start_lng != null ? parseFloat(row.start_lng) : null,
      bounds,
      geojson,
      trackName: row.track_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: {
        id: String(row.author_id),
        username: row.author_username,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
      },
      category: row.category_name
        ? { id: String(row.category_id), spaceId: String(row.category_space_id), name: row.category_name, createdAt: row.category_created_at }
        : null,
      starred: starredSet.has(String(row.id)),
    };
  });

  return {
    items,
    channels: publicChannels.map((c: any) => ({ id: String(c.id), name: c.name })),
  };
}

export async function listPublicRouteCategories(spaceId: string) {
  const rows = await db('route_categories')
    .where('space_id', spaceId)
    .orderBy('name', 'asc');

  return rows.map((r: any) => ({
    id: String(r.id),
    spaceId: String(r.space_id),
    name: r.name,
    createdAt: r.created_at,
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
