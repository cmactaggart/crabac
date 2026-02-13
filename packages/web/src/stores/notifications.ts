import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Notification } from '@crabac/shared';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;

  fetchNotifications: (before?: string) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  hasMore: true,

  fetchNotifications: async (before) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (before) params.set('before', before);
      const items = await api<Notification[]>(`/notifications?${params}`);
      set((s) => ({
        notifications: before ? [...s.notifications, ...items] : items,
        loading: false,
        hasMore: items.length === 25,
      }));
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = await api<{ count: number }>('/notifications/unread-count');
      set({ unreadCount: count });
    } catch {
      // ignore
    }
  },

  markAsRead: async (id) => {
    await api(`/notifications/${id}/read`, { method: 'PUT' });
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    await api('/notifications/read-all', { method: 'PUT' });
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  addNotification: (notification) => {
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },
}));
