import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import type { GpxMetadata } from '../messages/gpx.service.js';

// ─── Route Categories ───

export async function listRouteCategories(spaceId: string) {
  const rows = await db('route_categories')
    .where('space_id', spaceId)
    .orderBy('name', 'asc');

  return rows.map(formatCategory);
}

export async function createRouteCategory(spaceId: string, name: string) {
  // Check uniqueness
  const existing = await db('route_categories')
    .where({ space_id: spaceId, name })
    .first();
  if (existing) throw new BadRequestError('A category with that name already exists');

  const id = snowflake.generate();
  await db('route_categories').insert({
    id,
    space_id: spaceId,
    name,
  });

  const row = await db('route_categories').where('id', id).first();
  return formatCategory(row);
}

export async function deleteRouteCategory(categoryId: string) {
  const row = await db('route_categories').where('id', categoryId).first();
  if (!row) throw new NotFoundError('Route category');

  await db('route_categories').where('id', categoryId).delete();
  return { spaceId: String(row.space_id) };
}

// ─── Route Items ───

export async function createRouteItem(
  channelId: string,
  authorId: string,
  data: { name: string; description?: string; categoryId?: string; isPublic?: boolean; activityType?: string | null },
  gpxMeta: GpxMetadata,
  fileData: { filename: string; originalName: string; size: number; url: string },
) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'route_library') throw new BadRequestError('Channel is not a route library');

  // Compute flatness: feet of gain per mile of distance
  let flatness: number | null = null;
  if (gpxMeta.elevationGainM != null && gpxMeta.distanceKm > 0) {
    const gainFt = gpxMeta.elevationGainM * 3.28084;
    const distMi = gpxMeta.distanceKm * 0.621371;
    flatness = Math.round((gainFt / distMi) * 100) / 100;
  }

  const id = snowflake.generate();
  await db('route_items').insert({
    id,
    channel_id: channelId,
    author_id: authorId,
    name: data.name,
    description: data.description || null,
    category_id: data.categoryId || null,
    is_public: data.isPublic ?? false,
    filename: fileData.filename,
    original_name: fileData.originalName,
    file_size: fileData.size,
    url: fileData.url,
    distance_km: gpxMeta.distanceKm,
    elevation_gain_m: gpxMeta.elevationGainM,
    elevation_loss_m: gpxMeta.elevationLossM,
    flatness,
    duration_sec: gpxMeta.durationSec || null,
    start_lat: gpxMeta.startLat,
    start_lng: gpxMeta.startLng,
    activity_type: data.activityType || null,
    bounds: gpxMeta.bounds ? JSON.stringify(gpxMeta.bounds) : null,
    geojson: gpxMeta.geojson ? JSON.stringify(gpxMeta.geojson) : null,
    track_name: gpxMeta.trackName,
  });

  return { id: String(id), channelId };
}

