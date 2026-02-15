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
  isPublic?: boolean;
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
