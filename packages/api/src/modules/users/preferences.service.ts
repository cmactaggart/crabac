import { db } from '../../database/connection.js';
import type { UserPreferences } from '@crabac/shared';

const DEFAULTS: UserPreferences = {
  distanceUnits: 'imperial',
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const row = await db('user_preferences')
    .where({ user_id: userId })
    .first();

  if (!row) return { ...DEFAULTS };

  return {
    distanceUnits: row.distance_units,
  };
}

export async function updatePreferences(
  userId: string,
  data: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const updates: Record<string, any> = {};
  if (data.distanceUnits !== undefined) updates.distance_units = data.distanceUnits;

  if (Object.keys(updates).length > 0) {
    await db('user_preferences')
      .insert({ user_id: userId, ...updates })
      .onConflict('user_id')
      .merge(updates);
  }

  return getPreferences(userId);
}
