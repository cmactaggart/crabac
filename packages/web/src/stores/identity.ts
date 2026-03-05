import { create } from 'zustand';
import { api } from '../lib/api.js';

interface ManagedSpace {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  baseColor?: string | null;
  accentColor?: string | null;
}

interface IdentityState {
  activeSpaceId: string | null;
  managedSpaces: ManagedSpace[];
  loading: boolean;

  setActiveSpace: (spaceId: string | null) => void;
  fetchManagedSpaces: () => Promise<void>;
}

export const useIdentityStore = create<IdentityState>((set) => ({
  activeSpaceId: null,
  managedSpaces: [],
  loading: false,

  setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId }),

  fetchManagedSpaces: async () => {
    set({ loading: true });
    try {
      const spaces = await api<ManagedSpace[]>('/users/me/managed-social-spaces');
      set({ managedSpaces: spaces, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
