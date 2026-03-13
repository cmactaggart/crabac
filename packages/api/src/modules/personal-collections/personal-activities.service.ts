import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { resolveVisibleLevels } from './privacy.service.js';
import { getPreferences } from '../users/preferences.service.js';
import type { GpxMetadata } from '../messages/gpx.service.js';

// ─── List Activities ───

export async function listPersonalActivityItems(
  userId: string,
  viewerId: string | null,
  options: { before?: string; limit: number; visibility?: string; activityType?: string },
) {
  // Check activities visibility preference
  if (viewerId && viewerId !== userId) {
    const prefs = await getPreferences(userId);
    if (prefs.activitiesVisibility === 'private') return [];
  }

  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('personal_activity_items as pai')
    .join('users', 'pai.user_id', 'users.id')
    .where('pai.user_id', userId)
    .whereIn('pai.visibility', [...visibleLevels])
    .select(
      'pai.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('pai.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('pai.id', '<', options.before);
  }

  if (options.visibility && visibleLevels.has(options.visibility as any)) {
    query = query.where('pai.visibility', options.visibility);
  }

  if (options.activityType) {
    query = query.where('pai.activity_type', options.activityType);
  }

  const rows = await query;
  return rows.map((row: any) => formatPersonalActivityItem(row));
}

// ─── Create Activity ───

export async function createPersonalActivityItem(
  userId: string,
  data: {
    name: string;
    description?: string | null;
    activityType: string;
    visibility?: string;
    startedAt?: string | null;
  },
  gpxMeta: GpxMetadata,
  fileData: { filename: string; originalName: string; size: number; url: string },
) {
  let flatness: number | null = null;
  if (gpxMeta.elevationGainM != null && gpxMeta.distanceKm > 0) {
    const gainFt = gpxMeta.elevationGainM * 3.28084;
    const distMi = gpxMeta.distanceKm * 0.621371;
    flatness = Math.round((gainFt / distMi) * 100) / 100;
  }

  const id = snowflake.generate();

  // Create the activity
  await db('personal_activity_items').insert({
    id,
    user_id: userId,
    name: data.name,
    description: data.description || null,
    activity_type: data.activityType,
    visibility: data.visibility || 'private',
    distance_km: gpxMeta.distanceKm,
    duration_sec: gpxMeta.durationSec || null,
    elevation_gain_m: gpxMeta.elevationGainM,
    elevation_loss_m: gpxMeta.elevationLossM,
    flatness,
    geojson: gpxMeta.geojson ? JSON.stringify(gpxMeta.geojson) : null,
    bounds: gpxMeta.bounds ? JSON.stringify(gpxMeta.bounds) : null,
    start_lat: gpxMeta.startLat,
    start_lng: gpxMeta.startLng,
    started_at: data.startedAt || null,
    filename: fileData.filename,
    original_name: fileData.originalName,
    file_size: fileData.size,
    url: fileData.url,
    track_name: gpxMeta.trackName,
  });

  // Auto-create a user_post for the feed
  const postId = snowflake.generate();
  await db('user_posts').insert({
    id: postId,
    user_id: userId,
    body: null,
    visibility: data.visibility || 'private',
    metadata: JSON.stringify({ activityId: String(id), activityType: data.activityType }),
  });

  // Create post attachment linking the GPX file
  const attId = snowflake.generate();
  await db('user_post_attachments').insert({
    id: attId,
    post_id: String(postId),
    type: 'gpx',
    filename: fileData.filename,
    original_name: fileData.originalName,
    mime_type: 'application/gpx+xml',
    size: fileData.size,
    url: fileData.url,
    position: 0,
    personal_activity_item_id: String(id),
  });

  // Link the post back to the activity
  await db('personal_activity_items')
    .where('id', id)
    .update({ user_post_id: String(postId) });

  return { id: String(id), postId: String(postId) };
}

// ─── Get Single Activity ───

export async function getPersonalActivityItem(itemId: string) {
  const row = await db('personal_activity_items as pai')
    .join('users', 'pai.user_id', 'users.id')
    .where('pai.id', itemId)
    .select(
      'pai.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Personal activity item');
  return formatPersonalActivityItem(row);
}

// ─── Update Activity ───

export async function updatePersonalActivityItem(
  itemId: string,
  userId: string,
  data: { name?: string; description?: string | null; visibility?: string },
) {
  const item = await db('personal_activity_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal activity item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only edit your own activities');

  const updates: any = { updated_at: db.fn.now(3) };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.visibility !== undefined) updates.visibility = data.visibility;

  await db('personal_activity_items').where('id', itemId).update(updates);

  // Propagate visibility change to the linked post
  if (data.visibility !== undefined && item.user_post_id) {
    await db('user_posts')
      .where('id', item.user_post_id)
      .where('user_id', userId)
      .update({ visibility: data.visibility, updated_at: db.fn.now(3) });
  }

  return getPersonalActivityItem(itemId);
}

// ─── Delete Activity ───

export async function deletePersonalActivityItem(itemId: string, userId: string) {
  const item = await db('personal_activity_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal activity item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only delete your own activities');

  // Delete the linked post (cascades to attachments)
  if (item.user_post_id) {
    await db('user_posts').where('id', item.user_post_id).where('user_id', userId).delete();
  }

  await db('personal_activity_items').where('id', itemId).delete();
}

