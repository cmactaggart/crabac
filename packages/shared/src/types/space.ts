export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  calendarEnabled?: boolean;
  blogEnabled?: boolean;
  newsletterEnabled?: boolean;
  isPublic?: boolean;
  baseColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  publicTheme?: string | null;
}

export interface CreateSpaceRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateSpaceRequest {
  name?: string;
  description?: string;
  iconUrl?: string | null;
}

export interface SpaceMember {
  spaceId: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  isGuest?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    baseColor?: string | null;
    accentColor?: string | null;
    status: string;
  };
  roles?: { id: string; name: string; color: string | null; position: number }[];
}

export interface JoinSpaceRequest {
  code: string;
}

export interface SpaceAdminSettings {
  spaceId: string;
  allowPublicBoards: boolean;
  allowPublicGalleries: boolean;
  allowPublicCalendar: boolean;
  allowPublicRoutes: boolean;
  allowAnonymousBrowsing: boolean;
  calendarEnabled: boolean;
  blogEnabled: boolean;
  allowPublicBlog: boolean;
  newsletterEnabled: boolean;
  allowPublicNewsletter: boolean;
  allowPublicNewsletterSubscription: boolean;
  newsletterTrackingEnabled: boolean;
  socialEnabled: boolean;
  isPublic: boolean;
  requireVerifiedEmail: boolean;
  isFeatured: boolean;
  baseColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  publicTheme: string | null;
  webhooksEnabled: boolean;
  webhookSecret: string | null;
  publicNavLinks: { label: string; url: string }[];
  publicNavDisabledFeatures: string[];
}

export interface PublicSpaceCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  memberCount: number;
  tags: string[];
  isFeatured: boolean;
  baseColor: string | null;
  accentColor: string | null;
  textColor: string | null;
}

export interface SpaceTag {
  tag: string;
  tagSlug: string;
}
