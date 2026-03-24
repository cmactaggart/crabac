import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { resolveVisibleLevels } from './privacy.service.js';
import { createParticipantToken } from '../calls/call.service.js';
import { eventBus } from '../../lib/event-bus.js';
import type { GpxMetadata } from '../messages/gpx.service.js';

// ─── Personal Gallery ───

export async function listPersonalGalleryItems(
  userId: string,
  viewerId: string | null,
  options: { before?: string; limit: number; visibility?: string },
) {
  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('personal_gallery_items as pgi')
    .join('users', 'pgi.user_id', 'users.id')
    .where('pgi.user_id', userId)
    .whereIn('pgi.visibility', [...visibleLevels])
    .select(
      'pgi.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('pgi.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('pgi.id', '<', options.before);
  }

  if (options.visibility && visibleLevels.has(options.visibility as any)) {
    query = query.where('pgi.visibility', options.visibility);
  }

  const rows = await query;
  const itemIds = rows.map((r: any) => r.id);

  // Batch load attachments
  const attachments = itemIds.length > 0
    ? await db('personal_gallery_attachments')
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

  return rows.map((row: any) => formatPersonalGalleryItem(row, attachmentsByItem.get(String(row.id)) || []));
}

export async function createPersonalGalleryItem(
  userId: string,
  data: { caption?: string | null; visibility?: string },
) {
  const id = snowflake.generate();
  await db('personal_gallery_items').insert({
    id,
    user_id: userId,
    caption: data.caption || null,
    visibility: data.visibility || 'private',
  });
  return { id: String(id) };
}

export async function createPersonalGalleryAttachment(
  itemId: string,
  fileData: { filename: string; originalName: string; mimeType: string; size: number; url: string },
  position: number,
) {
  const id = snowflake.generate();
  await db('personal_gallery_attachments').insert({
    id,
    gallery_item_id: itemId,
    filename: fileData.filename,
    original_name: fileData.originalName,
    mime_type: fileData.mimeType,
    size: fileData.size,
    url: fileData.url,
    position,
  });
  return { id: String(id) };
}

export async function getPersonalGalleryItem(itemId: string) {
  const row = await db('personal_gallery_items as pgi')
    .join('users', 'pgi.user_id', 'users.id')
    .where('pgi.id', itemId)
    .select(
      'pgi.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Personal gallery item');

  const attachments = await db('personal_gallery_attachments')
    .where('gallery_item_id', itemId)
    .orderBy('position', 'asc');

  return formatPersonalGalleryItem(row, attachments);
}

export async function updatePersonalGalleryItem(
  itemId: string,
  userId: string,
  data: { caption?: string | null; visibility?: string },
) {
  const item = await db('personal_gallery_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal gallery item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only edit your own items');

  const updates: any = { updated_at: db.fn.now(3) };
  if (data.caption !== undefined) updates.caption = data.caption;
  if (data.visibility !== undefined) updates.visibility = data.visibility;

  await db('personal_gallery_items').where('id', itemId).update(updates);
  return getPersonalGalleryItem(itemId);
}

export async function deletePersonalGalleryItem(itemId: string, userId: string) {
  const item = await db('personal_gallery_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal gallery item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only delete your own items');

  await db('personal_gallery_items').where('id', itemId).delete();
}

// ─── Personal Routes ───

