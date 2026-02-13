export const Permissions = {
  VIEW_CHANNELS:   1n << 0n,
  SEND_MESSAGES:   1n << 1n,
  MANAGE_MESSAGES: 1n << 2n,
  ATTACH_FILES:    1n << 3n,
  ADD_REACTIONS:   1n << 4n,
  MANAGE_CHANNELS: 1n << 5n,
  MANAGE_ROLES:    1n << 6n,
  MANAGE_MEMBERS:  1n << 7n,
  MANAGE_SPACE:    1n << 8n,
  CREATE_INVITES:  1n << 9n,
  MANAGE_INVITES:  1n << 10n,
  ADMINISTRATOR:   1n << 11n,
  VIEW_ADMIN_CHANNEL:   1n << 12n,
  CREATE_PORTAL:        1n << 13n,
  SUBMIT_PORTAL_INVITE: 1n << 14n,
  ACCEPT_PORTAL_INVITE: 1n << 15n,
  VIEW_ROLES:           1n << 16n,
  MANAGE_THREADS:       1n << 17n,
  CREATE_THREADS:       1n << 18n,
  MANAGE_CALENDAR:      1n << 19n,
} as const;

export type PermissionKey = keyof typeof Permissions;

export const DEFAULT_MEMBER_PERMISSIONS =
  Permissions.VIEW_CHANNELS |
  Permissions.SEND_MESSAGES |
  Permissions.ADD_REACTIONS |
  Permissions.ATTACH_FILES |
  Permissions.CREATE_INVITES |
  Permissions.CREATE_THREADS;

export const ALL_PERMISSIONS = Object.values(Permissions).reduce((a, b) => a | b, 0n);

export function hasPermission(userPerms: bigint, perm: bigint): boolean {
  if ((userPerms & Permissions.ADMINISTRATOR) !== 0n) return true;
  return (userPerms & perm) === perm;
}

export function combinePermissions(...perms: bigint[]): bigint {
  return perms.reduce((a, b) => a | b, 0n);
}
