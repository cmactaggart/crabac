export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: { id: string; username: string }[];
}

export type MessageType = 'user' | 'portal_invite' | 'system';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  isPinned: boolean;
  replyToId: string | null;
  replyCount: number;
  messageType: MessageType;
  metadata: Record<string, any> | null;
  attachments?: Attachment[];
  reactions: Reaction[];
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface CreateMessageRequest {
  content: string;
  replyToId?: string;
}

export interface UpdateMessageRequest {
  content: string;
}

export interface MessagesQuery {
  before?: string;
  limit?: number;
}

export interface ThreadResponse {
  parent: Message;
  replies: Message[];
}

export interface SearchResult extends Message {
  channelName: string;
}