export async function listPersonalRouteItems(
  userId: string,
  viewerId: string | null,
  options: { before?: string; limit: number; visibility?: string },
) {
  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('personal_route_items as pri')
    .join('users', 'pri.user_id', 'users.id')
    .where('pri.user_id', userId)
    .whereIn('pri.visibility', [...visibleLevels])
    .select(
      'pri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .orderBy('pri.id', 'desc')
    .limit(options.limit);

  if (options.before) {
    query = query.where('pri.id', '<', options.before);
  }

  if (options.visibility && visibleLevels.has(options.visibility as any)) {
    query = query.where('pri.visibility', options.visibility);
  }

  const rows = await query;
  return rows.map((row: any) => formatPersonalRouteItem(row));
}

export async function createPersonalRouteItem(
  userId: string,
  data: { name: string; description?: string | null; visibility?: string; activityType?: string | null },
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
  await db('personal_route_items').insert({
    id,
    user_id: userId,
    name: data.name,
    description: data.description || null,
    visibility: data.visibility || 'private',
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

  return { id: String(id) };
}

export async function getPersonalRouteItem(itemId: string) {
  const row = await db('personal_route_items as pri')
    .join('users', 'pri.user_id', 'users.id')
    .where('pri.id', itemId)
    .select(
      'pri.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
    )
    .first();

  if (!row) throw new NotFoundError('Personal route item');
  return formatPersonalRouteItem(row);
}

export async function updatePersonalRouteItem(
  itemId: string,
  userId: string,
  data: { name?: string; description?: string | null; visibility?: string; activityType?: string | null },
) {
  const item = await db('personal_route_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal route item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only edit your own routes');

  const updates: any = { updated_at: db.fn.now(3) };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.activityType !== undefined) updates.activity_type = data.activityType;

  await db('personal_route_items').where('id', itemId).update(updates);
  return getPersonalRouteItem(itemId);
}

export async function deletePersonalRouteItem(itemId: string, userId: string) {
  const item = await db('personal_route_items').where('id', itemId).first();
  if (!item) throw new NotFoundError('Personal route item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only delete your own routes');

  await db('personal_route_items').where('id', itemId).delete();
}

// ─── Personal Event Categories ───

export async function listPersonalEventCategories(userId: string) {
  const rows = await db('personal_event_categories')
    .where('user_id', userId)
    .orderBy('name', 'asc');
  return rows.map((r: any) => ({
    id: String(r.id),
    userId: String(r.user_id),
    name: r.name,
    color: r.color,
    createdAt: r.created_at,
  }));
}

export async function createPersonalEventCategory(
  userId: string,
  data: { name: string; color?: string },
) {
  const id = snowflake.generate();
  await db('personal_event_categories').insert({
    id,
    user_id: userId,
    name: data.name,
    color: data.color || '#5865f2',
  });
  const row = await db('personal_event_categories').where('id', String(id)).first();
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function updatePersonalEventCategory(
  categoryId: string,
  userId: string,
  data: { name?: string; color?: string },
) {
  const item = await db('personal_event_categories').where('id', categoryId).first();
  if (!item) throw new NotFoundError('Category');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only edit your own categories');

  const updates: any = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = data.color;
  if (Object.keys(updates).length > 0) {
    await db('personal_event_categories').where('id', categoryId).update(updates);
  }

  const row = await db('personal_event_categories').where('id', categoryId).first();
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function deletePersonalEventCategory(categoryId: string, userId: string) {
  const item = await db('personal_event_categories').where('id', categoryId).first();
  if (!item) throw new NotFoundError('Category');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only delete your own categories');

  await db('personal_event_categories').where('id', categoryId).delete();
}

// ─── Personal Events ───

export async function listPersonalEvents(
  userId: string,
  viewerId: string | null,
  options: { from?: string; to?: string; limit: number; visibility?: string },
) {
  const visibleLevels = await resolveVisibleLevels(userId, viewerId);

  let query = db('personal_events as pe')
    .join('users', 'pe.user_id', 'users.id')
    .leftJoin('personal_event_categories as pec', 'pe.category_id', 'pec.id')
    .leftJoin('personal_route_items as pri', 'pe.route_id', 'pri.id')
    .where('pe.user_id', userId)
    .whereIn('pe.visibility', [...visibleLevels])
    .select(
      'pe.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'pec.name as category_name',
      'pec.color as category_color',
      'pri.name as route_name',
      'pri.distance_km as route_distance_km',
      'pri.elevation_gain_m as route_elevation_gain_m',
      'pri.url as route_url',
    )
    .orderBy('pe.event_date', 'asc')
    .limit(options.limit);

  if (options.from) {
    query = query.where('pe.event_date', '>=', options.from);
  }
  if (options.to) {
    query = query.where('pe.event_date', '<=', options.to);
  }
  if (options.visibility && visibleLevels.has(options.visibility as any)) {
    query = query.where('pe.visibility', options.visibility);
  }

  const rows = await query;
  return rows.map((row: any) => formatPersonalEvent(row));
}

export async function createPersonalEvent(
  userId: string,
  data: {
    name: string;
    description?: string | null;
    eventDate: string;
    eventTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    visibility?: string;
    activityType?: string | null;
    categoryId?: string | null;
    routeId?: string | null;
    color?: string | null;
    meetingRoomEnabled?: boolean;
    meetingRoomEarlyEntry?: number;
  },
) {
  // Validate route exists if provided
  if (data.routeId) {
    const route = await db('personal_route_items').where('id', data.routeId).first();
    if (!route || String(route.user_id) !== userId) {
      throw new BadRequestError('Route not found or not owned by you');
    }
  }

  // Validate category exists if provided
  if (data.categoryId) {
    const cat = await db('personal_event_categories').where('id', data.categoryId).first();
    if (!cat || String(cat.user_id) !== userId) {
      throw new BadRequestError('Category not found or not owned by you');
    }
  }

  const id = snowflake.generate();
  await db('personal_events').insert({
    id,
    user_id: userId,
    name: data.name,
    description: data.description || null,
    event_date: data.eventDate,
    event_time: data.eventTime || null,
    end_time: data.endTime || null,
    location: data.location || null,
    visibility: data.visibility || 'private',
    activity_type: data.activityType || null,
    category_id: data.categoryId || null,
    route_id: data.routeId || null,
    color: data.color || null,
    meeting_room_enabled: data.meetingRoomEnabled || false,
    meeting_room_early_entry: data.meetingRoomEarlyEntry ?? 0,
  });

  return getPersonalEvent(id);
}

export async function getPersonalEvent(eventId: string | bigint) {
  const row = await db('personal_events as pe')
    .join('users', 'pe.user_id', 'users.id')
    .leftJoin('personal_event_categories as pec', 'pe.category_id', 'pec.id')
    .leftJoin('personal_route_items as pri', 'pe.route_id', 'pri.id')
    .where('pe.id', String(eventId))
    .select(
      'pe.*',
      'users.username as author_username',
      'users.display_name as author_display_name',
      'users.avatar_url as author_avatar_url',
      'users.base_color as author_base_color',
      'users.accent_color as author_accent_color',
      'pec.name as category_name',
      'pec.color as category_color',
      'pri.name as route_name',
      'pri.distance_km as route_distance_km',
      'pri.elevation_gain_m as route_elevation_gain_m',
      'pri.url as route_url',
    )
    .first();

  if (!row) throw new NotFoundError('Personal event');
  return formatPersonalEvent(row);
}

export async function updatePersonalEvent(
  eventId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
    eventDate?: string;
    eventTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    visibility?: string;
    activityType?: string | null;
    categoryId?: string | null;
    routeId?: string | null;
    color?: string | null;
    meetingRoomEnabled?: boolean;
    meetingRoomEarlyEntry?: number;
  },
) {
  const item = await db('personal_events').where('id', eventId).first();
  if (!item) throw new NotFoundError('Personal event');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only edit your own events');

  if (data.routeId) {
    const route = await db('personal_route_items').where('id', data.routeId).first();
    if (!route || String(route.user_id) !== userId) {
      throw new BadRequestError('Route not found or not owned by you');
    }
  }

  if (data.categoryId) {
    const cat = await db('personal_event_categories').where('id', data.categoryId).first();
    if (!cat || String(cat.user_id) !== userId) {
      throw new BadRequestError('Category not found or not owned by you');
    }
  }

  const updates: any = { updated_at: db.fn.now(3) };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.eventDate !== undefined) updates.event_date = data.eventDate;
  if (data.eventTime !== undefined) updates.event_time = data.eventTime;
  if (data.location !== undefined) updates.location = data.location;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.activityType !== undefined) updates.activity_type = data.activityType;
  if (data.categoryId !== undefined) updates.category_id = data.categoryId;
  if (data.routeId !== undefined) updates.route_id = data.routeId;
  if (data.color !== undefined) updates.color = data.color;
  if (data.endTime !== undefined) updates.end_time = data.endTime;
  if (data.meetingRoomEnabled !== undefined) updates.meeting_room_enabled = data.meetingRoomEnabled;
  if (data.meetingRoomEarlyEntry !== undefined) updates.meeting_room_early_entry = data.meetingRoomEarlyEntry;

  await db('personal_events').where('id', eventId).update(updates);
  return getPersonalEvent(eventId);
}

export async function deletePersonalEvent(eventId: string, userId: string) {
  const item = await db('personal_events').where('id', eventId).first();
  if (!item) throw new NotFoundError('Personal event');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only delete your own events');

  await db('personal_events').where('id', eventId).delete();
}

// ─── Copy to Channel/Space ───

export async function copyGalleryToChannel(
  personalItemId: string,
  channelId: string,
  userId: string,
) {
  const item = await db('personal_gallery_items').where('id', personalItemId).first();
  if (!item) throw new NotFoundError('Personal gallery item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only copy your own items');

  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'media_gallery') throw new BadRequestError('Channel is not a media gallery');

  // Create gallery_items row
  const newId = snowflake.generate();
  await db('gallery_items').insert({
    id: newId,
    channel_id: channelId,
    author_id: userId,
    caption: item.caption,
    copied_from_personal_id: personalItemId,
  });

  // Copy attachments (share file URLs)
  const attachments = await db('personal_gallery_attachments')
    .where('gallery_item_id', personalItemId)
    .orderBy('position', 'asc');

  for (const att of attachments) {
    const attId = snowflake.generate();
    await db('gallery_item_attachments').insert({
      id: attId,
      gallery_item_id: String(newId),
      filename: att.filename,
      original_name: att.original_name,
      mime_type: att.mime_type,
      size: att.size,
      url: att.url,
      position: att.position,
    });
  }

  return { id: String(newId), channelId };
}

