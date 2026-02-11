import { create } from 'zustand';
import { api } from '../lib/api.js';

interface MutesState {
  mutedUserIds: Set<string>;
  fetchMutes: () => Promise<void>;
  muteUser: (userId: string) => Promise<void>;
  unmuteUser: (userId: string) => Promise<void>;
  isMuted: (userId: string) => boolean;
}

export const useMutesStore = create<MutesState>((set, get) => ({
  mutedUserIds: new Set(),

  fetchMutes: async () => {
    try {
      const ids = await api<string[]>('/users/mutes');
      set({ mutedUserIds: new Set(ids) });
    } catch {
      // ignore
    }
  },

  muteUser: async (userId) => {
    await api(`/users/mutes/${userId}`, { method: 'PUT' });
    set((s) => {
      const next = new Set(s.mutedUserIds);
      next.add(userId);
      return { mutedUserIds: next };
    });
  },

  unmuteUser: async (userId) => {
    await api(`/users/mutes/${userId}`, { method: 'DELETE' });
    set((s) => {
      const next = new Set(s.mutedUserIds);
      next.delete(userId);
      return { mutedUserIds: next };
    });
  },

  isMuted: (userId) => {
    return get().mutedUserIds.has(userId);
  },
}));
