import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { EligibleSpace } from '@gud/shared';

interface PortalsState {
  eligibleSpaces: EligibleSpace[];
  loading: boolean;
  error: string | null;
  fetchEligibleSpaces: (channelId: string) => Promise<void>;
  createPortal: (sourceSpaceId: string, channelId: string, targetSpaceId: string) => Promise<void>;
  submitPortalInvite: (sourceSpaceId: string, channelId: string, targetSpaceId: string) => Promise<void>;
  acceptInvite: (spaceId: string, inviteId: string) => Promise<void>;
  rejectInvite: (spaceId: string, inviteId: string) => Promise<void>;
}

export const usePortalsStore = create<PortalsState>((set) => ({
  eligibleSpaces: [],
  loading: false,
  error: null,

  fetchEligibleSpaces: async (channelId) => {
    set({ loading: true, error: null });
    try {
      const spaces = await api<EligibleSpace[]>(`/portals/eligible-spaces/${channelId}`);
      set({ eligibleSpaces: spaces, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load eligible spaces', loading: false });
    }
  },

  createPortal: async (sourceSpaceId, channelId, targetSpaceId) => {
    await api(`/spaces/${sourceSpaceId}/portals`, {
      method: 'POST',
      body: JSON.stringify({ channelId, targetSpaceId }),
    });
  },

  submitPortalInvite: async (sourceSpaceId, channelId, targetSpaceId) => {
    await api(`/spaces/${sourceSpaceId}/portal-invites`, {
      method: 'POST',
      body: JSON.stringify({ channelId, targetSpaceId }),
    });
  },

  acceptInvite: async (spaceId, inviteId) => {
    await api(`/spaces/${spaceId}/portal-invites/${inviteId}/accept`, { method: 'POST' });
  },

  rejectInvite: async (spaceId, inviteId) => {
    await api(`/spaces/${spaceId}/portal-invites/${inviteId}/reject`, { method: 'POST' });
  },
}));
