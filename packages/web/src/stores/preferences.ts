import { create } from 'zustand';
import { api } from '../lib/api.js';
import type { UserPreferences, DistanceUnits } from '@crabac/shared';

interface PreferencesState {
  preferences: UserPreferences;
  fetchPreferences: () => Promise<void>;
  updatePreferences: (data: Partial<UserPreferences>) => Promise<void>;
}

const DEFAULTS: UserPreferences = {
  distanceUnits: 'imperial',
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  preferences: { ...DEFAULTS },

  fetchPreferences: async () => {
    try {
      const prefs = await api<UserPreferences>('/users/preferences');
      set({ preferences: prefs });
    } catch {
      // keep defaults
    }
  },

  updatePreferences: async (data) => {
    const prev = get().preferences;
    // Optimistic update
    set({ preferences: { ...prev, ...data } });
    try {
      const prefs = await api<UserPreferences>('/users/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      set({ preferences: prefs });
    } catch {
      // Rollback
      set({ preferences: prev });
    }
  },
}));
