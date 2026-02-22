import { create } from 'zustand';
import { api } from '../lib/api.js';
import type {
  PersonalGalleryItem,
  PersonalRouteItem,
  PersonalEvent,
  PersonalEventCategory,
  UserCollectionsSummary,
  UserPost,
  UserPostComment,
} from '@crabac/shared';

interface PersonalCollectionsState {
  galleryItems: PersonalGalleryItem[];
  routeItems: PersonalRouteItem[];
  events: PersonalEvent[];
  eventCategories: PersonalEventCategory[];
  posts: UserPost[];
  postsLoading: boolean;
  postsHasMore: boolean;
  summary: UserCollectionsSummary | null;
  loading: boolean;

  fetchSummary: () => Promise<void>;
  fetchGallery: (opts?: { before?: string }) => Promise<void>;
  fetchRoutes: (opts?: { before?: string }) => Promise<void>;
  fetchEvents: (opts?: { from?: string; to?: string }) => Promise<void>;
  fetchEventCategories: () => Promise<void>;
  fetchPosts: (opts?: { before?: string }) => Promise<void>;

  uploadGalleryItem: (files: File[], caption?: string, visibility?: string) => Promise<void>;
  uploadRoute: (file: File, name: string, data?: { description?: string; visibility?: string; activityType?: string }) => Promise<void>;
  createEvent: (data: Record<string, any>) => Promise<void>;
  createEventCategory: (data: { name: string; color?: string }) => Promise<PersonalEventCategory>;
  deleteEventCategory: (categoryId: string) => Promise<void>;
  createPost: (formData: FormData) => Promise<void>;

  updateGalleryItem: (itemId: string, data: Record<string, any>) => Promise<void>;
  updateRoute: (itemId: string, data: Record<string, any>) => Promise<void>;
  updateEvent: (eventId: string, data: Record<string, any>) => Promise<void>;
  updatePost: (postId: string, data: Record<string, any>) => Promise<void>;

