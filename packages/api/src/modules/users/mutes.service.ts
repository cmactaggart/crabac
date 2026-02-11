import { db } from '../../database/connection.js';

export async function muteUser(userId: string, mutedUserId: string) {
  await db('user_mutes')
    .insert({ user_id: userId, muted_user_id: mutedUserId })
    .onConflict(['user_id', 'muted_user_id'])
    .ignore();
}

export async function unmuteUser(userId: string, mutedUserId: string) {
  await db('user_mutes')
    .where({ user_id: userId, muted_user_id: mutedUserId })
    .delete();
}

export async function getMutedUsers(userId: string): Promise<string[]> {
  const rows = await db('user_mutes')
    .where('user_id', userId)
    .select('muted_user_id');
  return rows.map((r: any) => String(r.muted_user_id));
}

export async function isUserMuted(userId: string, targetUserId: string): Promise<boolean> {
  const row = await db('user_mutes')
    .where({ user_id: userId, muted_user_id: targetUserId })
    .first();
  return !!row;
}
