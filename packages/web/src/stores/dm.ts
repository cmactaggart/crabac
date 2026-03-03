import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Conversation, DirectMessage, Reaction } from '@crabac/shared';

interface DMState {
  conversations: Conversation[];
  messageRequests: Conversation[];
  activeConversationId: string | null;
  messages: DirectMessage[];
  loading: boolean;
  hasMore: boolean;
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;
  dmUnreads: Record<string, number>; // conversationId → unread count

  fetchConversations: () => Promise<void>;
  fetchMessageRequests: () => Promise<void>;
  fetchDMUnreads: () => Promise<void>;
  markDMRead: (conversationId: string, messageId: string) => Promise<void>;
  incrementUnread: (conversationId: string) => void;
  acceptMessageRequest: (conversationId: string) => Promise<void>;
  declineMessageRequest: (conversationId: string) => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  createConversation: (userId: string) => Promise<Conversation>;
  createGroupDM: (participantIds: string[], name?: string) => Promise<Conversation>;
  addMembers: (conversationId: string, userIds: string[]) => Promise<Conversation>;
  leaveGroup: (conversationId: string) => Promise<void>;
  renameGroup: (conversationId: string, name: string) => Promise<void>;
  fetchMessages: (conversationId: string, before?: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  sendMessageWithFiles: (conversationId: string, content: string, files: File[]) => Promise<void>;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  toggleReaction: (conversationId: string, messageId: string, emoji: string, hasReacted: boolean) => void;
  updateReactions: (messageId: string, reactions: Reaction[]) => void;
  addMessage: (message: DirectMessage) => void;
  updateMessage: (message: DirectMessage) => void;
  removeMessage: (messageId: string) => void;
  setTyping: (userId: string, username: string) => void;
  clearTyping: (userId: string) => void;
  clearMessages: () => void;
  handleConversationCreated: (conversation: Conversation) => void;
  handleConversationUpdated: (conversation: Conversation) => void;
  handleMemberLeft: (payload: { conversationId: string; userId: string }) => void;
}

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  messageRequests: [],
  activeConversationId: null,
  messages: [],
  loading: false,
  hasMore: true,
  typingUsers: new Map(),
  dmUnreads: {},

  fetchDMUnreads: async () => {
    try {
      const unreads = await api<Record<string, number>>('/conversations/unreads');
      set({ dmUnreads: unreads });
    } catch {
      // ignore
    }
  },

  markDMRead: async (conversationId, messageId) => {
    // Optimistic: clear unread for this conversation
    set((s) => {
      const next = { ...s.dmUnreads };
      delete next[conversationId];
      return { dmUnreads: next };
    });
    try {
      await api(`/conversations/${conversationId}/read`, {
        method: 'PUT',
        body: JSON.stringify({ messageId }),
      });
    } catch {
      // ignore
    }
  },

  incrementUnread: (conversationId) => {
    set((s) => ({
      dmUnreads: {
        ...s.dmUnreads,
        [conversationId]: (s.dmUnreads[conversationId] || 0) + 1,
      },
    }));
  },

  fetchConversations: async () => {
    try {
      const conversations = await api<Conversation[]>('/conversations');
      set({ conversations });
    } catch {
      // ignore
    }
  },

  fetchMessageRequests: async () => {
    try {
      const messageRequests = await api<Conversation[]>('/conversations/requests');
      set({ messageRequests });
    } catch {
      // ignore
    }
  },

  acceptMessageRequest: async (conversationId) => {
    const conversation = await api<Conversation>(`/conversations/${conversationId}/accept`, {
      method: 'POST',
    });
    set((s) => ({
      messageRequests: s.messageRequests.filter((r) => r.id !== conversationId),
      conversations: [conversation, ...s.conversations],
    }));
  },

  declineMessageRequest: async (conversationId) => {
    await api(`/conversations/${conversationId}/decline`, { method: 'POST' });
    set((s) => ({
      messageRequests: s.messageRequests.filter((r) => r.id !== conversationId),
    }));
  },

