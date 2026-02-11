import type { Message } from './message.js';
import type { DirectMessage, Conversation } from './conversation.js';
import type { SpaceMember } from './space.js';
import type { Notification } from './notification.js';
import type { PublicUser } from './user.js';

// Client → Server events
export interface ClientToServerEvents {
  'message:send': (payload: { channelId: string; content: string; replyToId?: string }) => void;
  'message:typing': (payload: { channelId: string }) => void;
  'channel:join': (payload: { channelId: string }) => void;
  'channel:leave': (payload: { channelId: string }) => void;
  'dm:join': (payload: { conversationId: string }) => void;
  'dm:send': (payload: { conversationId: string; content: string }) => void;
  'dm:typing': (payload: { conversationId: string }) => void;
  'presence:status': (payload: { status: string }) => void;
}

// Server → Client events
export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (payload: { channelId: string; messageId: string }) => void;
  'member:typing': (payload: { channelId: string; userId: string; username: string }) => void;
  'member:presence': (payload: { userId: string; status: string }) => void;
  'space:member_joined': (member: SpaceMember) => void;
  'space:member_left': (payload: { spaceId: string; userId: string }) => void;
  'dm:new': (message: DirectMessage) => void;
  'dm:updated': (message: DirectMessage) => void;
  'dm:deleted': (payload: { conversationId: string; messageId: string }) => void;
  'dm:typing': (payload: { conversationId: string; userId: string; username: string }) => void;
  'notification:new': (notification: Notification) => void;
  // Friend events
  'friend:request_received': (payload: { friendshipId: string; user: PublicUser }) => void;
  'friend:accepted': (payload: { friendshipId: string; user: PublicUser }) => void;
  'friend:removed': (payload: { userId: string }) => void;
  // Conversation events
  'conversation:created': (conversation: Conversation) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'conversation:member_left': (payload: { conversationId: string; userId: string }) => void;
}

export interface Invite {
  id: string;
  spaceId: string;
  code: string;
  createdBy: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateInviteRequest {
  maxUses?: number;
  expiresInHours?: number;
}