export async function copyRouteToChannel(
  personalItemId: string,
  channelId: string,
  userId: string,
) {
  const item = await db('personal_route_items').where('id', personalItemId).first();
  if (!item) throw new NotFoundError('Personal route item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only copy your own routes');

  const channel = await db('channels').where('id', channelId).first();
  if (!channel) throw new NotFoundError('Channel');
  if (channel.type !== 'route_library') throw new BadRequestError('Channel is not a route library');

  const newId = snowflake.generate();
  await db('route_items').insert({
    id: newId,
    channel_id: channelId,
    author_id: userId,
    name: item.name,
    description: item.description,
    filename: item.filename,
    original_name: item.original_name,
    file_size: item.file_size,
    url: item.url,
    distance_km: item.distance_km,
    elevation_gain_m: item.elevation_gain_m,
    elevation_loss_m: item.elevation_loss_m,
    flatness: item.flatness,
    duration_sec: item.duration_sec,
    start_lat: item.start_lat,
    start_lng: item.start_lng,
    activity_type: item.activity_type,
    bounds: item.bounds,
    geojson: item.geojson,
    track_name: item.track_name,
    copied_from_personal_id: personalItemId,
  });

  return { id: String(newId), channelId };
}

export async function copyEventToSpace(
  personalEventId: string,
  spaceId: string,
  userId: string,
  channelId?: string,
) {
  const item = await db('personal_events').where('id', personalEventId).first();
  if (!item) throw new NotFoundError('Personal event');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only copy your own events');

  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');

  // Load personal event with category + route data for the embed
  const fullItem = await db('personal_events as pe')
    .leftJoin('personal_event_categories as pec', 'pe.category_id', 'pec.id')
    .leftJoin('personal_route_items as pri', 'pe.route_id', 'pri.id')
    .where('pe.id', personalEventId)
    .select(
      'pe.*',
      'pec.name as category_name',
      'pec.color as category_color',
      'pri.name as route_name',
      'pri.distance_km as route_distance_km',
      'pri.elevation_gain_m as route_elevation_gain_m',
      'pri.geojson as route_geojson',
    )
    .first();

  const newId = snowflake.generate();
  await db('calendar_events').insert({
    id: newId,
    space_id: spaceId,
    creator_id: userId,
    name: item.name,
    description: item.description,
    event_date: item.event_date,
    event_time: item.event_time,
    location: item.location,
    activity_type: item.activity_type,
    copied_from_personal_id: personalEventId,
  });

  // Post a message to the channel with the calendar event embed
  if (channelId) {
    const channel = await db('channels').where('id', channelId).first();
    if (!channel) throw new NotFoundError('Channel');
    if (channel.type !== 'text') throw new BadRequestError('Channel is not a text channel');

    let eventDate = fullItem.event_date;
    if (eventDate instanceof Date) {
      eventDate = eventDate.toISOString().split('T')[0];
    }

    let routeGeojson = fullItem.route_geojson;
    if (typeof routeGeojson === 'string') {
      try { routeGeojson = JSON.parse(routeGeojson); } catch { routeGeojson = null; }
    }

    const embed: Record<string, any> = {
      id: String(newId),
      spaceId,
      name: fullItem.name,
      eventDate,
      eventTime: fullItem.event_time || null,
      description: fullItem.description || null,
      categoryName: fullItem.category_name || null,
      categoryColor: fullItem.category_color || null,
      location: fullItem.location || null,
      activityType: fullItem.activity_type || null,
    };

    if (fullItem.route_name) {
      embed.routeName = fullItem.route_name;
      embed.routeDistanceKm = fullItem.route_distance_km != null ? parseFloat(fullItem.route_distance_km) : null;
      embed.routeElevationGainM = fullItem.route_elevation_gain_m;
      embed.routeGeojson = routeGeojson;
    }

    const embedJson = JSON.stringify(embed);
    const content = `[calendar-event:${embedJson}]`;

    const { createMessage } = await import('../messages/messages.service.js');
    await createMessage(channelId, userId, { content });
  }

  return { id: String(newId), spaceId };
}

