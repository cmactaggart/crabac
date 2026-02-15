import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { CalendarCategory, CalendarEvent } from '@crabac/shared';

interface CalendarState {
  categories: CalendarCategory[];
  events: CalendarEvent[];
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
  createEvent: (spaceId: string, data: { name: string; description?: string | null; eventDate: string; eventTime?: string | null; categoryId?: string | null; isPublic?: boolean }) => Promise<CalendarEvent>;
  updateEvent: (spaceId: string, id: string, data: { name?: string; description?: string | null; eventDate?: string; eventTime?: string | null; categoryId?: string | null; isPublic?: boolean }) => Promise<CalendarEvent>;
  deleteEvent: (spaceId: string, id: string) => Promise<void>;

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
