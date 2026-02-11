import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError } from '../../lib/errors.js';

export async function listCategories(spaceId: string) {
  return db('channel_categories').where('space_id', spaceId).orderBy('position', 'asc').select('*')
    .then(rows => rows.map(formatCategory));
}

export async function createCategory(spaceId: string, data: { name: string }) {
  const id = snowflake.generate();
  const maxPos = await db('channel_categories').where('space_id', spaceId).max('position as max').first();
  await db('channel_categories').insert({
    id, space_id: spaceId, name: data.name, position: (maxPos?.max ?? -1) + 1,
  });
  return getCategory(id);
}

export async function updateCategory(categoryId: string, data: { name?: string; position?: number }) {
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.position !== undefined) updates.position = data.position;
  if (Object.keys(updates).length > 0) {
    await db('channel_categories').where('id', categoryId).update(updates);
  }
  return getCategory(categoryId);
}

export async function deleteCategory(categoryId: string) {
  // Unset category on channels first
  await db('channels').where('category_id', categoryId).update({ category_id: null });
  const deleted = await db('channel_categories').where('id', categoryId).delete();
  if (!deleted) throw new NotFoundError('Category');
}

async function getCategory(id: string) {
  const row = await db('channel_categories').where('id', id).first();
  if (!row) throw new NotFoundError('Category');
  return formatCategory(row);
}

// ─── Bulk Reorder ───

export async function reorderCategories(
  spaceId: string,
  items: { categoryId: string; position: number }[],
) {
  await db.transaction(async (trx) => {
    for (const item of items) {
      await trx('channel_categories')
        .where({ id: item.categoryId, space_id: spaceId })
        .update({ position: item.position });
    }
  });
  return listCategories(spaceId);
}

function formatCategory(row: any) {
  return { id: row.id, spaceId: row.space_id, name: row.name, position: row.position, createdAt: row.created_at };
}
