import { db } from '../../database/connection.js';
import { BadRequestError } from '../../lib/errors.js';
import type { UserPreferences, MessagingPrivacy } from '@crabac/shared';

const DEFAULTS: UserPreferences = {
  distanceUnits: 'us_customary',
  defaultVisibility: 'private',
  profileVisibility: 'spaces',
  activitiesVisibility: null,
  onboardingCompleted: false,
  newsletterEnabled: false,
  followRequestPolicy: 'accept_all',
  msgPrivacyAll: 'require_approval',
  msgPrivacyFollowed: 'accept_all',
  msgPrivacySpaces: 'accept_all',
  msgPrivacyGroupDm: 'accept_all',
};

const PRIVACY_RESTRICTIVENESS: Record<MessagingPrivacy, number> = {
  accept_all: 0,
  require_approval: 1,
  dont_allow: 2,
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
    followRequestPolicy: row.follow_request_policy || 'accept_all',
    msgPrivacyAll: row.msg_privacy_all || 'require_approval',
    msgPrivacyFollowed: row.msg_privacy_followed || 'accept_all',
    msgPrivacySpaces: row.msg_privacy_spaces || 'accept_all',
    msgPrivacyGroupDm: row.msg_privacy_group_dm || 'accept_all',
  };
}

export async function updatePreferences(
  userId: string,
  data: Partial<UserPreferences>,
): Promise<UserPreferences> {
  // Enforce: sub-settings cannot be less restrictive than msg_privacy_all
  if (data.msgPrivacyAll !== undefined || data.msgPrivacyFollowed !== undefined ||
      data.msgPrivacySpaces !== undefined || data.msgPrivacyGroupDm !== undefined) {
    const current = await getPreferences(userId);
    const allLevel = data.msgPrivacyAll ?? current.msgPrivacyAll;
    const allRestrict = PRIVACY_RESTRICTIVENESS[allLevel];

    for (const key of ['msgPrivacyFollowed', 'msgPrivacySpaces', 'msgPrivacyGroupDm'] as const) {
      const val = data[key] ?? current[key];
      if (PRIVACY_RESTRICTIVENESS[val] < allRestrict) {
        throw new BadRequestError(
          `${key} cannot be less restrictive than msgPrivacyAll (${allLevel})`,
        );
      }
    }
  }

  const updates: Record<string, any> = {};
  if (data.distanceUnits !== undefined) updates.distance_units = data.distanceUnits;
  if (data.defaultVisibility !== undefined) updates.default_visibility = data.defaultVisibility;
  if (data.profileVisibility !== undefined) updates.profile_visibility = data.profileVisibility;
  if (data.activitiesVisibility !== undefined) updates.activities_visibility = data.activitiesVisibility;
  if (data.onboardingCompleted !== undefined) updates.onboarding_completed = data.onboardingCompleted;
  if (data.newsletterEnabled !== undefined) updates.newsletter_enabled = data.newsletterEnabled;
  if (data.followRequestPolicy !== undefined) updates.follow_request_policy = data.followRequestPolicy;
  if (data.msgPrivacyAll !== undefined) updates.msg_privacy_all = data.msgPrivacyAll;
  if (data.msgPrivacyFollowed !== undefined) updates.msg_privacy_followed = data.msgPrivacyFollowed;
  if (data.msgPrivacySpaces !== undefined) updates.msg_privacy_spaces = data.msgPrivacySpaces;
  if (data.msgPrivacyGroupDm !== undefined) updates.msg_privacy_group_dm = data.msgPrivacyGroupDm;

  if (Object.keys(updates).length > 0) {
    await db('user_preferences')
      .insert({ user_id: userId, ...updates })
      .onConflict('user_id')
      .merge(updates);
  }

  return getPreferences(userId);
}
