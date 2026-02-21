import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { UserBlocks } from '@crabac/shared';

interface BlocksState {
  blockedByMe: Set<string>;
  blockedMe: Set<string>;
  fetchBlocks: () => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  isBlockedByMe: (userId: string) => boolean;
}

export const useBlocksStore = create<BlocksState>((set, get) => ({
  blockedByMe: new Set(),
  blockedMe: new Set(),

  fetchBlocks: async () => {
    try {
      const data = await api<UserBlocks>('/users/blocks');
      set({
        blockedByMe: new Set(data.blockedByMe),
        blockedMe: new Set(data.blockedMe),
      });
    } catch {
      // ignore
    }
  },

  blockUser: async (userId) => {
    await api(`/users/blocks/${userId}`, { method: 'PUT' });
    set((s) => {
      const next = new Set(s.blockedByMe);
      next.add(userId);
      return { blockedByMe: next };
    });
  },

  unblockUser: async (userId) => {
    await api(`/users/blocks/${userId}`, { method: 'DELETE' });
    set((s) => {
      const next = new Set(s.blockedByMe);
      next.delete(userId);
      return { blockedByMe: next };
    });
  },

  isBlocked: (userId) => {
    const { blockedByMe, blockedMe } = get();
    return blockedByMe.has(userId) || blockedMe.has(userId);
  },

  isBlockedByMe: (userId) => {
    return get().blockedByMe.has(userId);
  },
}));
