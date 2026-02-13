export type ChannelType = 'text' | 'announcement' | 'read_only' | 'forum';

export interface Channel {
  id: string;
  spaceId: string;
  name: string;
  topic: string | null;
  type: ChannelType;
  isPublic: boolean;
  isPrivate: boolean;
  isAdmin: boolean;
  position: number;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  // Portal fields (present when channel is portaled into another space)
  isPortal?: boolean;
  portalId?: string;
  sourceSpaceId?: string;
}

export interface ChannelPermissionOverride {
  channelId: string;
  roleId: string;
  allow: string; // bigint as string
  deny: string;  // bigint as string
}

export interface CreateChannelRequest {
  name: string;
  topic?: string;
  type?: ChannelType;
  isPrivate?: boolean;
  categoryId?: string;
}

export interface UpdateChannelRequest {
  name?: string;
  topic?: string;
  type?: ChannelType;
  position?: number;
}

// Channel Categories
export interface ChannelCategory {
  id: string;
  spaceId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  position?: number;
}

// Unread Tracking
export interface ChannelUnread {
  channelId: string;
  lastReadMessageId: string | null;
  unreadCount: number;
}
