import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';

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

export async function listEvents(spaceId: string, from: string, to: string) {
  const rows = await db('calendar_events')
    .leftJoin('calendar_categories', 'calendar_events.category_id', 'calendar_categories.id')
    .leftJoin('users', 'calendar_events.creator_id', 'users.id')
    .where('calendar_events.space_id', spaceId)
    .whereBetween('calendar_events.event_date', [from, to])
    .select(
      'calendar_events.*',
      'calendar_categories.name as cat_name',
      'calendar_categories.color as cat_color',
      'calendar_categories.space_id as cat_space_id',
      'calendar_categories.created_at as cat_created_at',
      'users.username as creator_username',
      'users.display_name as creator_display_name',
      'users.avatar_url as creator_avatar_url',
    )
    .orderBy('calendar_events.event_date', 'asc')
    .orderBy('calendar_events.event_time', 'asc');

  return rows.map(formatEvent);
}

export async function getEvent(id: string) {
  const row = await db('calendar_events')
    .leftJoin('calendar_categories', 'calendar_events.category_id', 'calendar_categories.id')
    .leftJoin('users', 'calendar_events.creator_id', 'users.id')
    .where('calendar_events.id', id)
    .select(
      'calendar_events.*',
      'calendar_categories.name as cat_name',
      'calendar_categories.color as cat_color',
      'calendar_categories.space_id as cat_space_id',
      'calendar_categories.created_at as cat_created_at',
      'users.username as creator_username',
      'users.display_name as creator_display_name',
      'users.avatar_url as creator_avatar_url',
    )
    .first();

  if (!row) throw new NotFoundError('Calendar event');
  return formatEvent(row);
}

export async function createEvent(
  spaceId: string,
  creatorId: string,
  data: { name: string; description?: string | null; eventDate: string; eventTime?: string | null; categoryId?: string | null },
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
  });
  return getEvent(id);
}

export async function updateEvent(
  id: string,
  data: { name?: string; description?: string | null; eventDate?: string; eventTime?: string | null; categoryId?: string | null },
) {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.eventDate !== undefined) updates.event_date = data.eventDate;
  if (data.eventTime !== undefined) updates.event_time = data.eventTime;
  if (data.categoryId !== undefined) updates.category_id = data.categoryId;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = db.fn.now(3);
    const affected = await db('calendar_events').where('id', id).update(updates);
    if (!affected) throw new NotFoundError('Calendar event');
  }
  return getEvent(id);
}

export async function deleteEvent(id: string) {
  const deleted = await db('calendar_events').where('id', id).delete();
  if (!deleted) throw new NotFoundError('Calendar event');
}

function formatEvent(row: any) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

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

  return event;
}
