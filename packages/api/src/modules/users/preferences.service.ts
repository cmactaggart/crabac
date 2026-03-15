import { db } from '../../database/connection.js';
import type { UserPreferences } from '@crabac/shared';

const DEFAULTS: UserPreferences = {
  distanceUnits: 'us_customary',
  defaultVisibility: 'private',
  profileVisibility: 'spaces',
  activitiesVisibility: null,
  onboardingCompleted: false,
  newsletterEnabled: false,
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const row = await db('user_preferences')
    .where({ user_id: userId })
    .first();

  if (!row) return { ...DEFAULTS };

  return {
    distanceUnits: row.distance_units,
    defaultVisibility: row.default_visibility || 'private',
    profileVisibility: row.profile_visibility || 'spaces',
    activitiesVisibility: row.activities_visibility || null,
    onboardingCompleted: !!row.onboarding_completed,
    newsletterEnabled: !!row.newsletter_enabled,
  };
}

export async function updatePreferences(
  userId: string,
  data: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const updates: Record<string, any> = {};
  if (data.distanceUnits !== undefined) updates.distance_units = data.distanceUnits;
  if (data.defaultVisibility !== undefined) updates.default_visibility = data.defaultVisibility;
  if (data.profileVisibility !== undefined) updates.profile_visibility = data.profileVisibility;
  if (data.activitiesVisibility !== undefined) updates.activities_visibility = data.activitiesVisibility;
  if (data.onboardingCompleted !== undefined) updates.onboarding_completed = data.onboardingCompleted;
  if (data.newsletterEnabled !== undefined) updates.newsletter_enabled = data.newsletterEnabled;

  if (Object.keys(updates).length > 0) {
    await db('user_preferences')
      .insert({ user_id: userId, ...updates })
      .onConflict('user_id')
      .merge(updates);
  }

  return getPreferences(userId);
}