// ─── Share Gallery to DM ───

export async function shareGalleryToDM(
  personalItemId: string,
  userId: string,
  conversationId: string,
) {
  const item = await db('personal_gallery_items').where('id', personalItemId).first();
  if (!item) throw new NotFoundError('Personal gallery item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only share your own items');

  const attachments = await db('personal_gallery_attachments')
    .where('gallery_item_id', personalItemId)
    .orderBy('position', 'asc');

  const { sendMessage, createDMAttachment } = await import('../dm/dm.service.js');

  const content = item.caption || 'Shared a gallery item';
  const message = await sendMessage(conversationId, userId, content, { skipEvent: true });

  // Copy attachments to DM
  for (const att of attachments) {
    await createDMAttachment(message.id, {
      filename: att.filename,
      originalName: att.original_name,
      mimeType: att.mime_type,
      size: att.size,
      url: att.url,
    });
  }

  // Re-emit with attachments
  const { emitDMCreated } = await import('../dm/dm.service.js');
  await emitDMCreated(conversationId, message.id);

  return message;
}

// ─── Share Route to DM ───

export async function shareRouteToDM(
  personalItemId: string,
  userId: string,
  conversationId: string,
) {
  const item = await db('personal_route_items').where('id', personalItemId).first();
  if (!item) throw new NotFoundError('Personal route item');
  if (String(item.user_id) !== userId) throw new ForbiddenError('You can only share your own routes');

  const { sendMessage, createDMAttachment } = await import('../dm/dm.service.js');

  const parts = [item.name || 'Shared a route'];
  if (item.distance_km) parts.push(`Distance: ${parseFloat(item.distance_km).toFixed(1)} km`);
  if (item.elevation_gain_m) parts.push(`Elevation: +${item.elevation_gain_m} m`);
  if (item.activity_type) parts.push(`Type: ${item.activity_type}`);

  const message = await sendMessage(conversationId, userId, parts.join('\n'), { skipEvent: true });

  // Attach the GPX file if available
  if (item.filename && item.url) {
    await createDMAttachment(message.id, {
      filename: item.filename,
      originalName: item.original_name || item.filename,
      mimeType: 'application/gpx+xml',
      size: item.file_size || 0,
      url: item.url,
    }, item.geojson ? { gpx: { geojson: typeof item.geojson === 'string' ? JSON.parse(item.geojson) : item.geojson, distanceKm: item.distance_km ? parseFloat(item.distance_km) : null, elevationGainM: item.elevation_gain_m, elevationLossM: item.elevation_loss_m, durationSec: item.duration_sec } } : null);
  }

  const { emitDMCreated } = await import('../dm/dm.service.js');
  await emitDMCreated(conversationId, message.id);

  return message;
}

