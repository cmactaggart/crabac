export interface CalendarCategory {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  spaceId: string;
  categoryId: string | null;
  creatorId: string;
  name: string;
  description: string | null;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:mm
  endTime: string | null; // HH:mm
  location: string | null;
  activityType: 'ride' | 'run' | 'walk' | null;
  routeId: string | null;
  imageUrl?: string | null;
  route?: CalendarEventRoute | null;
  isPublic?: boolean;
  seriesId?: string | null;
  isOverride?: boolean;
  isCancelled?: boolean;
  meetingRoomEnabled?: boolean;
  meetingRoomEarlyEntry?: number | null; // minutes before event, -1 = anytime
  meetingPublicAccess?: boolean;
  meetingPublicChat?: boolean;
  meetingPublicParticipation?: boolean;
  meetingIdentityMode?: 'anonymous' | 'email_verify' | 'require_login';
  meetingHasPassword?: boolean;
  meetingRoom?: {
    status: 'pending' | 'open' | 'active' | 'closed';
    callId: string | null;
    channelId: string | null;
    participantCount: number;
  } | null;
  rsvpCounts?: { going: number; maybe: number; notGoing: number };
  myRsvp?: 'going' | 'maybe' | 'not_going' | null;
  createdAt: string;
  updatedAt: string;
  category?: CalendarCategory | null;
  creator?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface RecurrenceRule {
  freq: 'weekly' | 'monthly';
  interval: number;
  byDay: string[]; // 'SU','MO','TU','WE','TH','FR','SA'
  bySetPos?: number; // 1-5, for monthly (e.g. 3rd Friday)
  dtstart: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

export interface EventSeries {
  id: string;
  spaceId: string;
  creatorId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  location: string | null;
  activityType: 'ride' | 'run' | 'walk' | null;
  routeId: string | null;
  imageUrl?: string | null;
  isPublic: boolean;
  meetingRoomEnabled?: boolean;
  meetingRoomEarlyEntry?: number | null;
  meetingPublicAccess?: boolean;
  meetingPublicChat?: boolean;
  meetingPublicParticipation?: boolean;
  meetingIdentityMode?: 'anonymous' | 'email_verify' | 'require_login';
  meetingHasPassword?: boolean;
  recurrenceRule: RecurrenceRule;
  eventTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventRoute {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number | null;
  geojson: any;
  url: string;
}

export interface EventRsvp {
  eventId: string;
  userId: string;
  status: 'going' | 'maybe' | 'not_going';
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export type MeetingIdentityMode = 'anonymous' | 'email_verify' | 'require_login';

export interface MeetingRoomGuest {
  id: string;
  eventId: string | null;
  channelId: string | null;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  livekitIdentity: string;
  status: 'active' | 'left' | 'kicked';
  createdAt: string;
}

export interface MeetingInvite {
  id: string;
  eventId: string | null;
  channelId: string | null;
  token: string;
  email: string | null;
  createdBy: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
}
