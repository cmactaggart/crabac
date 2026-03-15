import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';
import { eventBus } from '../../lib/event-bus.js';
import { createNotification } from '../notifications/notifications.service.js';
import type { RecurrenceRule } from '@crabac/shared';

// ─── Categories ───

export async function listCategories(spaceId: string) {
  const rows = await db('calendar_categories')
    .where('space_id', spaceId)
    .orderBy('created_at', 'asc');
  return rows.map(formatCategory);
}

export async function createCategory(spaceId: string, data: { name: string; color: string }) {
  const id = snowflake.generate();
  await db('calendar_categories').insert({
    id,
    space_id: spaceId,
    name: data.name,
    color: data.color,
  });
  return getCategory(id);
}

export async function updateCategory(id: string, data: { name?: string; color?: string }) {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = data.color;

  if (Object.keys(updates).length > 0) {
    const affected = await db('calendar_categories').where('id', id).update(updates);
    if (!affected) throw new NotFoundError('Calendar category');
  }
  return getCategory(id);
}

export async function deleteCategory(id: string) {
  const deleted = await db('calendar_categories').where('id', id).delete();
  if (!deleted) throw new NotFoundError('Calendar category');
}

async function getCategory(id: string) {
  const row = await db('calendar_categories').where('id', id).first();
  if (!row) throw new NotFoundError('Calendar category');
  return formatCategory(row);
}

function formatCategory(row: any) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

// ─── Events ───

function eventBaseQuery() {
  return db('calendar_events')
    .leftJoin('calendar_categories', 'calendar_events.category_id', 'calendar_categories.id')
    .leftJoin('users', 'calendar_events.creator_id', 'users.id')
    .leftJoin('route_items', 'calendar_events.route_id', 'route_items.id')
    .select(
      'calendar_events.*',
      'calendar_categories.name as cat_name',
      'calendar_categories.color as cat_color',
      'calendar_categories.space_id as cat_space_id',
      'calendar_categories.created_at as cat_created_at',
      'users.username as creator_username',
      'users.display_name as creator_display_name',
      'users.avatar_url as creator_avatar_url',
      'route_items.name as route_name',
      'route_items.distance_km as route_distance_km',
      'route_items.elevation_gain_m as route_elevation_gain_m',
      'route_items.geojson as route_geojson',
      'route_items.url as route_url',
    );
}

export async function listEvents(spaceId: string, from: string, to: string, userId?: string) {
  const rows = await eventBaseQuery()
    .where('calendar_events.space_id', spaceId)
    .where('calendar_events.is_cancelled', false)
    .whereBetween('calendar_events.event_date', [from, to])
    .orderBy('calendar_events.event_date', 'asc')
    .orderBy('calendar_events.event_time', 'asc');

  const eventIds = rows.map((r: any) => r.id);
  const rsvpCountsMap = eventIds.length > 0 ? await getRsvpCountsBatch(eventIds) : new Map();
  const myRsvpMap = eventIds.length > 0 && userId ? await getMyRsvpsBatch(eventIds, userId) : new Map();

  return rows.map((row: any) => formatEvent(row, rsvpCountsMap.get(String(row.id)), myRsvpMap.get(String(row.id))));
}

export async function getEvent(id: string, userId?: string) {
  const row = await eventBaseQuery()
    .where('calendar_events.id', id)
    .first();

  if (!row) throw new NotFoundError('Calendar event');

  const rsvpCounts = await getRsvpCounts(id);
  const myRsvp = userId ? await getMyRsvp(id, userId) : null;
  return formatEvent(row, rsvpCounts, myRsvp);
}

