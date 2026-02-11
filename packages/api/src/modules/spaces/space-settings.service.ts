import { db } from '../../database/connection.js';

export interface SpaceMemberSettings {
  suppressMentions: boolean;
  suppressEveryone: boolean;
  muteAll: boolean;
}

const DEFAULTS: SpaceMemberSettings = {
  suppressMentions: false,
  suppressEveryone: false,
  muteAll: false,
};

export async function getSettings(spaceId: string, userId: string): Promise<SpaceMemberSettings> {
  const row = await db('space_member_settings')
    .where({ space_id: spaceId, user_id: userId })
    .first();

  if (!row) return { ...DEFAULTS };

  return {
    suppressMentions: !!row.suppress_mentions,
    suppressEveryone: !!row.suppress_everyone,
    muteAll: !!row.mute_all,
  };
}

export async function updateSettings(
  spaceId: string,
  userId: string,
  data: Partial<SpaceMemberSettings>,
): Promise<SpaceMemberSettings> {
  const updates: Record<string, any> = {};
  if (data.suppressMentions !== undefined) updates.suppress_mentions = data.suppressMentions;
  if (data.suppressEveryone !== undefined) updates.suppress_everyone = data.suppressEveryone;
  if (data.muteAll !== undefined) updates.mute_all = data.muteAll;

  if (Object.keys(updates).length > 0) {
    await db('space_member_settings')
      .insert({ space_id: spaceId, user_id: userId, ...updates })
      .onConflict(['space_id', 'user_id'])
      .merge(updates);
  }

  return getSettings(spaceId, userId);
}
