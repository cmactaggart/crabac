import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { UserPost } from '@crabac/shared';

interface FeedState {
  posts: UserPost[];
  loading: boolean;
  hasMore: boolean;
  fetchFeed: (opts?: { before?: string }) => Promise<void>;
  reset: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  hasMore: true,

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

  reset: () => {
    set({ posts: [], loading: false, hasMore: true });
  },
}));
