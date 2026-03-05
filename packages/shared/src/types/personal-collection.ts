export type PersonalVisibility = 'public' | 'private' | 'friends' | 'spaces';

export interface PersonalGalleryAttachment {
  id: string;
  galleryItemId: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  position: number;
}

export interface PersonalGalleryItem {
  id: string;
  userId: string;
  caption: string | null;
  visibility: PersonalVisibility;
  attachments: PersonalGalleryAttachment[];
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor: string | null;
    accentColor: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PersonalRouteItem {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  visibility: PersonalVisibility;
  filename: string;
  originalName: string;
  fileSize: number;
  url: string;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  flatness: number | null;
  durationSec: number | null;
  startLat: number | null;
  startLng: number | null;
  bounds: any;
  geojson: any;
  trackName: string | null;
  activityType: 'ride' | 'run' | 'walk' | null;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor: string | null;
    accentColor: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PersonalEventCategory {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface PersonalEvent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  visibility: PersonalVisibility;
  activityType: 'ride' | 'run' | 'walk' | null;
  categoryId: string | null;
  category?: PersonalEventCategory | null;
  routeId: string | null;
  route?: PersonalRouteItem | null;
  color: string | null;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor: string | null;
    accentColor: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserCollectionsSummary {
  galleryCount: number;
  routeCount: number;
  eventCount: number;
  postCount: number;
}

export interface UserPost {
  id: string;
  userId: string;
  body: string | null;
  visibility: PersonalVisibility;
  attachments: UserPostAttachment[];
  tags: UserPostTag[];
  reactions: { emoji: string; count: number; users: { id: string; username: string }[] }[];
  commentCount: number;
  isPinned?: boolean;
  repostOfId?: string | null;
  repostOf?: UserPost | null;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserPostComment {
  id: string;
  postId: string;
  userId: string;
  parentCommentId?: string | null;
  body: string;
  reactions: { emoji: string; count: number; users: { id: string; username: string }[] }[];
  replies?: UserPostComment[];
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserPostAttachment {
  id: string;
  postId: string;
  type: 'image' | 'video' | 'gpx';
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  position: number;
  personalGalleryItemId: string | null;
  personalRouteItemId: string | null;
}

export interface UserPostTag {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
