import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { CalendarCategory, CalendarEvent, EventRsvp, EventSeries } from '@crabac/shared';

interface CalendarState {
  categories: CalendarCategory[];
  events: CalendarEvent[];
  upcomingEvents: CalendarEvent[];
  upcomingLoading: boolean;
  selectedDate: string | null; // YYYY-MM-DD
  selectedEvent: CalendarEvent | null;
  currentMonth: number; // 0-11
  currentYear: number;
  loading: boolean;

  fetchCategories: (spaceId: string) => Promise<void>;
  createCategory: (spaceId: string, data: { name: string; color: string }) => Promise<CalendarCategory>;
  updateCategory: (spaceId: string, id: string, data: { name?: string; color?: string }) => Promise<CalendarCategory>;
  deleteCategory: (spaceId: string, id: string) => Promise<void>;

  fetchEvents: (spaceId: string) => Promise<void>;
  fetchUpcomingEvents: (spaceId: string) => Promise<void>;
  uploadEventImage: (spaceId: string, file: File) => Promise<string>;
  createEvent: (spaceId: string, data: {
    name: string; description?: string | null; eventDate: string; eventTime?: string | null;
    categoryId?: string | null; isPublic?: boolean;
    location?: string | null; activityType?: string | null; routeId?: string | null;
    imageUrl?: string | null;
  }) => Promise<CalendarEvent>;
  updateEvent: (spaceId: string, id: string, data: {
    name?: string; description?: string | null; eventDate?: string; eventTime?: string | null;
    categoryId?: string | null; isPublic?: boolean;
    location?: string | null; activityType?: string | null; routeId?: string | null;
    imageUrl?: string | null;
  }) => Promise<CalendarEvent>;
  deleteEvent: (spaceId: string, id: string) => Promise<void>;

  rsvp: (spaceId: string, eventId: string, status: 'going' | 'maybe' | 'not_going') => Promise<void>;
  removeRsvp: (spaceId: string, eventId: string) => Promise<void>;
  fetchRsvps: (spaceId: string, eventId: string) => Promise<EventRsvp[]>;

  createSeries: (spaceId: string, data: any) => Promise<EventSeries>;
  updateSeries: (spaceId: string, seriesId: string, data: any) => Promise<EventSeries>;
  deleteSeries: (spaceId: string, seriesId: string) => Promise<void>;
  overrideOccurrence: (spaceId: string, eventId: string, data: any) => Promise<CalendarEvent>;
  cancelOccurrence: (spaceId: string, eventId: string) => Promise<CalendarEvent>;

  setSelectedDate: (date: string | null) => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  navigateMonth: (delta: number) => void;
  goToToday: () => void;
  clear: () => void;
}

const now = new Date();

