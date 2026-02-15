import { create } from 'zustand';
import { api, setTokens, clearTokens, getSavedRefreshToken } from '../lib/api.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import { useNotificationsStore } from './notifications.js';
import { useMutesStore } from './mutes.js';
import { usePreferencesStore } from './preferences.js';
import type { User, MfaChallengeResponse } from '@crabac/shared';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (login: string, password: string) => Promise<MfaChallengeResponse | undefined>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  updateProfile: (data: { displayName?: string; baseColor?: string | null; accentColor?: string | null }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  setStatus: (status: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  login: async (login, password) => {
    set({ error: null });
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      if (data.mfaRequired) {
        return data as MfaChallengeResponse;
      }
      setTokens(data.accessToken, data.refreshToken);
      connectSocket();
      set({ user: data.user, error: null });
      // Initialize notification count, mutes, and preferences
      useNotificationsStore.getState().fetchUnreadCount();
      useMutesStore.getState().fetchMutes();
      usePreferencesStore.getState().fetchPreferences();
      return undefined;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  register: async (email, username, displayName, password) => {
    set({ error: null });
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, displayName, password }),
      });
      setTokens(data.accessToken, data.refreshToken);
      set({ user: data.user, error: null });
      // Don't connect socket yet — user needs to verify email
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  logout: async () => {
    const rt = getSavedRefreshToken();
    if (rt) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {
        // ignore
      }
    }
    clearTokens();
    disconnectSocket();
    set({ user: null });
  },

  restore: async () => {
    const rt = getSavedRefreshToken();
    if (!rt) {
      set({ loading: false });
      return;
    }

    try {
      const tokens = await api('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      });
      setTokens(tokens.accessToken, tokens.refreshToken);

      const user = await api('/users/me');
      connectSocket();
      set({ user, loading: false });
      // Initialize notification count, mutes, and preferences
      useNotificationsStore.getState().fetchUnreadCount();
      useMutesStore.getState().fetchMutes();
      usePreferencesStore.getState().fetchPreferences();
    } catch (err: any) {
      // Only clear tokens if the server explicitly rejected them
      // Don't clear on network errors or transient failures
      if (err?.status === 401 || err?.status === 403) {
        clearTokens();
      }
      set({ loading: false });
    }
  },

  updateProfile: async (data) => {
    const user = await api<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    // Preserve locally-managed status (presence is handled via socket, not REST)
    set((s) => ({ user: { ...user, status: s.user?.status ?? user.status } }));
  },

  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const user = await api<User>('/users/me/avatar', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type — browser will set multipart boundary
    });
    set((s) => ({ user: { ...user, status: s.user?.status ?? user.status } }));
  },

  setStatus: (status) => {
    set((s) => (s.user ? { user: { ...s.user, status: status as User['status'] } } : {}));
  },
}));