// ─── Save Activity as Route ───

export async function saveActivityAsRoute(itemId: string, userId: string) {
  const item = await db('personal_activity_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal activity item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only save your own activities as routes');

  const { createPersonalRouteItem } = await import('./personal-collections.service.js');

  const gpxMeta: GpxMetadata = {
    trackName: item.track_name,
    distanceKm: parseFloat(item.distance_km) || 0,
    elevationGainM: item.elevation_gain_m != null ? parseFloat(item.elevation_gain_m) : null,
    elevationLossM: item.elevation_loss_m != null ? parseFloat(item.elevation_loss_m) : null,
    durationSec: item.duration_sec || 0,
    startLat: item.start_lat != null ? parseFloat(item.start_lat) : null,
    startLng: item.start_lng != null ? parseFloat(item.start_lng) : null,
    bounds: item.bounds ? (typeof item.bounds === 'string' ? JSON.parse(item.bounds) : item.bounds) : null,
    geojson: item.geojson ? (typeof item.geojson === 'string' ? JSON.parse(item.geojson) : item.geojson) : null,
  };

  // Map activity types to route activity types
  const activityTypeMap: Record<string, string> = { run: 'run', bike: 'ride', walk: 'walk', hike: 'walk' };

  const route = await createPersonalRouteItem(
    userId,
    {
      name: item.name,
      description: item.description,
      visibility: item.visibility,
      activityType: activityTypeMap[item.activity_type] || null,
    },
    gpxMeta,
    {
      filename: item.filename,
      originalName: item.original_name,
      size: item.file_size || 0,
      url: item.url,
    },
  );

  return route;
}

// ─── Activity Stats ───

export async function getActivityStats(
  userId: string,
  viewerId: string | null,
  options: { period: string; year?: number },
) {
  // Check activities visibility preference
  if (viewerId && viewerId !== userId) {
    const prefs = await getPreferences(userId);
    if (prefs.activitiesVisibility === 'private') {
      return { period: options.period, stats: [] };
    }
  }

  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('personal_activity_items')
    .where('user_id', userId)
    .whereIn('visibility', [...visibleLevels]);

  // Apply period filter
  const now = new Date();
  const year = options.year || now.getFullYear();

  switch (options.period) {
    case 'ytd':
      query = query.where('created_at', '>=', `${year}-01-01 00:00:00`);
      break;
    case 'year':
      query = query
        .where('created_at', '>=', `${year}-01-01 00:00:00`)
        .where('created_at', '<', `${year + 1}-01-01 00:00:00`);
      break;
    case 'previous_year':
      query = query
        .where('created_at', '>=', `${year - 1}-01-01 00:00:00`)
        .where('created_at', '<', `${year}-01-01 00:00:00`);
      break;
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      query = query.where('created_at', '>=', monthStart.toISOString().slice(0, 19).replace('T', ' '));
      break;
    }
    case 'week': {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      query = query.where('created_at', '>=', weekStart.toISOString().slice(0, 19).replace('T', ' '));
      break;
    }
    case 'all':
      // No date filter
      break;
    default:
      query = query.where('created_at', '>=', `${year}-01-01 00:00:00`);
  }

  const rows = await query
    .select('activity_type')
    .sum('distance_km as total_distance_km')
    .sum('duration_sec as total_duration_sec')
    .sum('elevation_gain_m as total_elevation_gain_m')
    .count('* as activity_count')
    .groupBy('activity_type');

  const stats = rows.map((row: any) => ({
    activityType: row.activity_type,
    totalDistanceKm: parseFloat(row.total_distance_km) || 0,
    totalDurationSec: parseInt(row.total_duration_sec) || 0,
    totalElevationGainM: parseFloat(row.total_elevation_gain_m) || 0,
    activityCount: parseInt(row.activity_count) || 0,
  }));

  return { period: options.period, stats };
}

// ─── Format Helper ───

function formatPersonalActivityItem(row: any) {
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
    userId: String(row.user_id),
    name: row.name,
    description: row.description,
    activityType: row.activity_type,
    visibility: row.visibility,
    distanceKm: row.distance_km != null ? parseFloat(row.distance_km) : null,
    durationSec: row.duration_sec,
    elevationGainM: row.elevation_gain_m != null ? parseFloat(row.elevation_gain_m) : null,
    elevationLossM: row.elevation_loss_m != null ? parseFloat(row.elevation_loss_m) : null,
    flatness: row.flatness != null ? parseFloat(row.flatness) : null,
    geojson,
    bounds,
    startLat: row.start_lat != null ? parseFloat(row.start_lat) : null,
    startLng: row.start_lng != null ? parseFloat(row.start_lng) : null,
    startedAt: row.started_at,
    url: row.url,
    trackName: row.track_name,
    userPostId: row.user_post_id ? String(row.user_post_id) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: String(row.user_id),
      username: row.author_username,
      displayName: row.author_display_name,
      avatarUrl: row.author_avatar_url,
      baseColor: row.author_base_color || null,
      accentColor: row.author_accent_color || null,
    },
  };
}
