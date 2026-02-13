import { db } from '../../database/connection.js';

export async function getSpaceAdminSettings(spaceId: string) {
  let settings = await db('space_settings').where('space_id', spaceId).first();

  if (!settings) {
    // Return defaults
    return {
      spaceId,
      allowPublicBoards: false,
      allowAnonymousBrowsing: false,
      calendarEnabled: false,
    };
  }

  return formatSettings(settings);
}

export async function updateSpaceAdminSettings(
  spaceId: string,
  data: { allowPublicBoards?: boolean; allowAnonymousBrowsing?: boolean; calendarEnabled?: boolean },
) {
  const existing = await db('space_settings').where('space_id', spaceId).first();

  if (existing) {
    const updates: Record<string, any> = {};
    if (data.allowPublicBoards !== undefined) updates.allow_public_boards = data.allowPublicBoards;
    if (data.allowAnonymousBrowsing !== undefined) updates.allow_anonymous_browsing = data.allowAnonymousBrowsing;
    if (data.calendarEnabled !== undefined) updates.calendar_enabled = data.calendarEnabled;

    if (Object.keys(updates).length > 0) {
      await db('space_settings').where('space_id', spaceId).update(updates);
    }
  } else {
    await db('space_settings').insert({
      space_id: spaceId,
      allow_public_boards: data.allowPublicBoards ?? false,
      allow_anonymous_browsing: data.allowAnonymousBrowsing ?? false,
      calendar_enabled: data.calendarEnabled ?? false,
    });
  }

  return getSpaceAdminSettings(spaceId);
}

function formatSettings(row: any) {
  return {
    spaceId: row.space_id,
    allowPublicBoards: row.allow_public_boards,
    allowAnonymousBrowsing: row.allow_anonymous_browsing,
    calendarEnabled: !!row.calendar_enabled,
  };
}
