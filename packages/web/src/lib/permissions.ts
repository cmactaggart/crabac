import { Permissions, hasPermission } from '@crabac/shared';

export { Permissions, hasPermission };

export function computePermissionsFromRoles(
  roles: { permissions: string }[],
  isOwner: boolean,
): bigint {
  if (isOwner) return Object.values(Permissions).reduce((a, b) => a | b, 0n);
  return roles.reduce((acc, r) => acc | BigInt(r.permissions), 0n);
}
