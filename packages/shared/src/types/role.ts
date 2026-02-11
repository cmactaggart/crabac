export interface Role {
  id: string;
  spaceId: string;
  name: string;
  color: string | null;
  position: number;
  permissions: string; // bigint serialized as string
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateRoleRequest {
  name: string;
  color?: string;
  permissions?: string; // bigint as string
  position?: number;
}

export interface UpdateRoleRequest {
  name?: string;
  color?: string | null;
  permissions?: string;
  position?: number;
}

export interface SetMemberRolesRequest {
  roleIds: string[];
}
