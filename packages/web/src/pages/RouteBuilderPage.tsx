import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePreferencesStore } from '../stores/preferences.js';
import { usePersonalCollectionsStore } from '../stores/personalCollections.js';
import { api } from '../lib/api.js';
import { RouteBuilderModal } from '../components/route-builder/RouteBuilderModal.js';
import type { PersonalVisibility } from '@crabac/shared';

export function RouteBuilderPage() {
  const navigate = useNavigate();
  const defaultVisibility = usePreferencesStore((s) => s.preferences.defaultVisibility) || 'private';
  const { routeItems, fetchRoutes } = usePersonalCollectionsStore();

  useEffect(() => {
    if (routeItems.length === 0) fetchRoutes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    navigate('/you?tab=activities&subtab=routes');
  };

  const handleSave = async (file: File, name: string, data: { description?: string; visibility: string; activityType?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    if (data.description) form.append('description', data.description);
    if (data.visibility) form.append('visibility', data.visibility);
    if (data.activityType) form.append('activityType', data.activityType);
    await api('/users/me/collections/routes/upload', { method: 'POST', body: form });
  };

  return (
    <RouteBuilderModal
      onClose={handleClose}
      onSave={handleSave}
      defaultVisibility={defaultVisibility as PersonalVisibility}
      availableRoutes={routeItems}
    />
  );
}
