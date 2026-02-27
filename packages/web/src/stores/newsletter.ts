import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Newsletter, NewsletterBlock, NewsletterStats } from '@crabac/shared';

interface NewsletterState {
  newsletters: Newsletter[];
  selectedNewsletter: Newsletter | null;
  loading: boolean;
  hasMore: boolean;
  analytics: NewsletterStats[];

  // Space newsletters
  fetchNewsletters: (spaceId: string) => Promise<void>;
  loadMore: (spaceId: string) => Promise<void>;
  createNewsletter: (spaceId: string, data: { subject: string; summary?: string | null; headerImageUrl?: string | null; blocks: NewsletterBlock[]; status?: string; isPublic?: boolean }) => Promise<Newsletter>;
  updateNewsletter: (spaceId: string, newsletterId: string, data: Partial<{ subject: string; summary: string | null; headerImageUrl: string | null; blocks: NewsletterBlock[]; status: string; isPublic: boolean }>) => Promise<Newsletter>;
  deleteNewsletter: (spaceId: string, newsletterId: string) => Promise<void>;
  uploadImage: (spaceId: string, file: File) => Promise<string>;
  fetchAnalytics: (spaceId: string) => Promise<void>;

  // Personal newsletters
  fetchPersonalNewsletters: () => Promise<void>;
  loadMorePersonal: () => Promise<void>;
  createPersonalNewsletter: (data: { subject: string; summary?: string | null; headerImageUrl?: string | null; blocks: NewsletterBlock[]; status?: string; isPublic?: boolean }) => Promise<Newsletter>;
  updatePersonalNewsletter: (newsletterId: string, data: Partial<{ subject: string; summary: string | null; headerImageUrl: string | null; blocks: NewsletterBlock[]; status: string; isPublic: boolean }>) => Promise<Newsletter>;
  deletePersonalNewsletter: (newsletterId: string) => Promise<void>;
  uploadPersonalImage: (file: File) => Promise<string>;

  setSelectedNewsletter: (newsletter: Newsletter | null) => void;
  clear: () => void;
}

export const useNewsletterStore = create<NewsletterState>((set, get) => ({
  newsletters: [],
  selectedNewsletter: null,
  loading: false,
  hasMore: true,
  analytics: [],

  fetchNewsletters: async (spaceId) => {
    set({ loading: true });
    try {
      const newsletters = await api<Newsletter[]>(`/spaces/${spaceId}/newsletters?limit=20`);
      set({ newsletters, loading: false, hasMore: newsletters.length >= 20 });
    } catch {
      set({ loading: false });
    }
  },

  loadMore: async (spaceId) => {
    const { newsletters, hasMore, loading } = get();
    if (!hasMore || loading || newsletters.length === 0) return;
    set({ loading: true });
    try {
      const lastId = newsletters[newsletters.length - 1].id;
      const more = await api<Newsletter[]>(`/spaces/${spaceId}/newsletters?limit=20&before=${lastId}`);
      set((s) => ({ newsletters: [...s.newsletters, ...more], loading: false, hasMore: more.length >= 20 }));
    } catch {
      set({ loading: false });
    }
  },

  createNewsletter: async (spaceId, data) => {
    const newsletter = await api<Newsletter>(`/spaces/${spaceId}/newsletters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ newsletters: [newsletter, ...s.newsletters] }));
    return newsletter;
  },

  updateNewsletter: async (spaceId, newsletterId, data) => {
    const newsletter = await api<Newsletter>(`/spaces/${spaceId}/newsletters/${newsletterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      newsletters: s.newsletters.map((n) => (n.id === newsletterId ? newsletter : n)),
      selectedNewsletter: s.selectedNewsletter?.id === newsletterId ? newsletter : s.selectedNewsletter,
    }));
    return newsletter;
  },

  deleteNewsletter: async (spaceId, newsletterId) => {
    await api(`/spaces/${spaceId}/newsletters/${newsletterId}`, { method: 'DELETE' });
    set((s) => ({
      newsletters: s.newsletters.filter((n) => n.id !== newsletterId),
      selectedNewsletter: s.selectedNewsletter?.id === newsletterId ? null : s.selectedNewsletter,
    }));
  },

  uploadImage: async (spaceId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api<{ url: string }>(`/spaces/${spaceId}/newsletters/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return data.url;
  },

  fetchAnalytics: async (spaceId) => {
    try {
      const analytics = await api<NewsletterStats[]>(`/spaces/${spaceId}/newsletter-analytics`);
      set({ analytics });
    } catch {
      set({ analytics: [] });
    }
  },

  // Personal newsletters
  fetchPersonalNewsletters: async () => {
    set({ loading: true });
    try {
      const newsletters = await api<Newsletter[]>('/users/me/newsletters?limit=20');
      set({ newsletters, loading: false, hasMore: newsletters.length >= 20 });
    } catch {
      set({ loading: false });
    }
  },

  loadMorePersonal: async () => {
    const { newsletters, hasMore, loading } = get();
    if (!hasMore || loading || newsletters.length === 0) return;
    set({ loading: true });
    try {
      const lastId = newsletters[newsletters.length - 1].id;
      const more = await api<Newsletter[]>(`/users/me/newsletters?limit=20&before=${lastId}`);
      set((s) => ({ newsletters: [...s.newsletters, ...more], loading: false, hasMore: more.length >= 20 }));
    } catch {
      set({ loading: false });
    }
  },

  createPersonalNewsletter: async (data) => {
    const newsletter = await api<Newsletter>('/users/me/newsletters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ newsletters: [newsletter, ...s.newsletters] }));
    return newsletter;
  },

  updatePersonalNewsletter: async (newsletterId, data) => {
    const newsletter = await api<Newsletter>(`/users/me/newsletters/${newsletterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      newsletters: s.newsletters.map((n) => (n.id === newsletterId ? newsletter : n)),
      selectedNewsletter: s.selectedNewsletter?.id === newsletterId ? newsletter : s.selectedNewsletter,
    }));
    return newsletter;
  },

  deletePersonalNewsletter: async (newsletterId) => {
    await api(`/users/me/newsletters/${newsletterId}`, { method: 'DELETE' });
    set((s) => ({
      newsletters: s.newsletters.filter((n) => n.id !== newsletterId),
      selectedNewsletter: s.selectedNewsletter?.id === newsletterId ? null : s.selectedNewsletter,
    }));
  },

  uploadPersonalImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api<{ url: string }>('/users/me/newsletters/upload-image', {
      method: 'POST',
      body: formData,
    });
    return data.url;
  },

  setSelectedNewsletter: (newsletter) => set({ selectedNewsletter: newsletter }),
  clear: () => set({ newsletters: [], selectedNewsletter: null, loading: false, hasMore: true, analytics: [] }),
}));