export const useCalendarStore = create<CalendarState>((set, get) => ({
  categories: [],
  events: [],
  upcomingEvents: [],
  upcomingLoading: false,
  selectedDate: null,
  selectedEvent: null,
  currentMonth: now.getMonth(),
  currentYear: now.getFullYear(),
  loading: false,

  fetchCategories: async (spaceId) => {
    try {
      const categories = await api<CalendarCategory[]>(`/spaces/${spaceId}/calendar/categories`);
      set({ categories });
    } catch { /* ignore */ }
  },

  createCategory: async (spaceId, data) => {
    const category = await api<CalendarCategory>(`/spaces/${spaceId}/calendar/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ categories: [...s.categories, category] }));
    return category;
  },

  updateCategory: async (spaceId, id, data) => {
    const category = await api<CalendarCategory>(`/spaces/${spaceId}/calendar/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? category : c)),
      events: s.events.map((e) => (e.categoryId === id ? { ...e, category } : e)),
    }));
    return category;
  },

  deleteCategory: async (spaceId, id) => {
    await api(`/spaces/${spaceId}/calendar/categories/${id}`, { method: 'DELETE' });
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
      events: s.events.map((e) => (e.categoryId === id ? { ...e, categoryId: null, category: null } : e)),
    }));
  },

  fetchEvents: async (spaceId) => {
    const { currentMonth, currentYear } = get();
    set({ loading: true });
    try {
      // Fetch a range that covers the visible grid (including edge days from prev/next month)
      const from = new Date(currentYear, currentMonth, 1);
      from.setDate(from.getDate() - from.getDay()); // Start from Sunday
      const to = new Date(currentYear, currentMonth + 1, 0);
      to.setDate(to.getDate() + (6 - to.getDay())); // End on Saturday

      const fromStr = formatDateStr(from);
      const toStr = formatDateStr(to);

      const events = await api<CalendarEvent[]>(
        `/spaces/${spaceId}/calendar/events?from=${fromStr}&to=${toStr}`,
      );
      set({ events, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUpcomingEvents: async (spaceId) => {
    set({ upcomingLoading: true });
    try {
      const upcomingEvents = await api<CalendarEvent[]>(`/spaces/${spaceId}/calendar/upcoming?limit=20`);
      set({ upcomingEvents, upcomingLoading: false });
    } catch {
      set({ upcomingLoading: false });
    }
  },

  uploadEventImage: async (spaceId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api<{ url: string }>(`/spaces/${spaceId}/calendar/events/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return data.url;
  },

  createEvent: async (spaceId, data) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ events: [...s.events, event] }));
    return event;
  },

  updateEvent: async (spaceId, id, data) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? event : e)),
      selectedEvent: s.selectedEvent?.id === id ? event : s.selectedEvent,
    }));
    return event;
  },

  deleteEvent: async (spaceId, id) => {
    await api(`/spaces/${spaceId}/calendar/events/${id}`, { method: 'DELETE' });
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
      selectedEvent: s.selectedEvent?.id === id ? null : s.selectedEvent,
    }));
  },

  rsvp: async (spaceId, eventId, status) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === eventId ? event : e)),
      selectedEvent: s.selectedEvent?.id === eventId ? event : s.selectedEvent,
    }));
  },

  removeRsvp: async (spaceId, eventId) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvp`, {
      method: 'DELETE',
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === eventId ? event : e)),
      selectedEvent: s.selectedEvent?.id === eventId ? event : s.selectedEvent,
    }));
  },

  fetchRsvps: async (spaceId, eventId) => {
    return api<EventRsvp[]>(`/spaces/${spaceId}/calendar/events/${eventId}/rsvps`);
  },

  createSeries: async (spaceId, data) => {
    const series = await api<EventSeries>(`/spaces/${spaceId}/calendar/series`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Refetch events to pick up new occurrences
    get().fetchEvents(spaceId);
    return series;
  },

  updateSeries: async (spaceId, seriesId, data) => {
    const series = await api<EventSeries>(`/spaces/${spaceId}/calendar/series/${seriesId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    get().fetchEvents(spaceId);
    return series;
  },

  deleteSeries: async (spaceId, seriesId) => {
    await api(`/spaces/${spaceId}/calendar/series/${seriesId}`, { method: 'DELETE' });
    get().fetchEvents(spaceId);
  },

  overrideOccurrence: async (spaceId, eventId, data) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/override`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === eventId ? event : e)),
      selectedEvent: s.selectedEvent?.id === eventId ? event : s.selectedEvent,
    }));
    return event;
  },

  cancelOccurrence: async (spaceId, eventId) => {
    const event = await api<CalendarEvent>(`/spaces/${spaceId}/calendar/events/${eventId}/cancel`, {
      method: 'POST',
    });
    set((s) => ({
      events: s.events.filter((e) => e.id !== eventId),
      selectedEvent: s.selectedEvent?.id === eventId ? null : s.selectedEvent,
    }));
    return event;
  },

  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedEvent: (event) => set({ selectedEvent: event }),

  navigateMonth: (delta) => {
    set((s) => {
      let month = s.currentMonth + delta;
      let year = s.currentYear;
      if (month < 0) { month = 11; year--; }
      if (month > 11) { month = 0; year++; }
      return { currentMonth: month, currentYear: year };
    });
  },

  goToToday: () => {
    const now = new Date();
    set({ currentMonth: now.getMonth(), currentYear: now.getFullYear() });
  },

  clear: () => set({
    categories: [],
    events: [],
    upcomingEvents: [],
    selectedDate: null,
    selectedEvent: null,
  }),
}));

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