export async function listRouteItems(
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
    starred?: boolean;
    userId?: string;
  },
) {
  let query = db('route_items as ri')
    .join('users', 'ri.author_id', 'users.id')
    .leftJoin('route_categories as rc', 'ri.category_id', 'rc.id')
    .where('ri.channel_id', channelId)
    .select(
      'ri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'rc.name as category_name',
      'rc.space_id as category_space_id',
      'rc.created_at as category_created_at',
    )
    .limit(options.limit);

  // Filtering
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

  if (options.starred && options.userId) {
    query = query
      .join('route_stars as rs', function () {
        this.on('rs.route_id', '=', 'ri.id')
          .andOn('rs.user_id', '=', db.raw('?', [options.userId]));
      });
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
      query = query.orderByRaw(`ri.elevation_gain_m ${order === 'asc' ? 'ASC' : 'DESC'} ${order === 'asc' ? 'NULLS FIRST' : ''}`);
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

  // Cursor pagination
  if (options.before) {
    if (options.sort === 'newest' || !options.sort) {
      query = query.where('ri.id', '<', options.before);
    } else {
      // For non-ID sorts, use ID as tiebreaker
      query = query.where('ri.id', '<', options.before);
    }
  }

  const rows = await query;

  // Batch load starred status
  let starredSet = new Set<string>();
  if (options.userId && rows.length > 0) {
    const routeIds = rows.map((r: any) => r.id);
    const stars = await db('route_stars')
      .where('user_id', options.userId)
      .whereIn('route_id', routeIds);
    starredSet = new Set(stars.map((s: any) => String(s.route_id)));
  }

  return rows.map((row: any) => formatRouteItem(row, starredSet.has(String(row.id))));
}

export async function getRouteItem(itemId: string, userId?: string) {
  const row = await db('route_items as ri')
    .join('users', 'ri.author_id', 'users.id')
    .leftJoin('route_categories as rc', 'ri.category_id', 'rc.id')
    .where('ri.id', itemId)
    .select(
      'ri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'rc.name as category_name',
      'rc.space_id as category_space_id',
      'rc.created_at as category_created_at',
    )
    .first();

  if (!row) throw new NotFoundError('Route item');

  let starred = false;
  if (userId) {
    const star = await db('route_stars')
      .where({ user_id: userId, route_id: itemId })
      .first();
    starred = !!star;
  }

  return formatRouteItem(row, starred);
}

export async function deleteRouteItem(itemId: string, userId: string, canManage: boolean) {
  const item = await db('route_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Route item');

  const isAuthor = String(item.author_id) === userId;
  if (!isAuthor && !canManage) {
    throw new ForbiddenError('You can only delete your own routes');
  }

  const channelId = String(item.channel_id);
  await db('route_items').where('id', itemId).delete();

  eventBus.emit('route.item_deleted', { itemId, channelId });
  return { channelId };
}

// ─── Stars ───

export async function starRoute(userId: string, routeId: string) {
  const route = await db('route_items').where('id', routeId).first();
  if (!route) throw new NotFoundError('Route item');

  const existing = await db('route_stars')
    .where({ user_id: userId, route_id: routeId })
    .first();
  if (existing) return; // Already starred

  await db('route_stars').insert({
    user_id: userId,
    route_id: routeId,
  });
}

export async function unstarRoute(userId: string, routeId: string) {
  await db('route_stars')
    .where({ user_id: userId, route_id: routeId })
    .delete();
}

export async function createRouteFromExistingFile(
  channelId: string,
  authorId: string,
  data: { name: string; description?: string; categoryId?: string; isPublic?: boolean; activityType?: string | null },
  attachmentUrl: string,
) {
  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'route_library') throw new BadRequestError('Channel is not a route library');

  // Resolve the file path from the uploads URL
  const filename = attachmentUrl.replace(/^\/uploads\//, '');
  const { config } = await import('../../config.js');
  const filePath = `${config.uploadsDir}/${filename}`;

  const { parseGpxFile } = await import('../messages/gpx.service.js');
  const gpxMeta = await parseGpxFile(filePath);
  if (!gpxMeta) throw new BadRequestError('Failed to parse the GPX file');

  const { stat } = await import('fs/promises');
  const fileStats = await stat(filePath);

  return createRouteItem(channelId, authorId, data, gpxMeta, {
    filename,
    originalName: data.name + '.gpx',
    size: fileStats.size,
    url: attachmentUrl,
  });
}

export async function emitRouteItemCreated(channelId: string, itemId: string) {
  const item = await getRouteItem(itemId);
  eventBus.emit('route.item_created', { item, channelId });
}

// ─── Helpers ───

function formatCategory(row: any) {
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    name: row.name,
    createdAt: row.created_at,
  };
}

function formatRouteItem(row: any, starred: boolean) {
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
    isPublic: !!row.is_public,
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
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
    category: row.category_name
      ? {
          id: String(row.category_id),
          spaceId: String(row.category_space_id),
          name: row.category_name,
          createdAt: row.category_created_at,
        }
      : null,
    starred,
  };
}
