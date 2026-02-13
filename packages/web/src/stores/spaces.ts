import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { Space, SpaceMember } from '@crabac/shared';

interface SpacesState {
  spaces: Space[];
  activeSpaceId: string | null;
  members: SpaceMember[];
  loading: boolean;
  fetchSpaces: () => Promise<void>;
  setActiveSpace: (id: string | null) => void;
  fetchMembers: (spaceId: string) => Promise<void>;
  createSpace: (name: string, slug: string, description?: string) => Promise<Space>;
  joinSpace: (spaceId: string, code: string) => Promise<void>;
  updateSpace: (spaceId: string, data: { name?: string; description?: string }) => Promise<void>;
  uploadSpaceIcon: (spaceId: string, file: File) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  kickMember: (spaceId: string, userId: string) => Promise<void>;
  setMemberRoles: (spaceId: string, userId: string, roleIds: string[]) => Promise<void>;
  updateMemberStatus: (userId: string, status: string) => void;
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: [],
  activeSpaceId: null,
  members: [],
  loading: false,

  fetchSpaces: async () => {
    set({ loading: true });
    try {
      const spaces = await api<Space[]>('/spaces');
      set({ spaces, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveSpace: (id) => {
    set({ activeSpaceId: id, members: [] });
    if (id) get().fetchMembers(id);
  },

  fetchMembers: async (spaceId) => {
    try {
      const members = await api<SpaceMember[]>(`/spaces/${spaceId}/members`);
      set({ members });
    } catch {
      // ignore
    }
  },

  createSpace: async (name, slug, description) => {
    const space = await api<Space>('/spaces', {
      method: 'POST',
      body: JSON.stringify({ name, slug, description }),
    });
    set((s) => ({ spaces: [...s.spaces, space] }));
    return space;
  },

  joinSpace: async (spaceId, code) => {
    const space = await api<Space>(`/spaces/${spaceId}/join`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    set((s) => ({ spaces: [...s.spaces, space] }));
  },

  updateSpace: async (spaceId, data) => {
    const updated = await api<Space>(`/spaces/${spaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    set((s) => ({ spaces: s.spaces.map((sp) => (sp.id === spaceId ? updated : sp)) }));
  },

  uploadSpaceIcon: async (spaceId, file) => {
    const form = new FormData();
    form.append('icon', file);
    const updated = await api<Space>(`/spaces/${spaceId}/icon`, {
      method: 'POST',
      body: form,
    });
    set((s) => ({ spaces: s.spaces.map((sp) => (sp.id === spaceId ? updated : sp)) }));
  },

  deleteSpace: async (spaceId) => {
    await api(`/spaces/${spaceId}`, { method: 'DELETE' });
    set((s) => ({
      spaces: s.spaces.filter((sp) => sp.id !== spaceId),
      activeSpaceId: s.activeSpaceId === spaceId ? null : s.activeSpaceId,
    }));
  },

  kickMember: async (spaceId, userId) => {
    await api(`/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' });
    set((s) => ({ members: s.members.filter((m) => m.userId !== userId) }));
  },

  setMemberRoles: async (spaceId, userId, roleIds) => {
    await api(`/spaces/${spaceId}/members/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
    set((s) => ({
      members: s.members.map((m) =>
        m.userId === userId ? { ...m, roles: roleIds.map((id) => ({ id, name: '', color: null, position: 0 })) } : m,
      ),
    }));
  },

  updateMemberStatus: (userId, status) => {
    set((s) => ({
      members: s.members.map((m) =>
        m.userId === userId && m.user ? { ...m, user: { ...m.user, status } } : m,
      ),
    }));
  },
}));
