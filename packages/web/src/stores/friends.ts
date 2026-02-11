import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { FriendListItem, FriendshipStatus } from '@gud/shared';

interface FriendsState {
  friends: FriendListItem[];
  pendingRequests: FriendListItem[];
  sentRequests: FriendListItem[];

  fetchFriends: () => Promise<void>;
  fetchPendingRequests: () => Promise<void>;
  fetchSentRequests: () => Promise<void>;
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  getFriendshipStatus: (userId: string) => Promise<FriendshipStatus | null>;

  // Socket handlers
  handleRequestReceived: (payload: { friendshipId: string; user: any }) => void;
  handleAccepted: (payload: { friendshipId: string; user: any }) => void;
  handleRemoved: (payload: { userId: string }) => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  sentRequests: [],

  fetchFriends: async () => {
    try {
      const friends = await api<FriendListItem[]>('/friends');
      set({ friends });
    } catch {
      // ignore
    }
  },

  fetchPendingRequests: async () => {
    try {
      const pendingRequests = await api<FriendListItem[]>('/friends/requests/pending');
      set({ pendingRequests });
    } catch {
      // ignore
    }
  },

  fetchSentRequests: async () => {
    try {
      const sentRequests = await api<FriendListItem[]>('/friends/requests/sent');
      set({ sentRequests });
    } catch {
      // ignore
    }
  },

  sendFriendRequest: async (userId) => {
    await api('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    await get().fetchSentRequests();
  },

  acceptFriendRequest: async (friendshipId) => {
    await api(`/friends/requests/${friendshipId}/accept`, { method: 'POST' });
    await Promise.all([get().fetchFriends(), get().fetchPendingRequests()]);
  },

  declineFriendRequest: async (friendshipId) => {
    await api(`/friends/requests/${friendshipId}/decline`, { method: 'POST' });
    await get().fetchPendingRequests();
  },

  removeFriend: async (friendshipId) => {
    await api(`/friends/${friendshipId}`, { method: 'DELETE' });
    await get().fetchFriends();
  },

  getFriendshipStatus: async (userId) => {
    try {
      return await api<FriendshipStatus | null>(`/friends/status/${userId}`);
    } catch {
      return null;
    }
  },

  handleRequestReceived: (payload) => {
    set((s) => {
      if (s.pendingRequests.some((r) => r.id === payload.friendshipId)) return s;
      return {
        pendingRequests: [
          ...s.pendingRequests,
          {
            id: payload.friendshipId,
            user: payload.user,
            status: 'pending',
            direction: 'received',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  },

  handleAccepted: (payload) => {
    set((s) => ({
      sentRequests: s.sentRequests.filter((r) => r.id !== payload.friendshipId),
      friends: [
        ...s.friends,
        {
          id: payload.friendshipId,
          user: payload.user,
          status: 'accepted',
          direction: 'sent',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },

  handleRemoved: (payload) => {
    set((s) => ({
      friends: s.friends.filter((f) => f.user?.id !== payload.userId),
    }));
  },
}));
