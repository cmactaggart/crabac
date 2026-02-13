import { db } from '../../database/connection.js';
import { snowflake } from '../_shared.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../lib/errors.js';
import { ALL_PERMISSIONS, Permissions, combinePermissions } from '@crabac/shared';

/**
 * Compute effective permissions for a user in a space.
 * Owner always gets ALL_PERMISSIONS regardless of role assignments.
 */
export async function computePermissions(spaceId: string, userId: string): Promise<bigint> {
  // Check if user is the space owner
  const space = await db('spaces').where('id', spaceId).first();
  if (!space) throw new NotFoundError('Space');
  if (space.owner_id === userId) return ALL_PERMISSIONS;

  // Combine all role permissions via OR
  const roles = await db('member_roles')
    .join('roles', 'member_roles.role_id', 'roles.id')
    .where({ 'member_roles.space_id': spaceId, 'member_roles.user_id': userId })
    .select('roles.permissions');

  if (roles.length === 0) return 0n;

  return combinePermissions(...roles.map((r: any) => BigInt(r.permissions)));
}

/**
 * Compute effective permissions for a user in a specific channel.
 * Applies channel-level permission overrides on top of space-level permissions.
 * Administrators always get ALL_PERMISSIONS (overrides can't deny admins).
 */
export async function computeChannelPermissions(spaceId: string, channelId: string, userId: string): Promise<bigint> {
  const basePerms = await computePermissions(spaceId, userId);

  // Administrators bypass channel overrides
  if ((basePerms & Permissions.ADMINISTRATOR) !== 0n) return ALL_PERMISSIONS;

  // Get user's role IDs in this space
  const userRoles = await db('member_roles')
    .where({ space_id: spaceId, user_id: userId })
    .select('role_id');

  if (userRoles.length === 0) return basePerms;

  const roleIds = userRoles.map((r: any) => r.role_id);

  // Get channel overrides for those roles
  const overrides = await db('channel_permission_overrides')
    .where('channel_id', channelId)
    .whereIn('role_id', roleIds)
    .select('allow', 'deny');

  if (overrides.length === 0) return basePerms;

  // Aggregate: allow = OR of all allows, deny = OR of all denies
  let aggregateAllow = 0n;
  let aggregateDeny = 0n;
  for (const ov of overrides) {
    aggregateAllow |= BigInt(ov.allow);
    aggregateDeny |= BigInt(ov.deny);
  }

  // Apply: deny wins over allow (matching Discord behavior)
  return (basePerms | aggregateAllow) & ~aggregateDeny;
}

/**
 * Get the highest role position for a user in a space.
 */
export async function getHighestPosition(spaceId: string, userId: string): Promise<number> {
  const space = await db('spaces').where('id', spaceId).first();
  if (space && space.owner_id === userId) return 2147483647;

  const result = await db('member_roles')
    .join('roles', 'member_roles.role_id', 'roles.id')
    .where({ 'member_roles.space_id': spaceId, 'member_roles.user_id': userId })
    .max('roles.position as maxPos')
    .first();

  return result?.maxPos ?? 0;
}

export async function listRoles(spaceId: string) {
  const roles = await db('roles')
    .where('space_id', spaceId)
    .orderBy('position', 'desc');
  return roles.map(formatRole);
}

export async function createRole(
  spaceId: string,
  actorUserId: string,
  data: { name: string; color?: string; permissions?: string; position?: number },
) {
  const actorPosition = await getHighestPosition(spaceId, actorUserId);
  const position = data.position ?? 1;

  if (position >= actorPosition) {
    throw new ForbiddenError('Cannot create a role at or above your highest role position');
  }

  const id = snowflake.generate();
  await db('roles').insert({
    id,
    space_id: spaceId,
    name: data.name,
    color: data.color ?? null,
    position,
    permissions: data.permissions ?? '0',
    is_system: false,
    is_default: false,
  });

  return getRoleById(id);
}