// ─── Share Event to DM ───

export async function shareEventToDM(
  personalEventId: string,
  userId: string,
  conversationId: string,
) {
  const fullItem = await db('personal_events as pe')
    .leftJoin('personal_event_categories as pec', 'pe.category_id', 'pec.id')
    .leftJoin('personal_route_items as pri', 'pe.route_id', 'pri.id')
    .where('pe.id', personalEventId)
    .select(
      'pe.*',
      'pec.name as category_name',
      'pec.color as category_color',
      'pri.name as route_name',
      'pri.distance_km as route_distance_km',
      'pri.elevation_gain_m as route_elevation_gain_m',
      'pri.geojson as route_geojson',
    )
    .first();

  if (!fullItem) throw new NotFoundError('Personal event');
  if (String(fullItem.user_id) !== userId) throw new ForbiddenError('You can only share your own events');

  const { sendMessage } = await import('../dm/dm.service.js');

  // Build a descriptive message since personal events don't have a spaceId for the embed
  let eventDate = fullItem.event_date;
  if (eventDate instanceof Date) {
    eventDate = eventDate.toISOString().split('T')[0];
  }

  const parts = [`**${fullItem.name}**`];
  const d = new Date(eventDate + 'T00:00:00');
  parts.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }));
  if (fullItem.event_time) parts.push(`at ${fullItem.event_time}`);
  if (fullItem.location) parts.push(`Location: ${fullItem.location}`);
  if (fullItem.category_name) parts.push(`Category: ${fullItem.category_name}`);
  if (fullItem.activity_type) parts.push(`Activity: ${fullItem.activity_type}`);
  if (fullItem.description) parts.push(`\n${fullItem.description.slice(0, 500)}`);

  return sendMessage(conversationId, userId, parts.join('\n'));
}

