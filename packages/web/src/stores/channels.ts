import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Channel, ChannelCategory } from '@gud/shared';

interface UnreadInfo {
  unreadCount: number;
  mentionCount: number;
}

interface ChannelsState {
  channels: Channel[];
  categories: ChannelCategory[];
  activeChannelId: string | null;
  unreads: Record<string, UnreadInfo>;
  mutedChannels: Set<string>;
  loading: boolean;
  fetchChannels: (spaceId: string) => Promise<void>;
  fetchCategories: (spaceId: string) => Promise<void>;
  setActiveChannel: (id: string | null) => void;
  createChannel: (spaceId: string, name: string, topic?: string, categoryId?: string) => Promise<Channel>;
  createCategory: (spaceId: string, name: string) => Promise<void>;
  fetchUnreads: (spaceId: string) => Promise<void>;
  markRead: (spaceId: string, channelId: string, messageId: string) => Promise<void>;
  updateChannel: (spaceId: string, channelId: string, data: { name?: string; topic?: string; type?: string }) => Promise<void>;
  deleteChannel: (spaceId: string, channelId: string) => Promise<void>;
  updateCategory: (spaceId: string, categoryId: string, data: { name?: string }) => Promise<void>;
  deleteCategory: (spaceId: string, categoryId: string) => Promise<void>;
  reorderChannels: (spaceId: string, items: { channelId: string; position: number; categoryId?: string | null }[]) => Promise<void>;
  reorderCategories: (spaceId: string, items: { categoryId: string; position: number }[]) => Promise<void>;
  fetchMuted: (spaceId: string) => Promise<void>;
  toggleMute: (spaceId: string, channelId: string) => Promise<void>;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  categories: [],
  activeChannelId: null,
  unreads: {},
  mutedChannels: new Set<string>(),
  loading: false,

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

  createChannel: async (spaceId, name, topic, categoryId) => {
    const channel = await api<Channel>(`/spaces/${spaceId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, topic, categoryId }),
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
}));
