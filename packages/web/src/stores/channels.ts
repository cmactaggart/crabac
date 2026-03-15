import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Channel, ChannelCategory, Message } from '@crabac/shared';

interface UnreadInfo {
  unreadCount: number;
  mentionCount: number;
}

interface SpaceCacheEntry {
  channels: Channel[];
  categories: ChannelCategory[];
  unreads: Record<string, UnreadInfo>;
  timestamp: number;
}

interface EnterSpaceResult {
  messages: Message[];
  channelId: string | null;
}

interface ChannelsState {
  channels: Channel[];
  categories: ChannelCategory[];
  activeChannelId: string | null;
  unreads: Record<string, UnreadInfo>;
  mutedChannels: Set<string>;
  loading: boolean;
  spaceCache: Map<string, SpaceCacheEntry>;
  _prefetchInflight: Set<string>;
  fetchChannels: (spaceId: string) => Promise<void>;
  fetchCategories: (spaceId: string) => Promise<void>;
  setActiveChannel: (id: string | null) => void;
  createChannel: (spaceId: string, name: string, topic?: string, categoryId?: string, type?: string, isPrivate?: boolean, memberIds?: string[], roleOverrides?: string[]) => Promise<Channel>;
  createCategory: (spaceId: string, name: string) => Promise<void>;
  fetchUnreads: (spaceId: string) => Promise<void>;
  markRead: (spaceId: string, channelId: string, messageId: string) => Promise<void>;
  updateChannel: (spaceId: string, channelId: string, data: { name?: string; topic?: string; type?: string; isPublic?: boolean; isPrivate?: boolean }) => Promise<void>;
  deleteChannel: (spaceId: string, channelId: string) => Promise<void>;
  updateCategory: (spaceId: string, categoryId: string, data: { name?: string }) => Promise<void>;
  deleteCategory: (spaceId: string, categoryId: string) => Promise<void>;
  reorderChannels: (spaceId: string, items: { channelId: string; position: number; categoryId?: string | null }[]) => Promise<void>;
  reorderCategories: (spaceId: string, items: { categoryId: string; position: number }[]) => Promise<void>;
  incrementUnread: (channelId: string) => void;
  fetchMuted: (spaceId: string) => Promise<void>;
  toggleMute: (spaceId: string, channelId: string) => Promise<void>;
  enterSpace: (spaceId: string, channelId?: string) => Promise<EnterSpaceResult | null>;
  prefetchSpace: (spaceId: string) => void;
}