export async function createEvent(
  spaceId: string,
  creatorId: string,
  data: {
    name: string;
    description?: string | null;
    eventDate: string;
    eventTime?: string | null;
    categoryId?: string | null;
    isPublic?: boolean;
    location?: string | null;
    activityType?: string | null;
    routeId?: string | null;
    imageUrl?: string | null;
  },
) {
  const id = snowflake.generate();
  await db('calendar_events').insert({
    id,
    space_id: spaceId,
    creator_id: creatorId,
    category_id: data.categoryId || null,
    name: data.name,
    description: data.description || null,
    event_date: data.eventDate,
    event_time: data.eventTime || null,
    is_public: data.isPublic ?? false,
    location: data.location || null,
    activity_type: data.activityType || null,
    route_id: data.routeId || null,
    image_url: data.imageUrl || null,
  });

  const event = await getEvent(id);
  eventBus.emit('calendar.event.created', { event, spaceId });

  return event;
}

export async function updateEvent(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    eventDate?: string;
    eventTime?: string | null;
    categoryId?: string | null;
    isPublic?: boolean;
    location?: string | null;
    activityType?: string | null;
    routeId?: string | null;
    imageUrl?: string | null;
  },
) {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.eventDate !== undefined) updates.event_date = data.eventDate;
  if (data.eventTime !== undefined) updates.event_time = data.eventTime;
  if (data.categoryId !== undefined) updates.category_id = data.categoryId;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;
  if (data.location !== undefined) updates.location = data.location;
  if (data.activityType !== undefined) updates.activity_type = data.activityType;
  if (data.routeId !== undefined) updates.route_id = data.routeId;
  if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = db.fn.now(3);
    const affected = await db('calendar_events').where('id', id).update(updates);
    if (!affected) throw new NotFoundError('Calendar event');
  }
  return getEvent(id);
}

export async function listPublicEvents(spaceId: string, from: string, to: string) {
  const rows = await eventBaseQuery()
    .where('calendar_events.space_id', spaceId)
    .where('calendar_events.is_public', true)
    .where('calendar_events.is_cancelled', false)
    .whereBetween('calendar_events.event_date', [from, to])
    .orderBy('calendar_events.event_date', 'asc')
    .orderBy('calendar_events.event_time', 'asc');

  const eventIds = rows.map((r: any) => r.id);
  const rsvpCountsMap = eventIds.length > 0 ? await getRsvpCountsBatch(eventIds) : new Map();

  return rows.map((row: any) => formatEvent(row, rsvpCountsMap.get(String(row.id))));
}

export async function listUpcomingEvents(spaceId: string, limit: number, userId?: string) {
  const today = formatDateStr(new Date());
  const rows = await eventBaseQuery()
    .where('calendar_events.space_id', spaceId)
    .where('calendar_events.is_cancelled', false)
    .where('calendar_events.event_date', '>=', today)
    .orderBy('calendar_events.event_date', 'asc')
    .orderBy('calendar_events.event_time', 'asc')
    .limit(limit);

  const eventIds = rows.map((r: any) => r.id);
  const rsvpCountsMap = eventIds.length > 0 ? await getRsvpCountsBatch(eventIds) : new Map();
  const myRsvpMap = eventIds.length > 0 && userId ? await getMyRsvpsBatch(eventIds, userId) : new Map();

  return rows.map((row: any) => formatEvent(row, rsvpCountsMap.get(String(row.id)), myRsvpMap.get(String(row.id))));
}

export async function deleteEvent(id: string) {
  const event = await db('calendar_events').where('id', id).first();
  if (!event) throw new NotFoundError('Calendar event');

  // Notify "going" RSVPs before deletion
  const space = await db('spaces').where('id', event.space_id).first();
  await notifyEventCancellation(
    String(id), event.name, event.event_date, event.event_time,
    String(event.space_id), space?.name || '',
  );

  await db('calendar_events').where('id', id).delete();
}

// ─── RSVP ───

