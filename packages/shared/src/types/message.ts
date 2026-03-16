export interface GpxTrackMetadata {
  trackName: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  durationSec: number;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  geojson: any;
}

export interface AttachmentMetadata {
  gpx?: GpxTrackMetadata;
}

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  metadata?: AttachmentMetadata | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  users: { id: string; username: string }[];
}

export interface LinkEmbed {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  ogType: string | null;
}

export type MessageType = 'user' | 'portal_invite' | 'system';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  editedAt: string | null;
  isPinned: boolean;
  threadId: string | null;
  replyToId: string | null;
  replyCount: number;
  messageType: MessageType;
  metadata: Record<string, any> | null;
  attachments?: Attachment[];
  embeds?: LinkEmbed[];
  reactions: Reaction[];
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
    isBot?: boolean;
  };
  replyTo?: {
    id: string;
    content: string;
    author?: {
      id: string;
      username: string;
      displayName: string;
    };
  } | null;
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
