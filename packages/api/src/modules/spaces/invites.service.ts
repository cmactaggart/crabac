import crypto from 'crypto';
import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';

export async function createInvite(spaceId: string, userId: string, data: { maxUses?: number; expiresInHours?: number }) {
  const id = snowflake.generate();
  const code = crypto.randomBytes(8).toString('base64url').slice(0, 10);
  const expiresAt = data.expiresInHours
    ? new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000)
    : null;

  await db('invites').insert({
    id,
    space_id: spaceId,
    code,
    created_by: userId,
    max_uses: data.maxUses ?? null,
    expires_at: expiresAt,
  });

  return getInvite(id);
}

export async function listInvites(spaceId: string) {
  const invites = await db('invites').where('space_id', spaceId).orderBy('created_at', 'desc');
  return invites.map(formatInvite);
}

export async function deleteInvite(spaceId: string, inviteId: string) {
  const deleted = await db('invites')
    .where({ id: inviteId, space_id: spaceId })
    .delete();
  if (!deleted) throw new NotFoundError('Invite');
}

async function getInvite(id: string) {
  const invite = await db('invites').where('id', id).first();
  if (!invite) throw new NotFoundError('Invite');
  return formatInvite(invite);
}

export async function previewInvite(code: string) {
  const invite = await db('invites')
    .join('spaces', 'invites.space_id', 'spaces.id')
    .where('invites.code', code)
    .select('spaces.name as space_name', 'spaces.icon_url', 'spaces.description', 'invites.expires_at', 'invites.max_uses', 'invites.use_count')
    .first();

  if (!invite) throw new NotFoundError('Invite');

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new BadRequestError('Invite has expired');
  }
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    throw new BadRequestError('Invite has reached maximum uses');
  }

  return {
    spaceName: invite.space_name,
    iconUrl: invite.icon_url,
    description: invite.description,
  };
}

function formatInvite(row: any) {
  return {
    id: row.id,
    spaceId: row.space_id,
    code: row.code,
    createdBy: row.created_by,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
