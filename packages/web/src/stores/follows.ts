import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { FollowUser, FollowCounts } from '@crabac/shared';

interface FollowsState {
  counts: FollowCounts;
  followers: FollowUser[];
  following: FollowUser[];
  fetchCounts: (userId: string) => Promise<void>;
  fetchFollowers: (userId: string) => Promise<void>;
  fetchFollowing: (userId: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  getFollowStatus: (userId: string) => Promise<{ isFollowing: boolean; isFriend: boolean }>;
}

export const useFollowsStore = create<FollowsState>((set) => ({
  counts: { followingCount: 0, followerCount: 0 },
  followers: [],
  following: [],

  fetchCounts: async (userId: string) => {
    try {
      const counts = await api<FollowCounts>(`/follows/counts/${userId}`);
      set({ counts });
    } catch {}
  },

  fetchFollowers: async (userId: string) => {
    try {
      const followers = await api<FollowUser[]>(`/follows/${userId}/followers`);
      set({ followers });
    } catch {}
  },

  fetchFollowing: async (userId: string) => {
    try {
      const following = await api<FollowUser[]>(`/follows/${userId}/following`);
      set({ following });
    } catch {}
  },

  followUser: async (userId: string) => {
    await api(`/follows/${userId}`, { method: 'POST' });
  },

  unfollowUser: async (userId: string) => {
    await api(`/follows/${userId}`, { method: 'DELETE' });
  },

  getFollowStatus: async (userId: string) => {
    try {
      return await api<{ isFollowing: boolean; isFriend: boolean }>(`/follows/status/${userId}`);
    } catch {
      return { isFollowing: false, isFriend: false };
    }
  },
}));