// ─── Summary ───

export async function getCollectionsSummary(
  userId: string,
  viewerId: string | null,
) {
  const visibleLevels = await resolveVisibleLevels(userId, viewerId);
  const levelArr = [...visibleLevels];

  const [gallery, routes, events, posts, activities] = await Promise.all([
    db('personal_gallery_items')
      .where('user_id', userId)
      .whereIn('visibility', levelArr)
      .count('* as count')
      .first(),
    db('personal_route_items')
      .where('user_id', userId)
      .whereIn('visibility', levelArr)
      .count('* as count')
      .first(),
    db('personal_events')
      .where('user_id', userId)
      .whereIn('visibility', levelArr)
      .count('* as count')
      .first(),
    db('user_posts')
      .where('user_id', userId)
      .whereIn('visibility', levelArr)
      .count('* as count')
      .first(),
    db('personal_activity_items')
      .where('user_id', userId)
      .whereIn('visibility', levelArr)
      .count('* as count')
      .first(),
  ]);

  return {
    galleryCount: Number(gallery?.count || 0),
    routeCount: Number(routes?.count || 0),
    eventCount: Number(events?.count || 0),
    postCount: Number(posts?.count || 0),
    activityCount: Number(activities?.count || 0),
  };
}

// ─── Bulk Visibility Update ───

