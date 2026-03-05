import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { UserPost } from '@crabac/shared';

interface FeedState {
  posts: UserPost[];
  loading: boolean;
  hasMore: boolean;
  searchQuery: string | null;
  searchHashtag: string | null;
  fetchFeed: (opts?: { before?: string }) => Promise<void>;
  searchPosts: (opts: { q?: string; hashtag?: string; before?: string }) => Promise<void>;
  clearSearch: () => void;
  reset: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  hasMore: true,
  searchQuery: null,
  searchHashtag: null,

  fetchFeed: async (opts) => {
    const { loading } = get();
    if (loading) return;

    set({ loading: true });
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (opts?.before) params.set('before', opts.before);

      const items = await api<UserPost[]>(`/follows/feed?${params}`);

      if (opts?.before) {
        set((s) => ({
          posts: [...s.posts, ...items],
          hasMore: items.length >= 10,
          loading: false,
        }));
      } else {
        set({
          posts: items,
          hasMore: items.length >= 10,
          loading: false,
        });
      }
    } catch {
      set({ loading: false });
    }
  },

  searchPosts: async (opts) => {
    const { loading } = get();
    if (loading) return;

    set({ loading: true, searchQuery: opts.q || null, searchHashtag: opts.hashtag || null });
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (opts.q) params.set('q', opts.q);
      if (opts.hashtag) params.set('hashtag', opts.hashtag);
      if (opts.before) params.set('before', opts.before);

      const items = await api<UserPost[]>(`/follows/feed/search?${params}`);

      if (opts.before) {
        set((s) => ({
          posts: [...s.posts, ...items],
          hasMore: items.length >= 25,
          loading: false,
        }));
      } else {
        set({
          posts: items,
          hasMore: items.length >= 25,
          loading: false,
        });
      }
    } catch {
      set({ loading: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: null, searchHashtag: null, posts: [], hasMore: true });
  },

  reset: () => {
    set({ posts: [], loading: false, hasMore: true, searchQuery: null, searchHashtag: null });
  },
}));