const CACHE_FRESH_MS = 30_000; // 30 seconds
const MAX_CACHED_SPACES = 5;

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  categories: [],
  activeChannelId: null,
  unreads: {},
  mutedChannels: new Set<string>(),
  loading: false,
  spaceCache: new Map(),
  _prefetchInflight: new Set(),

  fetchChannels: async (spaceId) => {
    set({ loading: true });
    try {
      const channels = await api<Channel[]>(`/spaces/${spaceId}/channels`);
      set({ channels, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchCategories: async (spaceId) => {
    try {
      const categories = await api<ChannelCategory[]>(`/spaces/${spaceId}/categories`);
      set({ categories });
    } catch {
      // ignore
    }
  },

  setActiveChannel: (id) => set({ activeChannelId: id }),

  createChannel: async (spaceId, name, topic, categoryId, type, isPrivate, memberIds, roleOverrides) => {
    const channel = await api<Channel>(`/spaces/${spaceId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, topic, categoryId, type, isPrivate, memberIds, roleOverrides }),
    });
    set((s) => ({ channels: [...s.channels, channel] }));
    return channel;
  },

  createCategory: async (spaceId, name) => {
    const category = await api<ChannelCategory>(`/spaces/${spaceId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    set((s) => ({ categories: [...s.categories, category] }));
  },

  fetchUnreads: async (spaceId) => {
    try {
      const unreads = await api<Record<string, UnreadInfo>>(`/spaces/${spaceId}/channels/unreads`);
      set({ unreads });
    } catch {
      // ignore
    }
  },

  markRead: async (spaceId, channelId, messageId) => {
    try {
      await api(`/spaces/${spaceId}/channels/${channelId}/read`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      });
      set((s) => ({
        unreads: { ...s.unreads, [channelId]: { unreadCount: 0, mentionCount: 0 } },
      }));
    } catch {
      // ignore
    }
  },

  updateChannel: async (spaceId, channelId, data) => {
    const updated = await api<Channel>(`/spaces/${spaceId}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({ channels: s.channels.map((ch) => (ch.id === channelId ? updated : ch)) }));
  },

  deleteChannel: async (spaceId, channelId) => {
    await api(`/spaces/${spaceId}/channels/${channelId}`, { method: 'DELETE' });
    set((s) => ({ channels: s.channels.filter((ch) => ch.id !== channelId) }));
  },

  updateCategory: async (spaceId, categoryId, data) => {
    const updated = await api<ChannelCategory>(`/spaces/${spaceId}/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({ categories: s.categories.map((cat) => (cat.id === categoryId ? updated : cat)) }));
  },

  deleteCategory: async (spaceId, categoryId) => {
    await api(`/spaces/${spaceId}/categories/${categoryId}`, { method: 'DELETE' });
    set((s) => ({ categories: s.categories.filter((cat) => cat.id !== categoryId) }));
  },

  reorderChannels: async (spaceId, items) => {
    try {
      const channels = await api<Channel[]>(`/spaces/${spaceId}/channels/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ channels: items }),
      });
      set({ channels });
    } catch {
      // Re-fetch on error to restore correct state
      const channels = await api<Channel[]>(`/spaces/${spaceId}/channels`);
      set({ channels });
    }
  },

  reorderCategories: async (spaceId, items) => {
    try {
      const categories = await api<ChannelCategory[]>(`/spaces/${spaceId}/categories/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ categories: items }),
      });
      set({ categories });
    } catch {
      const categories = await api<ChannelCategory[]>(`/spaces/${spaceId}/categories`);
      set({ categories });
    }
  },

  incrementUnread: (channelId) => {
    set((s) => ({
      unreads: {
        ...s.unreads,
        [channelId]: {
          unreadCount: (s.unreads[channelId]?.unreadCount || 0) + 1,
          mentionCount: s.unreads[channelId]?.mentionCount || 0,
        },
      },
    }));
  },

  fetchMuted: async (spaceId) => {
    try {
      const muted = await api<string[]>(`/spaces/${spaceId}/channels/muted`);
      set({ mutedChannels: new Set(muted) });
    } catch {
      // ignore
    }
  },

  toggleMute: async (spaceId, channelId) => {
    const { mutedChannels } = get();
    const isMuted = mutedChannels.has(channelId);
    try {
      if (isMuted) {
        await api(`/spaces/${spaceId}/channels/${channelId}/mute`, { method: 'DELETE' });
        set((s) => {
          const next = new Set(s.mutedChannels);
          next.delete(channelId);
          return { mutedChannels: next };
        });
      } else {
        await api(`/spaces/${spaceId}/channels/${channelId}/mute`, { method: 'PUT' });
        set((s) => {
          const next = new Set(s.mutedChannels);
          next.add(channelId);
          return { mutedChannels: next };
        });
      }
    } catch {
      // ignore
    }
  },

  enterSpace: async (spaceId, channelId?) => {
    const { spaceCache } = get();
    const cached = spaceCache.get(spaceId);
    const now = Date.now();

    // If cached and fresh, use cached data immediately and revalidate in background
    if (cached && (now - cached.timestamp) < CACHE_FRESH_MS) {
      set({
        channels: cached.channels,
        categories: cached.categories,
        unreads: cached.unreads,
        loading: false,
      });
      // Revalidate in background
      const qs = channelId ? `?channelId=${channelId}` : '';
      api<{ channels: Channel[]; categories: ChannelCategory[]; unreads: Record<string, UnreadInfo>; messages: Message[]; channelId: string | null }>(
        `/spaces/${spaceId}/enter${qs}`,
      ).then((data) => {
        const { spaceCache: sc } = get();
        const newCache = new Map(sc);
        newCache.set(spaceId, {
          channels: data.channels,
          categories: data.categories,
          unreads: data.unreads,
          timestamp: Date.now(),
        });
        set({
          channels: data.channels,
          categories: data.categories,
          unreads: data.unreads,
          spaceCache: newCache,
        });
      }).catch(() => {});
      // Return empty messages — caller should use cached messages or fetch fresh
      return { messages: [], channelId: channelId || null };
    }

    // If cached but stale, show cached immediately then fetch fresh
    if (cached) {
      set({
        channels: cached.channels,
        categories: cached.categories,
        unreads: cached.unreads,
        loading: true,
      });
    } else {
      set({ loading: true });
    }

    try {
      const qs = channelId ? `?channelId=${channelId}` : '';
      const data = await api<{
        channels: Channel[];
        categories: ChannelCategory[];
        unreads: Record<string, UnreadInfo>;
        messages: Message[];
        channelId: string | null;
      }>(`/spaces/${spaceId}/enter${qs}`);

      // Update space cache
      const { spaceCache: sc } = get();
      const newCache = new Map(sc);
      newCache.set(spaceId, {
        channels: data.channels,
        categories: data.categories,
        unreads: data.unreads,
        timestamp: Date.now(),
      });
      // Evict oldest entries if over limit
      if (newCache.size > MAX_CACHED_SPACES) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, entry] of newCache) {
          if (entry.timestamp < oldestTime) {
            oldestTime = entry.timestamp;
            oldestKey = key;
          }
        }
        if (oldestKey) newCache.delete(oldestKey);
      }

      set({
        channels: data.channels,
        categories: data.categories,
        unreads: data.unreads,
        loading: false,
        spaceCache: newCache,
      });

      return { messages: data.messages, channelId: data.channelId };
    } catch {
      set({ loading: false });
      return null;
    }
  },

  prefetchSpace: (spaceId) => {
    const { spaceCache, _prefetchInflight } = get();
    // Skip if already cached and fresh, or if prefetch is in-flight
    const cached = spaceCache.get(spaceId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_FRESH_MS) return;
    if (_prefetchInflight.has(spaceId)) return;

    const newInflight = new Set(_prefetchInflight);
    newInflight.add(spaceId);
    set({ _prefetchInflight: newInflight });

    api<{
      channels: Channel[];
      categories: ChannelCategory[];
      unreads: Record<string, UnreadInfo>;
      messages: Message[];
      channelId: string | null;
    }>(`/spaces/${spaceId}/enter`)
      .then((data) => {
        const { spaceCache: sc, _prefetchInflight: inf } = get();
        const newCache = new Map(sc);
        newCache.set(spaceId, {
          channels: data.channels,
          categories: data.categories,
          unreads: data.unreads,
          timestamp: Date.now(),
        });
        // Evict oldest entries if over limit
        if (newCache.size > MAX_CACHED_SPACES) {
          let oldestKey: string | null = null;
          let oldestTime = Infinity;
          for (const [key, entry] of newCache) {
            if (entry.timestamp < oldestTime) {
              oldestTime = entry.timestamp;
              oldestKey = key;
            }
          }
          if (oldestKey) newCache.delete(oldestKey);
        }
        const newInf = new Set(inf);
        newInf.delete(spaceId);
        set({ spaceCache: newCache, _prefetchInflight: newInf });
      })
      .catch(() => {
        const { _prefetchInflight: inf } = get();
        const newInf = new Set(inf);
        newInf.delete(spaceId);
        set({ _prefetchInflight: newInf });
      });
  },
}));