  openConversation: async (conversationId) => {
    set({ activeConversationId: conversationId, messages: [], hasMore: true });
    await get().fetchMessages(conversationId);
    // Mark as read using the latest message
    const msgs = get().messages;
    if (msgs.length > 0) {
      get().markDMRead(conversationId, msgs[msgs.length - 1].id);
    }
  },

  createConversation: async (userId) => {
    const conversation = await api<Conversation>(`/conversations/with/${userId}`, {
      method: 'POST',
    });
    // Add to list if not already there
    set((s) => {
      if (s.conversations.some((c) => c.id === conversation.id)) return s;
      return { conversations: [conversation, ...s.conversations] };
    });
    return conversation;
  },

  createGroupDM: async (participantIds, name) => {
    const conversation = await api<Conversation>('/conversations/groups', {
      method: 'POST',
      body: JSON.stringify({ participantIds, name }),
    });
    set((s) => {
      if (s.conversations.some((c) => c.id === conversation.id)) return s;
      return { conversations: [conversation, ...s.conversations] };
    });
    return conversation;
  },

  addMembers: async (conversationId, userIds) => {
    const conversation = await api<Conversation>(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conversationId ? conversation : c)),
    }));
    return conversation;
  },

  leaveGroup: async (conversationId) => {
    await api(`/conversations/${conversationId}/members/me`, { method: 'DELETE' });
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== conversationId),
    }));
  },

  renameGroup: async (conversationId, name) => {
    const conversation = await api<Conversation>(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conversationId ? conversation : c)),
    }));
  },

  fetchMessages: async (conversationId, before) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const msgs = await api<DirectMessage[]>(`/conversations/${conversationId}/messages?${params}`);
      set((s) => ({
        messages: before ? [...msgs, ...s.messages] : msgs,
        loading: false,
        hasMore: msgs.length === 50,
      }));
    } catch {
      set({ loading: false });
    }
  },

  sendMessage: async (conversationId, content) => {
    const message = await api<DirectMessage>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    // Add immediately from REST response (addMessage deduplicates by ID if socket echo arrives)
    get().addMessage(message);
  },

  sendMessageWithFiles: async (conversationId, content, files) => {
    const formData = new FormData();
    formData.append('content', content);
    files.forEach((file) => formData.append('files', file));
    const message = await api<DirectMessage>(`/conversations/${conversationId}/messages/upload`, {
      method: 'POST',
      body: formData,
    });
    get().addMessage(message);
  },

  editMessage: async (conversationId, messageId, content) => {
    await api(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  deleteMessage: async (conversationId, messageId) => {
    await api(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  toggleReaction: async (conversationId, messageId, emoji, hasReacted) => {
    const method = hasReacted ? 'DELETE' : 'PUT';
    try {
      await api(`/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method });
    } catch {
      // ignore
    }
  },

  updateReactions: (messageId, reactions) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m,
      ),
    }));
  },

  addMessage: (message) => {
    const state = get();
    const isActiveConv = message.conversationId === state.activeConversationId;

    if (isActiveConv) {
      set((s) => {
        if (s.messages.some((m) => m.id === message.id)) return s;
        return { messages: [...s.messages, message] };
      });
      // Auto-mark read when message arrives in the active conversation
      get().markDMRead(message.conversationId, message.id);
    }
    // Note: unread increments for non-active convos handled by useDMUnreadSocket

    // Update conversation list (bump to top with last message)
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === message.conversationId ? { ...c, lastMessage: message, updatedAt: new Date().toISOString() } : c,
      ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    }));
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

  clearMessages: () => set({ messages: [], hasMore: true, activeConversationId: null }),

  handleConversationCreated: (conversation) => {
    set((s) => {
      if (s.conversations.some((c) => c.id === conversation.id)) return s;
      return { conversations: [conversation, ...s.conversations] };
    });
  },

  handleConversationUpdated: (conversation) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === conversation.id ? conversation : c)),
    }));
  },

  handleMemberLeft: (payload) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== payload.conversationId) return c;
        return {
          ...c,
          participants: c.participants.filter((p) => p.id !== payload.userId),
        };
      }),
    }));
  },
}));
