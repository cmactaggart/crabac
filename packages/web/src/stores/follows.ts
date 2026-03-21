import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { FollowUser, FollowCounts, FollowStatus } from '@crabac/shared';

interface FollowsState {
  counts: FollowCounts;
  followers: FollowUser[];
  following: FollowUser[];
  pendingRequests: FollowUser[];
  sentRequests: FollowUser[];
  fetchCounts: (userId: string) => Promise<void>;
  fetchFollowers: (userId: string) => Promise<void>;
  fetchFollowing: (userId: string) => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchSentRequests: () => Promise<void>;
  followUser: (userId: string) => Promise<{ status: 'accepted' | 'pending' }>;
  unfollowUser: (userId: string) => Promise<void>;
  acceptFollowRequest: (followerId: string) => Promise<void>;
  declineFollowRequest: (followerId: string) => Promise<void>;
  removeFollower: (followerId: string) => Promise<void>;
  getFollowStatus: (userId: string) => Promise<FollowStatus>;

  // Socket handlers
  handleRequestReceived: (payload: { user: any }) => void;
  handleAccepted: (payload: { user: any }) => void;
  handleNewFollower: (payload: { user: any }) => void;
}

export const useFollowsStore = create<FollowsState>((set, get) => ({
  counts: { followingCount: 0, followerCount: 0 },
  followers: [],
  following: [],
  pendingRequests: [],
  sentRequests: [],

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

  fetchPendingRequests: async () => {
    try {
      const pendingRequests = await api<FollowUser[]>('/follows/requests/pending');
      set({ pendingRequests });
    } catch {}
  },

  fetchSentRequests: async () => {
    try {
      const sentRequests = await api<FollowUser[]>('/follows/requests/sent');
      set({ sentRequests });
    } catch {}
  },

  followUser: async (userId: string) => {
    const result = await api<{ status: 'accepted' | 'pending' }>(`/follows/${userId}`, { method: 'POST' });
    if (result.status === 'pending') {
      await get().fetchSentRequests();
    }
    return result;
  },

  unfollowUser: async (userId: string) => {
    await api(`/follows/${userId}`, { method: 'DELETE' });
  },

  acceptFollowRequest: async (followerId: string) => {
    await api(`/follows/requests/${followerId}/accept`, { method: 'POST' });
    await get().fetchPendingRequests();
  },

  declineFollowRequest: async (followerId: string) => {
    await api(`/follows/requests/${followerId}/decline`, { method: 'POST' });
    await get().fetchPendingRequests();
  },

  removeFollower: async (followerId: string) => {
    await api(`/follows/followers/${followerId}`, { method: 'DELETE' });
  },

  getFollowStatus: async (userId: string) => {
    try {
      return await api<FollowStatus>(`/follows/status/${userId}`);
    } catch {
      return { isFollowing: false, isFollowedBy: false, followRequestPending: false, incomingRequestPending: false };
    }
  },

  handleRequestReceived: (payload) => {
    set((s) => {
      if (s.pendingRequests.some((r) => r.id === payload.user.id)) return s;
      return {
        pendingRequests: [
          ...s.pendingRequests,
          {
            id: payload.user.id,
            username: payload.user.username,
            displayName: payload.user.displayName,
            avatarUrl: payload.user.avatarUrl,
            baseColor: payload.user.baseColor,
            accentColor: payload.user.accentColor,
          },
        ],
      };
    });
  },

  handleAccepted: (payload) => {
    set((s) => ({
      sentRequests: s.sentRequests.filter((r) => r.id !== payload.user.id),
    }));
  },

  handleNewFollower: (payload) => {
    set((s) => {
      if (s.followers.some((f) => f.id === payload.user.id)) return s;
      return {
        followers: [
          ...s.followers,
          {
            id: payload.user.id,
            username: payload.user.username,
            displayName: payload.user.displayName,
            avatarUrl: payload.user.avatarUrl,
            baseColor: payload.user.baseColor,
            accentColor: payload.user.accentColor,
          },
        ],
      };
    });
  },
}));
