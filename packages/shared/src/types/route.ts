export interface RouteItem {
  id: string;
  channelId: string;
  authorId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  isPublic: boolean;
  filename: string;
  originalName: string;
  fileSize: number;
  url: string;
  distanceKm: number;
  elevationGainM: number | null;
  elevationLossM: number | null;
  flatness: number | null;
  durationSec: number | null;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  geojson: any;
  activityType: 'ride' | 'run' | 'walk' | null;
  startLat: number | null;
  startLng: number | null;
  trackName: string | null;
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
  category?: RouteCategory | null;
  starred?: boolean;
}

export interface RouteCategory {
  id: string;
  spaceId: string;
  name: string;
  createdAt: string;
}

export interface CreateRouteRequest {
  name: string;
  description?: string;
  categoryId?: string;
  isPublic?: boolean;
  activityType?: 'ride' | 'run' | 'walk';
}

export interface CreateRouteCategoryRequest {
  name: string;
}
