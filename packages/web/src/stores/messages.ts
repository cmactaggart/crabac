import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Message, Reaction, ThreadResponse, SearchResult } from '@gud/shared';

interface MessagesState {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;

  // Pins
  pinnedMessages: Message[];
  showPins: boolean;

  // Thread
  threadParent: Message | null;
  threadReplies: Message[];
  showThread: boolean;

  // Search
  searchResults: SearchResult[];
  searchQuery: string;
  showSearch: boolean;

  // Reply
  replyingTo: Message | null;

  // Actions
  fetchMessages: (channelId: string, before?: string) => Promise<void>;
  clearMessages: () => void;
  sendMessage: (channelId: string, content: string, replyToId?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  updateReactions: (messageId: string, reactions: Reaction[]) => void;
  setTyping: (userId: string, username: string) => void;
  clearTyping: (userId: string) => void;

  // Reactions
  toggleReaction: (channelId: string, messageId: string, emoji: string, hasReacted: boolean) => Promise<void>;

  // Pins
  fetchPins: (channelId: string) => Promise<void>;
  pinMessage: (channelId: string, messageId: string) => Promise<void>;
  unpinMessage: (channelId: string, messageId: string) => Promise<void>;
  togglePins: () => void;

  // Threads
  openThread: (channelId: string, messageId: string) => Promise<void>;
  closeThread: () => void;

  // Search
  search: (spaceId: string, query: string) => Promise<void>;
  toggleSearch: () => void;
  clearSearch: () => void;

  // Reply
  setReplyingTo: (message: Message | null) => void;

  // Edit / Delete
  editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string) => Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  loading: false,
  hasMore: true,
  typingUsers: new Map(),
  pinnedMessages: [],
  showPins: false,
  threadParent: null,
  threadReplies: [],
  showThread: false,
  searchResults: [],
  searchQuery: '',
  showSearch: false,
  replyingTo: null,

  fetchMessages: async (channelId, before) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const msgs = await api<Message[]>(`/channels/${channelId}/messages?${params}`);
      set((s) => ({
        messages: before ? [...msgs, ...s.messages] : msgs,
        loading: false,
        hasMore: msgs.length === 50,
      }));
    } catch {
      set({ loading: false });
    }
  },

  clearMessages: () => set({
    messages: [], hasMore: true, pinnedMessages: [], showPins: false,
    threadParent: null, threadReplies: [], showThread: false,
    searchResults: [], searchQuery: '', showSearch: false, replyingTo: null,
  }),

  sendMessage: async (channelId, content, replyToId) => {
    const message = await api<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId }),
    });
    // Add immediately from REST response; socket event will dedup via addMessage
    get().addMessage(message);
    set({ replyingTo: null });
  },

  addMessage: (message) => {
    set((s) => {
      const updates: Partial<MessagesState> = {};

      // Add to main message list if not already present
      if (!s.messages.some((m) => m.id === message.id)) {
        updates.messages = [...s.messages, message];
      }

      // If thread panel is open and this message is a reply to the thread parent, add to thread replies
      if (s.showThread && s.threadParent && message.replyToId === s.threadParent.id) {
        if (!s.threadReplies.some((r) => r.id === message.id)) {
          updates.threadReplies = [...s.threadReplies, message];
        }
      }

      // Update reply count on parent message in main list if this is a reply
      if (message.replyToId) {
        const msgList = updates.messages || s.messages;
        updates.messages = msgList.map((m) =>
          m.id === message.replyToId
            ? { ...m, replyCount: (m.replyCount || 0) + 1 }
            : m,
        );
      }

      return Object.keys(updates).length > 0 ? updates : s;
    });
  },

  updateMessage: (message) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === message.id ? message : m)),
    }));
  },

  removeMessage: (messageId) => {
    set((s) => ({
      messages: s.messages.filter((m) => m.id !== messageId),
    }));
  },

  updateReactions: (messageId, reactions) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m,
      ),
    }));
  },

  setTyping: (userId, username) => {
    set((s) => {
      const map = new Map(s.typingUsers);
      const existing = map.get(userId);
      if (existing) clearTimeout(existing.timeout);
      const timeout = setTimeout(() => get().clearTyping(userId), 3000);
      map.set(userId, { username, timeout });
      return { typingUsers: map };
    });
  },

  clearTyping: (userId) => {
    set((s) => {
      const map = new Map(s.typingUsers);
      const existing = map.get(userId);
      if (existing) clearTimeout(existing.timeout);
      map.delete(userId);
      return { typingUsers: map };
    });
  },

  // Reactions
  toggleReaction: async (channelId, messageId, emoji, hasReacted) => {
    const encoded = encodeURIComponent(emoji);
    let reactions: Reaction[];
    if (hasReacted) {
      reactions = await api<Reaction[]>(`/channels/${channelId}/messages/${messageId}/reactions/${encoded}`, { method: 'DELETE' });
    } else {
      reactions = await api<Reaction[]>(`/channels/${channelId}/messages/${messageId}/reactions/${encoded}`, { method: 'PUT' });
    }
    get().updateReactions(messageId, reactions);
  },

  // Pins
  fetchPins: async (channelId) => {
    const pins = await api<Message[]>(`/channels/${channelId}/pins`);
    set({ pinnedMessages: pins });
  },

  pinMessage: async (channelId, messageId) => {
    const message = await api<Message>(`/channels/${channelId}/messages/${messageId}/pin`, { method: 'PUT' });
    get().updateMessage(message);
  },

  unpinMessage: async (channelId, messageId) => {
    const message = await api<Message>(`/channels/${channelId}/messages/${messageId}/pin`, { method: 'DELETE' });
    get().updateMessage(message);
  },

  togglePins: () => set((s) => ({ showPins: !s.showPins, showThread: false, showSearch: false })),

  // Threads
  openThread: async (channelId, messageId) => {
    try {
      const thread = await api<ThreadResponse>(`/channels/${channelId}/messages/${messageId}/thread`);
      set({ threadParent: thread.parent, threadReplies: thread.replies, showThread: true, showPins: false, showSearch: false });
    } catch {
      // ignore
    }
  },

  closeThread: () => set({ showThread: false, threadParent: null, threadReplies: [] }),

  // Search
  search: async (spaceId, query) => {
    if (!query.trim()) { set({ searchResults: [], searchQuery: '' }); return; }
    set({ searchQuery: query });
    const results = await api<SearchResult[]>(`/spaces/${spaceId}/search?q=${encodeURIComponent(query)}&limit=25`);
    set({ searchResults: results });
  },

  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch, showPins: false, showThread: false })),
  clearSearch: () => set({ searchResults: [], searchQuery: '', showSearch: false }),

  // Reply
  setReplyingTo: (message) => set({ replyingTo: message }),

  // Edit / Delete
  editMessage: async (channelId, messageId, content) => {
    const message = await api<Message>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    get().updateMessage(message);
  },

  deleteMessage: async (channelId, messageId) => {
    await api(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    });
    get().removeMessage(messageId);
  },
}));