export async function upsertRsvp(eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going') {
  // Verify event exists
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');

  await db.raw(
    `INSERT INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [eventId, userId, status],
  );

  // Notify event creator about the RSVP
  if (String(event.creator_id) !== userId) {
    const space = await db('spaces').where('id', event.space_id).first();
    const rsvpUser = await db('users').where('id', userId).select('username', 'display_name').first();

    // Format date
    let dateStr = event.event_date;
    if (dateStr instanceof Date) dateStr = formatDateStr(dateStr);
    else if (typeof dateStr === 'string' && dateStr.includes('T')) dateStr = dateStr.split('T')[0];

    await createNotification(String(event.creator_id), 'event_rsvp', {
      eventId: String(eventId),
      eventName: event.name,
      eventDate: dateStr,
      eventTime: event.event_time || null,
      spaceId: String(event.space_id),
      spaceName: space?.name || '',
      rsvpUsername: rsvpUser?.username || '',
      rsvpDisplayName: rsvpUser?.display_name || '',
      rsvpStatus: status,
    });
  }
}

export async function removeRsvp(eventId: string, userId: string) {
  await db('event_rsvps')
    .where({ event_id: eventId, user_id: userId })
    .delete();
}

export async function listRsvps(eventId: string) {
  const rows = await db('event_rsvps')
    .join('users', 'event_rsvps.user_id', 'users.id')
    .where('event_rsvps.event_id', eventId)
    .select(
      'event_rsvps.*',
      'users.username',
      'users.display_name',
      'users.avatar_url',
    )
    .orderBy('event_rsvps.created_at', 'asc');

  return rows.map((r: any) => ({
    eventId: String(r.event_id),
    userId: String(r.user_id),
    status: r.status,
    createdAt: r.created_at,
    user: {
      id: String(r.user_id),
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    },
  }));
}

async function getRsvpCounts(eventId: string) {
  const rows = await db('event_rsvps')
    .where('event_id', eventId)
    .groupBy('status')
    .select('status', db.raw('COUNT(*) as count'));

  const counts = { going: 0, maybe: 0, notGoing: 0 };
  for (const r of rows) {
    if (r.status === 'going') counts.going = Number(r.count);
    else if (r.status === 'maybe') counts.maybe = Number(r.count);
    else if (r.status === 'not_going') counts.notGoing = Number(r.count);
  }
  return counts;
}

async function getRsvpCountsBatch(eventIds: string[]) {
  const rows = await db('event_rsvps')
    .whereIn('event_id', eventIds)
    .groupBy('event_id', 'status')
    .select('event_id', 'status', db.raw('COUNT(*) as count'));

  const map = new Map<string, { going: number; maybe: number; notGoing: number }>();
  for (const r of rows) {
    const key = String(r.event_id);
    if (!map.has(key)) map.set(key, { going: 0, maybe: 0, notGoing: 0 });
    const counts = map.get(key)!;
    if (r.status === 'going') counts.going = Number(r.count);
    else if (r.status === 'maybe') counts.maybe = Number(r.count);
    else if (r.status === 'not_going') counts.notGoing = Number(r.count);
  }
  return map;
}

async function getMyRsvp(eventId: string, userId: string): Promise<string | null> {
  const row = await db('event_rsvps')
    .where({ event_id: eventId, user_id: userId })
    .first();
  return row ? row.status : null;
}

async function getMyRsvpsBatch(eventIds: string[], userId: string) {
  const rows = await db('event_rsvps')
    .whereIn('event_id', eventIds)
    .where('user_id', userId)
    .select('event_id', 'status');

  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(String(r.event_id), r.status);
  }
  return map;
}

// ─── Helpers ───

function formatEvent(
  row: any,
  rsvpCounts?: { going: number; maybe: number; notGoing: number },
  myRsvp?: string | null,
) {
  // Format event_date as YYYY-MM-DD string
  let eventDate = row.event_date;
  if (eventDate instanceof Date) {
    eventDate = eventDate.toISOString().split('T')[0];
  } else if (typeof eventDate === 'string' && eventDate.includes('T')) {
    eventDate = eventDate.split('T')[0];
  }

  // Format event_time as HH:mm or null
  let eventTime = row.event_time;
  if (eventTime && typeof eventTime === 'string' && eventTime.length > 5) {
    eventTime = eventTime.substring(0, 5);
  }

  const event: any = {
    id: row.id,
    spaceId: row.space_id,
    categoryId: row.category_id,
    creatorId: row.creator_id,
    name: row.name,
    description: row.description,
    eventDate,
    eventTime: eventTime || null,
    location: row.location || null,
    activityType: row.activity_type || null,
    routeId: row.route_id ? String(row.route_id) : null,
    imageUrl: row.image_url || null,
    isPublic: !!row.is_public,
    seriesId: row.series_id ? String(row.series_id) : null,
    isOverride: !!row.is_override,
    isCancelled: !!row.is_cancelled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (rsvpCounts) {
    event.rsvpCounts = rsvpCounts;
  }
  if (myRsvp !== undefined) {
    event.myRsvp = myRsvp || null;
  }

  if (row.cat_name) {
    event.category = {
      id: row.category_id,
      spaceId: row.cat_space_id,
      name: row.cat_name,
      color: row.cat_color,
      createdAt: row.cat_created_at,
    };
  } else {
    event.category = null;
  }

  if (row.creator_username) {
    event.creator = {
      id: row.creator_id,
      username: row.creator_username,
      displayName: row.creator_display_name,
      avatarUrl: row.creator_avatar_url,
    };
  }

  // Include linked route data if present
  if (row.route_id && row.route_name) {
    let routeGeojson = row.route_geojson;
    if (typeof routeGeojson === 'string') {
      try { routeGeojson = JSON.parse(routeGeojson); } catch { routeGeojson = null; }
    }
    event.route = {
      id: String(row.route_id),
      name: row.route_name,
      distanceKm: row.route_distance_km ? parseFloat(row.route_distance_km) : 0,
      elevationGainM: row.route_elevation_gain_m,
      geojson: routeGeojson,
      url: row.route_url,
    };
  } else {
    event.route = null;
  }

  return event;
}

// ─── Recurring Event Series ───

const DAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function generateOccurrences(rule: RecurrenceRule): string[] {
  const dates: string[] = [];
  const dtstart = new Date(rule.dtstart + 'T00:00:00');
  const until = new Date(rule.until + 'T23:59:59');
  const targetDays = new Set(rule.byDay.map((d) => DAY_MAP[d]));

  if (rule.freq === 'weekly') {
    let weekStart = new Date(dtstart);
    // Align to start of week (Sunday)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    while (weekStart <= until) {
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + d);
        if (day >= dtstart && day <= until && targetDays.has(day.getDay())) {
          dates.push(formatDateStr(day));
        }
      }
      weekStart.setDate(weekStart.getDate() + 7 * rule.interval);
    }
  } else if (rule.freq === 'monthly') {
    const pos = rule.bySetPos || 1;
    const targetDay = DAY_MAP[rule.byDay[0]];

    let current = new Date(dtstart.getFullYear(), dtstart.getMonth(), 1);
    while (current <= until) {
      // Find the Nth occurrence of targetDay in this month
      const year = current.getFullYear();
      const month = current.getMonth();
      let count = 0;
      for (let d = 1; d <= 31; d++) {
        const day = new Date(year, month, d);
        if (day.getMonth() !== month) break;
        if (day.getDay() === targetDay) {
          count++;
          if (count === pos) {
            if (day >= dtstart && day <= until) {
              dates.push(formatDateStr(day));
            }
            break;
          }
        }
      }
      current.setMonth(current.getMonth() + rule.interval);
    }
  }

  return dates;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function createSeries(
  spaceId: string,
  creatorId: string,
  data: {
    name: string;
    description?: string | null;
    eventTime?: string | null;
    categoryId?: string | null;
    isPublic?: boolean;
    location?: string | null;
    activityType?: string | null;
    routeId?: string | null;
    imageUrl?: string | null;
    recurrenceRule: RecurrenceRule;
  },
) {
  const seriesId = snowflake.generate();
  await db('event_series').insert({
    id: seriesId,
    space_id: spaceId,
    creator_id: creatorId,
    category_id: data.categoryId || null,
    name: data.name,
    description: data.description || null,
    location: data.location || null,
    activity_type: data.activityType || null,
    route_id: data.routeId || null,
    image_url: data.imageUrl || null,
    is_public: data.isPublic ?? false,
    recurrence_rule: JSON.stringify(data.recurrenceRule),
    event_time: data.eventTime || null,
  });

  // Generate occurrences
  const dates = generateOccurrences(data.recurrenceRule);
  for (const date of dates) {
    const eventId = snowflake.generate();
    await db('calendar_events').insert({
      id: eventId,
      space_id: spaceId,
      creator_id: creatorId,
      category_id: data.categoryId || null,
      name: data.name,
      description: data.description || null,
      event_date: date,
      event_time: data.eventTime || null,
      is_public: data.isPublic ?? false,
      location: data.location || null,
      activity_type: data.activityType || null,
      route_id: data.routeId || null,
      image_url: data.imageUrl || null,
      series_id: seriesId,
    });
  }

  return getSeries(seriesId);
}

export async function getSeries(id: string) {
  const row = await db('event_series').where('id', id).first();
  if (!row) throw new NotFoundError('Event series');
  return formatSeries(row);
}

export async function listSeries(spaceId: string) {
  const rows = await db('event_series')
    .where('space_id', spaceId)
    .orderBy('created_at', 'desc');
  return rows.map(formatSeries);
}

export async function updateSeries(
  seriesId: string,
  data: {
    name?: string;
    description?: string | null;
    eventTime?: string | null;
    categoryId?: string | null;
    isPublic?: boolean;
    location?: string | null;
    activityType?: string | null;
    routeId?: string | null;
    imageUrl?: string | null;
    recurrenceRule?: RecurrenceRule;
    updateMode?: 'all' | 'future';
  },
) {
  const series = await db('event_series').where('id', seriesId).first();
  if (!series) throw new NotFoundError('Event series');

  // Update series record
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.eventTime !== undefined) updates.event_time = data.eventTime;
  if (data.categoryId !== undefined) updates.category_id = data.categoryId;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;
  if (data.location !== undefined) updates.location = data.location;
  if (data.activityType !== undefined) updates.activity_type = data.activityType;
  if (data.routeId !== undefined) updates.route_id = data.routeId;
  if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
  if (data.recurrenceRule !== undefined) updates.recurrence_rule = JSON.stringify(data.recurrenceRule);
  updates.updated_at = db.fn.now(3);

  if (Object.keys(updates).length > 1) {
    await db('event_series').where('id', seriesId).update(updates);
  }

  // Regenerate non-overridden occurrences
  const today = formatDateStr(new Date());
  let query = db('calendar_events')
    .where('series_id', seriesId)
    .where('is_override', false);

  if (data.updateMode === 'future') {
    query = query.where('event_date', '>=', today);
  }

  await query.delete();

  // Regenerate from rule
  const rule = data.recurrenceRule || JSON.parse(series.recurrence_rule);
  const dates = generateOccurrences(rule);
  const filteredDates = data.updateMode === 'future'
    ? dates.filter((d) => d >= today)
    : dates;

  const updatedSeries = await db('event_series').where('id', seriesId).first();
  for (const date of filteredDates) {
    const eventId = snowflake.generate();
    await db('calendar_events').insert({
      id: eventId,
      space_id: series.space_id,
      creator_id: series.creator_id,
      category_id: updatedSeries.category_id,
      name: updatedSeries.name,
      description: updatedSeries.description,
      event_date: date,
      event_time: updatedSeries.event_time,
      is_public: !!updatedSeries.is_public,
      location: updatedSeries.location,
      activity_type: updatedSeries.activity_type,
      route_id: updatedSeries.route_id,
      image_url: updatedSeries.image_url,
      series_id: seriesId,
    });
  }

  return getSeries(seriesId);
}

export async function deleteSeries(seriesId: string) {
  const series = await db('event_series').where('id', seriesId).first();
  if (!series) throw new NotFoundError('Event series');

  // Notify RSVP'd users for upcoming occurrences before deleting
  const upcomingEvents = await db('calendar_events')
    .where('series_id', seriesId)
    .where('event_date', '>=', formatDateStr(new Date()))
    .where('is_cancelled', false);

  const space = await db('spaces').where('id', series.space_id).first();
  for (const event of upcomingEvents) {
    await notifyEventCancellation(String(event.id), series.name, event.event_date, event.event_time, String(series.space_id), space?.name || '');
  }

  // CASCADE delete handles events
  await db('event_series').where('id', seriesId).delete();
}

export async function overrideOccurrence(
  eventId: string,
  data: {
    name?: string;
    description?: string | null;
    eventDate?: string;
    eventTime?: string | null;
    location?: string | null;
    activityType?: string | null;
    routeId?: string | null;
    imageUrl?: string | null;
  },
) {
  const updates: Record<string, any> = { is_override: true };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.eventDate !== undefined) updates.event_date = data.eventDate;
  if (data.eventTime !== undefined) updates.event_time = data.eventTime;
  if (data.location !== undefined) updates.location = data.location;
  if (data.activityType !== undefined) updates.activity_type = data.activityType;
  if (data.routeId !== undefined) updates.route_id = data.routeId;
  if (data.imageUrl !== undefined) updates.image_url = data.imageUrl;
  updates.updated_at = db.fn.now(3);

  const affected = await db('calendar_events').where('id', eventId).update(updates);
  if (!affected) throw new NotFoundError('Calendar event');
  return getEvent(eventId);
}

export async function cancelOccurrence(eventId: string) {
  const event = await db('calendar_events').where('id', eventId).first();
  if (!event) throw new NotFoundError('Calendar event');

  await db('calendar_events').where('id', eventId).update({
    is_cancelled: true,
    updated_at: db.fn.now(3),
  });

  // Notify RSVP'd users
  const space = await db('spaces').where('id', event.space_id).first();
  await notifyEventCancellation(eventId, event.name, event.event_date, event.event_time, String(event.space_id), space?.name || '');

  return getEvent(eventId);
}

// ─── Cancellation Notifications ───

async function notifyEventCancellation(
  eventId: string,
  eventName: string,
  eventDate: string | Date,
  eventTime: string | null,
  spaceId: string,
  spaceName: string,
) {
  // Format date
  let dateStr = eventDate;
  if (dateStr instanceof Date) dateStr = formatDateStr(dateStr);
  else if (typeof dateStr === 'string' && dateStr.includes('T')) dateStr = dateStr.split('T')[0];

  // Find RSVP'd users (going or maybe)
  const rsvps = await db('event_rsvps')
    .where('event_id', eventId)
    .whereIn('status', ['going', 'maybe']);

  for (const rsvp of rsvps) {
    const notifId = snowflake.generate();
    await db('notifications').insert({
      id: notifId,
      user_id: rsvp.user_id,
      type: 'event_cancelled',
      data: JSON.stringify({
        eventId,
        eventName,
        eventDate: dateStr,
        eventTime: eventTime || null,
        spaceId,
        spaceName,
      }),
    });
  }
}

function formatSeries(row: any) {
  let rule = row.recurrence_rule;
  if (typeof rule === 'string') {
    try { rule = JSON.parse(rule); } catch { rule = {}; }
  }
  return {
    id: String(row.id),
    spaceId: String(row.space_id),
    creatorId: String(row.creator_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    name: row.name,
    description: row.description,
    location: row.location,
    activityType: row.activity_type || null,
    routeId: row.route_id ? String(row.route_id) : null,
    imageUrl: row.image_url || null,
    isPublic: !!row.is_public,
    recurrenceRule: rule,
    eventTime: row.event_time || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
