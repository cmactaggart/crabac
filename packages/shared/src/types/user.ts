export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  status: UserStatus;
  emailVerified: boolean;
  totpEnabled: boolean;
  accountType: 'full' | 'board';
  baseColor?: string | null;
  accentColor?: string | null;
  isAdmin?: boolean;
  isBot?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** User object without sensitive fields, returned from API */
export type PublicUser = Omit<User, 'email' | 'emailVerified' | 'totpEnabled'>;

export interface CreateUserRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
}

export interface UserProfileLink {
  id: string;
  userId: string;
  label: string;
  url: string;
  position: number;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = AuthResponse | MfaChallengeResponse;

export interface TotpSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface FriendListItem {
  id: string;           // friendship ID
  user: PublicUser;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
  createdAt: string;
}

export interface FriendshipStatus {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
}

export interface FollowUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
}

export interface FollowCounts {
  followingCount: number;
  followerCount: number;
}

export type DistanceUnits = 'metric' | 'us_customary';

export interface UserPreferences {
  distanceUnits: DistanceUnits;
  defaultVisibility: import('./personal-collection.js').PersonalVisibility;
  profileVisibility: import('./personal-collection.js').PersonalVisibility;
  activitiesVisibility: import('./personal-collection.js').PersonalVisibility | null;
  onboardingCompleted: boolean;
  newsletterEnabled: boolean;
}
