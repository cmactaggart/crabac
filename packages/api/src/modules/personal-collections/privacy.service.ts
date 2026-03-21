import { db } from '../../database/connection.js';
import type { PersonalVisibility } from '@crabac/shared';
import { getPreferences } from '../users/preferences.service.js';

/**
 * Resolves which visibility levels a viewer can see for a given owner's content.
 * Owner sees all 4 levels. Non-owner always gets 'public'.
 * Followers get 'followers' + 'spaces'. Users sharing a space get 'spaces' only.
 */
export async function resolveVisibleLevels(
  ownerId: string,
  viewerId: string | null,
): Promise<Set<PersonalVisibility>> {
  // Owner sees everything
  if (viewerId && ownerId === viewerId) {
    return new Set(['public', 'private', 'followers', 'spaces']);
  }

  const levels = new Set<PersonalVisibility>(['public']);

  if (!viewerId) return levels;

  // Check if viewer follows owner (accepted)
  const followRow = await db('follows')
    .where({ follower_id: viewerId, following_id: ownerId, status: 'accepted' })
    .first();

  if (followRow) {
    levels.add('followers');
    levels.add('spaces');
    return levels;
  }

  // Check shared space membership
  const sharedSpace = await db('space_members as sm1')
    .join('space_members as sm2', 'sm1.space_id', 'sm2.space_id')
    .where('sm1.user_id', ownerId)
    .where('sm2.user_id', viewerId)
    .first();

  if (sharedSpace) {
    levels.add('spaces');
  }

  return levels;
}

/**
 * Checks if viewerId can view ownerId's profile based on profile_visibility preference.
 */
export async function canViewProfile(
  ownerId: string,
  viewerId: string,
): Promise<boolean> {
  // Owner always sees themselves
  if (ownerId === viewerId) return true;

  const prefs = await getPreferences(ownerId);
  const visibility = prefs.profileVisibility || 'spaces';

  if (visibility === 'public') return true;
  if (visibility === 'private') return false;

  if (visibility === 'followers' || visibility === 'spaces') {
    // Check if viewer follows owner
    const followRow = await db('follows')
      .where({ follower_id: viewerId, following_id: ownerId, status: 'accepted' })
      .first();

    if (followRow) return true;
  }

  if (visibility === 'spaces') {
    // Check shared space membership
    const sharedSpace = await db('space_members as sm1')
      .join('space_members as sm2', 'sm1.space_id', 'sm2.space_id')
      .where('sm1.user_id', ownerId)
      .where('sm2.user_id', viewerId)
      .first();

    if (sharedSpace) return true;
  }

  return false;
}
