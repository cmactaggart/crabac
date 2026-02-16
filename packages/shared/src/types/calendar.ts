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
  location: string | null;
  activityType: 'ride' | 'run' | 'walk' | null;
  routeId: string | null;
  route?: CalendarEventRoute | null;
  isPublic?: boolean;
  seriesId?: string | null;
  isOverride?: boolean;
  isCancelled?: boolean;
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
  isPublic: boolean;
  recurrenceRule: RecurrenceRule;
  eventTime: string | null;
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
