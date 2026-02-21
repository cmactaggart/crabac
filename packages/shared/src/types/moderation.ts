export interface SpaceBan {
  spaceId: string;
  userId: string;
  bannedBy: string;
  reason: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface UserBan {
  userId: string;
  bannedBy: string;
  reason: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email?: string;
  };
}

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  spaceId: string | null;
  channelId: string | null;
  messageId: string | null;
  dmMessageId: string | null;
  conversationId: string | null;
  galleryItemId: string | null;
  routeId: string | null;
  forumPostId: string | null;
  contentType: string | null;
  reason: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter?: {
    id: string;
    username: string;
    displayName: string;
  };
  reportedUser?: {
    id: string;
    username: string;
    displayName: string;
  };
  messagePreview?: string | null;
  spaceName?: string | null;
}

export interface UserBlocks {
  blockedByMe: string[];
  blockedMe: string[];
}
