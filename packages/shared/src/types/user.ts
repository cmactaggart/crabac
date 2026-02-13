export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  emailVerified: boolean;
  totpEnabled: boolean;
  accountType: 'full' | 'board';
  isAdmin?: boolean;
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

export type DistanceUnits = 'metric' | 'imperial';

export interface UserPreferences {
  distanceUnits: DistanceUnits;
}