export async function bulkUpdateVisibility(
  userId: string,
  visibility: string,
) {
  const results = await db.transaction(async (trx) => {
    const [galleryResult, routesResult, eventsResult, postsResult, activitiesResult] = await Promise.all([
      trx('personal_gallery_items')
        .where('user_id', userId)
        .update({ visibility }),
      trx('personal_route_items')
        .where('user_id', userId)
        .update({ visibility }),
      trx('personal_events')
        .where('user_id', userId)
        .update({ visibility }),
      trx('user_posts')
        .where('user_id', userId)
        .update({ visibility }),
      trx('personal_activity_items')
        .where('user_id', userId)
        .update({ visibility }),
    ]);

    return {
      gallery: galleryResult,
      routes: routesResult,
      events: eventsResult,
      posts: postsResult,
      activities: activitiesResult,
    };
  });

  return { updated: results };
}

// ─── Helpers ───

function formatPersonalGalleryItem(row: any, attachments: any[]) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    caption: row.caption,
    visibility: row.visibility,
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
    attachments: attachments.map(formatPersonalGalleryAttachment),
  };
}

function formatPersonalGalleryAttachment(att: any) {
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

function formatPersonalRouteItem(row: any) {
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
    visibility: row.visibility,
    filename: row.filename,
    originalName: row.original_name,
    fileSize: row.file_size,
    url: row.url,
    distanceKm: row.distance_km != null ? parseFloat(row.distance_km) : null,
    elevationGainM: row.elevation_gain_m,
    elevationLossM: row.elevation_loss_m,
    flatness: row.flatness != null ? parseFloat(row.flatness) : null,
    durationSec: row.duration_sec,
    startLat: row.start_lat != null ? parseFloat(row.start_lat) : null,
    startLng: row.start_lng != null ? parseFloat(row.start_lng) : null,
    bounds,
    geojson,
    trackName: row.track_name,
    activityType: row.activity_type || null,
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

function formatPersonalEvent(row: any) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: row.name,
    description: row.description,
    eventDate: row.event_date instanceof Date
      ? row.event_date.toISOString().split('T')[0]
      : String(row.event_date),
    eventTime: row.event_time || null,
    location: row.location,
    visibility: row.visibility,
    activityType: row.activity_type || null,
    categoryId: row.category_id ? String(row.category_id) : null,
    category: row.category_name ? {
      id: String(row.category_id),
      userId: String(row.user_id),
      name: row.category_name,
      color: row.category_color,
    } : null,
    routeId: row.route_id ? String(row.route_id) : null,
    route: row.route_name ? {
      id: String(row.route_id),
      name: row.route_name,
      distanceKm: row.route_distance_km,
      elevationGainM: row.route_elevation_gain_m,
      url: row.route_url,
    } : null,
    color: row.color,
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

// ─── Personal Event Meeting Rooms ───

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function joinPersonalEventRoom(eventId: string, userId: string, clientDate?: string) {
  const event = await db('personal_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Personal event');
  if (!event.meeting_room_enabled) throw new BadRequestError('Meeting room not enabled for this event');

  if (String(event.user_id) !== userId) throw new ForbiddenError('Not the owner of this event');

  const today = clientDate || formatDateStr(new Date());
  let eventDate = event.event_date;
  if (eventDate instanceof Date) eventDate = formatDateStr(eventDate);
  else if (typeof eventDate === 'string' && eventDate.includes('T')) eventDate = eventDate.split('T')[0];

  if (eventDate !== today) throw new BadRequestError('Meeting room is only available on the event day');
  if (!event.event_time || !event.end_time) throw new BadRequestError('Event must have start and end times for meeting room');

  let meetingRoom = await db('event_meeting_rooms').where('personal_event_id', eventId).first();

  if (!meetingRoom) {
    await db('event_meeting_rooms').insert({
      event_id: null,
      personal_event_id: eventId,
      status: 'open',
    });
    meetingRoom = await db('event_meeting_rooms').where('personal_event_id', eventId).first();
  }

  let callId: string;
  let roomName: string;

  if (!meetingRoom.call_id) {
    const newCallId = snowflake.generate();
    callId = String(newCallId);
    roomName = `personal_event_${eventId}_${newCallId}`;

    await db('calls').insert({
      id: newCallId,
      type: 'voice_channel',
      channel_id: null,
      space_id: null,
      room_name: roomName,
      initiated_by: userId,
      status: 'active',
      started_at: db.fn.now(3),
    });

    await db('call_participants').insert({
      call_id: callId,
      user_id: userId,
      status: 'joined',
      joined_at: db.fn.now(3),
    });

    await db('event_meeting_rooms')
      .where('personal_event_id', eventId)
      .update({ call_id: callId });
  } else {
    callId = String(meetingRoom.call_id);
    const call = await db('calls').where('id', callId).first();
    if (!call) throw new NotFoundError('Call');
    roomName = call.room_name;

    const existingParticipant = await db('call_participants')
      .where({ call_id: callId, user_id: userId })
      .first();

    if (existingParticipant) {
      await db('call_participants')
        .where({ call_id: callId, user_id: userId })
        .update({ status: 'joined', joined_at: db.fn.now(3), left_at: null });
    } else {
      await db('call_participants').insert({
        call_id: callId,
        user_id: userId,
        status: 'joined',
        joined_at: db.fn.now(3),
      });
    }
  }

  const user = await db('users').where('id', userId).select('username').first();
  const token = await createParticipantToken(roomName, userId, user?.username || 'Unknown');

  const countResult = await db('call_participants')
    .where({ call_id: callId, status: 'joined' })
    .count('* as count')
    .first();
  const participantCount = Number(countResult?.count || 0);

  const updatedRoom = await db('event_meeting_rooms').where('personal_event_id', eventId).first();

  return {
    call: {
      id: callId,
      roomName,
    },
    token,
    meetingRoom: {
      id: String(updatedRoom.id),
      personalEventId: String(eventId),
      status: updatedRoom.status,
      callId,
      participantCount,
    },
  };
}

export async function leavePersonalEventRoom(eventId: string, userId: string) {
  const meetingRoom = await db('event_meeting_rooms').where('personal_event_id', eventId).first();
  if (!meetingRoom) throw new NotFoundError('Meeting room');

  const callId = meetingRoom.call_id ? String(meetingRoom.call_id) : null;

  if (callId) {
    await db('call_participants')
      .where({ call_id: callId, user_id: userId })
      .update({ status: 'left', left_at: db.fn.now(3) });

    const remaining = await db('call_participants')
      .where({ call_id: callId, status: 'joined' })
      .count('* as count')
      .first();

    if (Number(remaining?.count || 0) === 0) {
      await db('calls')
        .where('id', callId)
        .update({ status: 'ended', ended_at: db.fn.now(3) });

      const call = await db('calls').where('id', callId).first();
      if (call) {
        const { RoomServiceClient } = await import('livekit-server-sdk');
        const { config } = await import('../../config.js');
        const rs = new RoomServiceClient(config.livekit.host, config.livekit.apiKey, config.livekit.apiSecret);
        rs.deleteRoom(call.room_name).catch(() => {});
      }

      await db('event_meeting_rooms')
        .where('personal_event_id', eventId)
        .update({ status: 'closed' });
    }
  }
}
