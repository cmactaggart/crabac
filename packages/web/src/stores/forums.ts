import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { ForumThread, ForumThreadSummary, Message } from '@crabac/shared';

interface ForumsState {
  threads: ForumThreadSummary[];
  activeThread: ForumThread | null;
  threadPosts: Message[];
  loading: boolean;
  postsLoading: boolean;

  fetchThreads: (spaceId: string, channelId: string, options?: { before?: string; sort?: string }) => Promise<void>;
  createThread: (spaceId: string, channelId: string, data: { title: string; content: string }) => Promise<ForumThread>;
  getThread: (spaceId: string, channelId: string, threadId: string) => Promise<ForumThread>;
  setActiveThread: (thread: ForumThread | null) => void;

  fetchThreadPosts: (spaceId: string, channelId: string, threadId: string, options?: { before?: string }) => Promise<void>;
  createThreadPost: (spaceId: string, channelId: string, threadId: string, data: { content: string; replyToId?: string }) => Promise<Message>;

  updateThread: (spaceId: string, channelId: string, threadId: string, data: { title?: string; isPinned?: boolean; isLocked?: boolean }) => Promise<ForumThread>;
  deleteThread: (spaceId: string, channelId: string, threadId: string) => Promise<void>;

  addThread: (thread: ForumThreadSummary) => void;
  addPost: (post: Message) => void;
  updateThreadInList: (thread: ForumThread) => void;
  clearThreads: () => void;
}

export const useForumsStore = create<ForumsState>((set, get) => ({
  threads: [],
  activeThread: null,
  threadPosts: [],
  loading: false,
  postsLoading: false,

  fetchThreads: async (spaceId, channelId, options) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (options?.before) params.set('before', options.before);
      if (options?.sort) params.set('sort', options.sort);
      const qs = params.toString();
      const threads = await api<ForumThreadSummary[]>(
        `/spaces/${spaceId}/channels/${channelId}/threads${qs ? `?${qs}` : ''}`,
      );
      if (options?.before) {
        set((s) => ({ threads: [...s.threads, ...threads], loading: false }));
      } else {
        set({ threads, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  createThread: async (spaceId, channelId, data) => {
    const thread = await api<ForumThread>(
      `/spaces/${spaceId}/channels/${channelId}/threads`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    return thread;
  },

  getThread: async (spaceId, channelId, threadId) => {
    const thread = await api<ForumThread>(
      `/spaces/${spaceId}/channels/${channelId}/threads/${threadId}`,
    );
    set({ activeThread: thread });
    return thread;
  },

  setActiveThread: (thread) => set({ activeThread: thread, threadPosts: [] }),

  fetchThreadPosts: async (spaceId, channelId, threadId, options) => {
    set({ postsLoading: true });
    try {
      const params = new URLSearchParams();
      if (options?.before) params.set('before', options.before);
      const qs = params.toString();
      const posts = await api<Message[]>(
        `/spaces/${spaceId}/channels/${channelId}/threads/${threadId}/posts${qs ? `?${qs}` : ''}`,
      );
      if (options?.before) {
        set((s) => ({ threadPosts: [...posts, ...s.threadPosts], postsLoading: false }));
      } else {
        set({ threadPosts: posts, postsLoading: false });
      }
    } catch {
      set({ postsLoading: false });
    }
  },

  createThreadPost: async (spaceId, channelId, threadId, data) => {
    const post = await api<Message>(
      `/spaces/${spaceId}/channels/${channelId}/threads/${threadId}/posts`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    return post;
  },

  updateThread: async (spaceId, channelId, threadId, data) => {
    const thread = await api<ForumThread>(
      `/spaces/${spaceId}/channels/${channelId}/threads/${threadId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    );
    set((s) => ({
      activeThread: s.activeThread?.id === threadId ? thread : s.activeThread,
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, ...thread } : t)),
    }));
    return thread;
  },

  deleteThread: async (spaceId, channelId, threadId) => {
    await api(
      `/spaces/${spaceId}/channels/${channelId}/threads/${threadId}`,
      { method: 'DELETE' },
    );
    set((s) => ({
      threads: s.threads.filter((t) => t.id !== threadId),
      activeThread: s.activeThread?.id === threadId ? null : s.activeThread,
    }));
  },

  addThread: (thread) => {
    set((s) => {
      if (s.threads.some((t) => t.id === thread.id)) return s;
      return { threads: [thread, ...s.threads] };
    });
  },

  addPost: (post) => {
    set((s) => {
      if (s.threadPosts.some((p) => p.id === post.id)) return s;
      return { threadPosts: [...s.threadPosts, post] };
    });
  },

  updateThreadInList: (thread) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === thread.id ? { ...t, ...thread } : t)),
      activeThread: s.activeThread?.id === thread.id ? { ...s.activeThread, ...thread } : s.activeThread,
    }));
  },

  clearThreads: () => set({ threads: [], activeThread: null, threadPosts: [] }),
}));
