export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  ownerId: string | null;
  participants: ConversationParticipant[];
  lastMessage: DirectMessage | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
  status: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  reactions: import('./message.js').Reaction[];
  attachments?: import('./message.js').Attachment[];
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
  };
}