export async function updateRole(
  spaceId: string,
  roleId: string,
  actorUserId: string,
  data: { name?: string; color?: string | null; permissions?: string; position?: number },
) {
  const role = await db('roles').where({ id: roleId, space_id: spaceId }).first();
  if (!role) throw new NotFoundError('Role');

  // Cannot edit the Owner system role
  if (role.is_system && role.name === 'Owner') {
    throw new ForbiddenError('Cannot edit the Owner role');
  }

  const actorPosition = await getHighestPosition(spaceId, actorUserId);

  // Can only edit roles below your position
  if (role.position >= actorPosition) {
    throw new ForbiddenError('Cannot edit a role at or above your highest role position');
  }

  if (data.position !== undefined && data.position >= actorPosition) {
    throw new ForbiddenError('Cannot move a role to or above your highest role position');
  }

  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.color !== undefined) updates.color = data.color;
  if (data.permissions !== undefined) updates.permissions = data.permissions;
  if (data.position !== undefined) updates.position = data.position;

  if (Object.keys(updates).length > 0) {
    await db('roles').where({ id: roleId, space_id: spaceId }).update(updates);
  }

  return getRoleById(roleId);
}

export async function deleteRole(spaceId: string, roleId: string, actorUserId: string) {
  const role = await db('roles').where({ id: roleId, space_id: spaceId }).first();
  if (!role) throw new NotFoundError('Role');
  if (role.is_system) throw new ForbiddenError('Cannot delete system roles');

  const actorPosition = await getHighestPosition(spaceId, actorUserId);
  if (role.position >= actorPosition) {
    throw new ForbiddenError('Cannot delete a role at or above your highest role position');
  }

  await db('roles').where({ id: roleId, space_id: spaceId }).delete();
}

export async function setMemberRoles(
  spaceId: string,
  targetUserId: string,
  roleIds: string[],
  actorUserId: string,
) {
  // Verify target is a member
  const member = await db('space_members')
    .where({ space_id: spaceId, user_id: targetUserId })
    .first();
  if (!member) throw new NotFoundError('Member');

  // Cannot modify the owner's roles
  const space = await db('spaces').where('id', spaceId).first();
  if (space && space.owner_id === targetUserId) {
    throw new ForbiddenError('Cannot modify the space owner\'s roles');
  }

  const actorPosition = await getHighestPosition(spaceId, actorUserId);

  // Validate all role IDs exist and are below actor's position
  if (roleIds.length > 0) {
    const roles = await db('roles').where('space_id', spaceId).whereIn('id', roleIds);
    if (roles.length !== roleIds.length) {
      throw new BadRequestError('One or more role IDs are invalid');
    }

    for (const role of roles) {
      if (role.position >= actorPosition) {
        throw new ForbiddenError(`Cannot assign role "${role.name}" which is at or above your position`);
      }
    }
  }

  // Always ensure default role is included
  const defaultRole = await db('roles')
    .where({ space_id: spaceId, is_default: true })
    .first();

  const finalRoleIds = new Set(roleIds);
  if (defaultRole) finalRoleIds.add(defaultRole.id);

  await db.transaction(async (trx) => {
    // Remove all current roles
    await trx('member_roles')
      .where({ space_id: spaceId, user_id: targetUserId })
      .delete();

    // Insert new roles
    if (finalRoleIds.size > 0) {
      await trx('member_roles').insert(
        Array.from(finalRoleIds).map((roleId) => ({
          space_id: spaceId,
          user_id: targetUserId,
          role_id: roleId,
        })),
      );
    }
  });

  return listMemberRoles(spaceId, targetUserId);
}

async function listMemberRoles(spaceId: string, userId: string) {
  const roles = await db('member_roles')
    .join('roles', 'member_roles.role_id', 'roles.id')
    .where({ 'member_roles.space_id': spaceId, 'member_roles.user_id': userId })
    .select('roles.*');
  return roles.map(formatRole);
}

async function getRoleById(id: string) {
  const role = await db('roles').where('id', id).first();
  if (!role) throw new NotFoundError('Role');
  return formatRole(role);
}

function formatRole(row: any) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    color: row.color,
    position: row.position,
    permissions: row.permissions,
    isSystem: row.is_system,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}
