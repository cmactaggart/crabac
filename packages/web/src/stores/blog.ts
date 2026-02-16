import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { BlogPost } from '@crabac/shared';

interface BlogState {
  posts: BlogPost[];
  selectedPost: BlogPost | null;
  loading: boolean;
  hasMore: boolean;

  fetchPosts: (spaceId: string) => Promise<void>;
  loadMore: (spaceId: string) => Promise<void>;
  createPost: (spaceId: string, data: { title: string; summary?: string | null; content: string; status?: string; isPublic?: boolean }) => Promise<BlogPost>;
  updatePost: (spaceId: string, postId: string, data: Partial<{ title: string; summary: string | null; content: string; status: string; isPublic: boolean }>) => Promise<BlogPost>;
  deletePost: (spaceId: string, postId: string) => Promise<void>;
  uploadImage: (spaceId: string, file: File) => Promise<string>;

  setSelectedPost: (post: BlogPost | null) => void;
  clear: () => void;
}

export const useBlogStore = create<BlogState>((set, get) => ({
  posts: [],
  selectedPost: null,
  loading: false,
  hasMore: true,

  fetchPosts: async (spaceId) => {
    set({ loading: true });
    try {
      const posts = await api<BlogPost[]>(`/spaces/${spaceId}/blog/posts?limit=20`);
      set({ posts, loading: false, hasMore: posts.length >= 20 });
    } catch {
      set({ loading: false });
    }
  },

  loadMore: async (spaceId) => {
    const { posts, hasMore, loading } = get();
    if (!hasMore || loading || posts.length === 0) return;
    set({ loading: true });
    try {
      const lastId = posts[posts.length - 1].id;
      const more = await api<BlogPost[]>(`/spaces/${spaceId}/blog/posts?limit=20&before=${lastId}`);
      set((s) => ({ posts: [...s.posts, ...more], loading: false, hasMore: more.length >= 20 }));
    } catch {
      set({ loading: false });
    }
  },

  createPost: async (spaceId, data) => {
    const post = await api<BlogPost>(`/spaces/${spaceId}/blog/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ posts: [post, ...s.posts] }));
    return post;
  },

  updatePost: async (spaceId, postId, data) => {
    const post = await api<BlogPost>(`/spaces/${spaceId}/blog/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({
      posts: s.posts.map((p) => (p.id === postId ? post : p)),
      selectedPost: s.selectedPost?.id === postId ? post : s.selectedPost,
    }));
    return post;
  },

  deletePost: async (spaceId, postId) => {
    await api(`/spaces/${spaceId}/blog/posts/${postId}`, { method: 'DELETE' });
    set((s) => ({
      posts: s.posts.filter((p) => p.id !== postId),
      selectedPost: s.selectedPost?.id === postId ? null : s.selectedPost,
    }));
  },

  uploadImage: async (spaceId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api<{ url: string }>(`/spaces/${spaceId}/blog/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return data.url;
  },

  setSelectedPost: (post) => set({ selectedPost: post }),
  clear: () => set({ posts: [], selectedPost: null, loading: false, hasMore: true }),
}));
