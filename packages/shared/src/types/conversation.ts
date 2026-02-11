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
  status: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
