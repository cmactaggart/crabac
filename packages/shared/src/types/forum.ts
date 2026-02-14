export interface ForumThread {
  id: string;
  channelId: string;
  title: string;
  authorId: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
  };
}

export interface ForumThreadSummary extends ForumThread {
  replyCount: number;
  lastActivityAt: string;
  firstPostPreview: string;
}

export interface CreateThreadRequest {
  title: string;
  content: string;
}

export interface UpdateThreadRequest {
  title?: string;
  isPinned?: boolean;
  isLocked?: boolean;
}

export interface ThreadsQuery {
  before?: string;
  limit?: number;
  sort?: 'latest' | 'newest';
}

export interface ThreadPostsQuery {
  before?: string;
  limit?: number;
}
