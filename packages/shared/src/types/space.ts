export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  calendarEnabled?: boolean;
}

export interface CreateSpaceRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateSpaceRequest {
  name?: string;
  description?: string;
  iconUrl?: string | null;
}

export interface SpaceMember {
  spaceId: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
  };
  roles?: { id: string; name: string; color: string | null; position: number }[];
}

export interface JoinSpaceRequest {
  code: string;
}

export interface SpaceAdminSettings {
  spaceId: string;
  allowPublicBoards: boolean;
  allowAnonymousBrowsing: boolean;
  calendarEnabled: boolean;
}