  deleteGalleryItem: (itemId: string) => Promise<void>;
  deleteRoute: (itemId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;

  copyGalleryToChannel: (itemId: string, channelId: string) => Promise<any>;
  copyRouteToChannel: (itemId: string, channelId: string) => Promise<any>;
  copyEventToSpace: (eventId: string, spaceId: string) => Promise<any>;

  // Post reactions
  togglePostReaction: (postId: string, emoji: string, hasReacted: boolean, userId?: string) => Promise<void>;

  // Comments
  fetchComments: (postId: string, opts?: { before?: string; userId?: string }) => Promise<UserPostComment[]>;
  addComment: (postId: string, body: string, userId?: string) => Promise<UserPostComment>;
  deleteComment: (postId: string, commentId: string, userId?: string) => Promise<void>;

  // Comment reactions
  toggleCommentReaction: (commentId: string, emoji: string, hasReacted: boolean) => Promise<any>;

  // Repost
  createRepost: (originalPostId: string, visibility: string, body?: string | null) => Promise<UserPost>;

  // Share to channel
  sharePostToChannel: (postId: string, channelId: string, content?: string) => Promise<any>;
}

export const usePersonalCollectionsStore = create<PersonalCollectionsState>((set, get) => ({
  galleryItems: [],
  routeItems: [],
  events: [],
  eventCategories: [],
  posts: [],
  postsLoading: false,
  postsHasMore: true,
  summary: null,
  loading: false,

  fetchSummary: async () => {
    try {
      const summary = await api<UserCollectionsSummary>('/users/me/collections/summary');
      set({ summary });
    } catch {}
  },

  fetchGallery: async (opts) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (opts?.before) params.set('before', opts.before);
      params.set('limit', '30');
      const items = await api<PersonalGalleryItem[]>(`/users/me/collections/gallery?${params}`);
      if (opts?.before) {
        set((s) => ({ galleryItems: [...s.galleryItems, ...items], loading: false }));
      } else {
        set({ galleryItems: items, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchRoutes: async (opts) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (opts?.before) params.set('before', opts.before);
      params.set('limit', '30');
      const items = await api<PersonalRouteItem[]>(`/users/me/collections/routes?${params}`);
      if (opts?.before) {
        set((s) => ({ routeItems: [...s.routeItems, ...items], loading: false }));
      } else {
        set({ routeItems: items, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchEvents: async (opts) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (opts?.from) params.set('from', opts.from);
      if (opts?.to) params.set('to', opts.to);
      params.set('limit', '50');
      const items = await api<PersonalEvent[]>(`/users/me/collections/events?${params}`);
      set({ events: items, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchEventCategories: async () => {
    try {
      const categories = await api<PersonalEventCategory[]>('/users/me/collections/events/categories');
      set({ eventCategories: categories });
    } catch {}
  },

  fetchPosts: async (opts) => {
    set({ postsLoading: true });
    try {
      const params = new URLSearchParams();
      if (opts?.before) params.set('before', opts.before);
      params.set('limit', '20');
      const items = await api<UserPost[]>(`/users/me/posts?${params}`);
      if (opts?.before) {
        set((s) => ({ posts: [...s.posts, ...items], postsLoading: false, postsHasMore: items.length >= 20 }));
      } else {
        set({ posts: items, postsLoading: false, postsHasMore: items.length >= 20 });
      }
    } catch {
      set({ postsLoading: false });
    }
  },

  createEventCategory: async (data) => {
    const category = await api<PersonalEventCategory>('/users/me/collections/events/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ eventCategories: [...s.eventCategories, category] }));
    return category;
  },

  deleteEventCategory: async (categoryId) => {
    await api(`/users/me/collections/events/categories/${categoryId}`, { method: 'DELETE' });
    set((s) => ({ eventCategories: s.eventCategories.filter((c) => c.id !== categoryId) }));
  },

  uploadGalleryItem: async (files, caption, visibility) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (caption) formData.append('caption', caption);
    if (visibility) formData.append('visibility', visibility);
    const item = await api<PersonalGalleryItem>('/users/me/collections/gallery/upload', {
      method: 'POST',
      body: formData,
    });
    set((s) => ({ galleryItems: [item, ...s.galleryItems] }));
    get().fetchSummary();
  },

  uploadRoute: async (file, name, data) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (data?.description) formData.append('description', data.description);
    if (data?.visibility) formData.append('visibility', data.visibility);
    if (data?.activityType) formData.append('activityType', data.activityType);
    const item = await api<PersonalRouteItem>('/users/me/collections/routes/upload', {
      method: 'POST',
      body: formData,
    });
    set((s) => ({ routeItems: [item, ...s.routeItems] }));
    get().fetchSummary();
  },

  createEvent: async (data) => {
    const event = await api<PersonalEvent>('/users/me/collections/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ events: [event, ...s.events] }));
    get().fetchSummary();
  },

  createPost: async (formData) => {
    const post = await api<UserPost>('/users/me/posts', {
      method: 'POST',
      body: formData,
    });
    set((s) => ({ posts: [post, ...s.posts] }));
    get().fetchSummary();
  },

  updateGalleryItem: async (itemId, data) => {
    const item = await api<PersonalGalleryItem>(`/users/me/collections/gallery/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      galleryItems: s.galleryItems.map((i) => (i.id === itemId ? item : i)),
    }));
  },

  updateRoute: async (itemId, data) => {
    const item = await api<PersonalRouteItem>(`/users/me/collections/routes/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      routeItems: s.routeItems.map((i) => (i.id === itemId ? item : i)),
    }));
  },

  updateEvent: async (eventId, data) => {
    const event = await api<PersonalEvent>(`/users/me/collections/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      events: s.events.map((e) => (e.id === eventId ? event : e)),
    }));
  },

  updatePost: async (postId, data) => {
    const post = await api<UserPost>(`/users/me/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      posts: s.posts.map((p) => (p.id === postId ? post : p)),
    }));
  },

  deleteGalleryItem: async (itemId) => {
    await api(`/users/me/collections/gallery/${itemId}`, { method: 'DELETE' });
    set((s) => ({
      galleryItems: s.galleryItems.filter((i) => i.id !== itemId),
    }));
    get().fetchSummary();
  },

  deleteRoute: async (itemId) => {
    await api(`/users/me/collections/routes/${itemId}`, { method: 'DELETE' });
    set((s) => ({
      routeItems: s.routeItems.filter((i) => i.id !== itemId),
    }));
    get().fetchSummary();
  },

  deleteEvent: async (eventId) => {
    await api(`/users/me/collections/events/${eventId}`, { method: 'DELETE' });
    set((s) => ({
      events: s.events.filter((e) => e.id !== eventId),
    }));
    get().fetchSummary();
  },

  deletePost: async (postId) => {
    await api(`/users/me/posts/${postId}`, { method: 'DELETE' });
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== postId),
    }));
    get().fetchSummary();
  },

  copyGalleryToChannel: async (itemId, channelId) => {
    return api(`/users/me/collections/gallery/${itemId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    });
  },

  copyRouteToChannel: async (itemId, channelId) => {
    return api(`/users/me/collections/routes/${itemId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    });
  },

  copyEventToSpace: async (eventId, spaceId) => {
    return api(`/users/me/collections/events/${eventId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ spaceId }),
    });
  },

  // Post reactions
  togglePostReaction: async (postId, emoji, hasReacted, userId) => {
    const prefix = userId ? `/users/${userId}` : '/users/me';
    const method = hasReacted ? 'DELETE' : 'PUT';
    const reactions = await api(`${prefix}/posts/${postId}/reactions/${encodeURIComponent(emoji)}`, { method });
    // Update the post in local state
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, reactions: reactions as any } : p,
      ),
    }));
  },

  // Comments
  fetchComments: async (postId, opts) => {
    const prefix = opts?.userId ? `/users/${opts.userId}` : '/users/me';
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    params.set('limit', '30');
    return api<UserPostComment[]>(`${prefix}/posts/${postId}/comments?${params}`);
  },

  addComment: async (postId, body, userId) => {
    const prefix = userId ? `/users/${userId}` : '/users/me';
    const comment = await api<UserPostComment>(`${prefix}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    // Increment commentCount in local state
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    }));
    return comment;
  },

  deleteComment: async (postId, commentId, userId) => {
    const prefix = userId ? `/users/${userId}` : '/users/me';
    await api(`${prefix}/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    // Decrement commentCount in local state
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p,
      ),
    }));
  },

  // Comment reactions
  toggleCommentReaction: async (commentId, emoji, hasReacted) => {
    const method = hasReacted ? 'DELETE' : 'PUT';
    return api(`/users/posts/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`, { method });
  },

  // Repost
  createRepost: async (originalPostId, visibility, body) => {
    const post = await api<UserPost>('/users/me/posts/repost', {
      method: 'POST',
      body: JSON.stringify({ originalPostId, visibility, body: body || null }),
    });
    set((s) => ({ posts: [post, ...s.posts] }));
    get().fetchSummary();
    return post;
  },

  // Share to channel
  sharePostToChannel: async (postId, channelId, content) => {
    return api(`/users/me/posts/${postId}/share-to-channel`, {
      method: 'POST',
      body: JSON.stringify({ channelId, content }),
    });
  },
}));
