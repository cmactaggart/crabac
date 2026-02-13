import { create } from 'zustand';
import { boardApi } from '../lib/boardApi.js';

interface BoardUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  accountType: 'board';
}

interface BoardAuthState {
  user: BoardUser | null;
  loading: boolean;

  register: (data: {
    spaceSlug: string;
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;

  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => void;
}

export const useBoardAuthStore = create<BoardAuthState>((set) => ({
  user: null,
  loading: false,

  register: async (data) => {
    const result = await boardApi<{ user: BoardUser; accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) },
    );
    localStorage.setItem('boardToken', result.accessToken);
    localStorage.setItem('boardRefreshToken', result.refreshToken);
    localStorage.setItem('boardUser', JSON.stringify(result.user));
    set({ user: result.user });
  },

  login: async (login, password) => {
    const result = await boardApi<{ user: BoardUser; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ login, password }) },
    );
    localStorage.setItem('boardToken', result.accessToken);
    localStorage.setItem('boardRefreshToken', result.refreshToken);
    localStorage.setItem('boardUser', JSON.stringify(result.user));
    set({ user: result.user });
  },

  logout: () => {
    localStorage.removeItem('boardToken');
    localStorage.removeItem('boardRefreshToken');
    localStorage.removeItem('boardUser');
    set({ user: null });
  },

  restore: () => {
    const stored = localStorage.getItem('boardUser');
    if (stored) {
      try {
        set({ user: JSON.parse(stored) });
      } catch {
        localStorage.removeItem('boardUser');
      }
    }
  },
}));

// Auto-restore on module load
useBoardAuthStore.getState().restore();
