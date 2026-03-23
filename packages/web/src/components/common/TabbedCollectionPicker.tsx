import { useState, useEffect } from 'react';
import { X, Check, Image, MapPin, Calendar } from 'lucide-react';
import { api } from '../../lib/api.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';
import type { PersonalGalleryItem, PersonalRouteItem, PersonalEvent } from '@crabac/shared';
import type { CalendarEvent } from '@crabac/shared';

type TabKey = 'photos' | 'routes' | 'events';

export interface CollectionPickerItem {
  type: 'gallery' | 'route' | 'event';
  id: string;
}

interface Props {
  spaceId?: string;
  onSelect: (items: CollectionPickerItem[]) => void;
  onClose: () => void;
}

const TABS: { key: TabKey; label: string; icon: typeof Image }[] = [
  { key: 'photos', label: 'Photos', icon: Image },
  { key: 'routes', label: 'Routes', icon: MapPin },
  { key: 'events', label: 'Events', icon: Calendar },
];

export function TabbedCollectionPicker({ spaceId, onSelect, onClose }: Props) {
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const [activeTab, setActiveTab] = useState<TabKey>('photos');

  const [photos, setPhotos] = useState<PersonalGalleryItem[]>([]);
  const [routes, setRoutes] = useState<PersonalRouteItem[]>([]);
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([]);
  const [spaceEvents, setSpaceEvents] = useState<CalendarEvent[]>([]);

  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Selections per tab, persisted across tab switches
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // Fetch photos
  useEffect(() => {
    setLoadingPhotos(true);
    api<PersonalGalleryItem[]>('/users/me/collections/gallery?limit=50')
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false));
  }, []);

  // Fetch routes
  useEffect(() => {
    setLoadingRoutes(true);
    api<PersonalRouteItem[]>('/users/me/collections/routes?limit=50')
      .then(setRoutes)
      .catch(() => setRoutes([]))
      .finally(() => setLoadingRoutes(false));
  }, []);

  // Fetch events (personal + space calendar)
  useEffect(() => {
    setLoadingEvents(true);
    const fetches: Promise<void>[] = [];

    fetches.push(
      api<PersonalEvent[]>('/users/me/collections/events?limit=50')
        .then(setPersonalEvents)
        .catch(() => setPersonalEvents([])),
    );

    if (spaceId) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      fetches.push(
        api<CalendarEvent[]>(`/spaces/${spaceId}/calendar/events?start=${start}&end=${end}`)
          .then(setSpaceEvents)
          .catch(() => setSpaceEvents([])),
      );
    }

    Promise.all(fetches).finally(() => setLoadingEvents(false));
  }, [spaceId]);

  const toggle = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = selectedPhotos.size + selectedRoutes.size + selectedEvents.size;

  const handleConfirm = () => {
    const items: CollectionPickerItem[] = [
      ...[...selectedPhotos].map((id) => ({ type: 'gallery' as const, id })),
      ...[...selectedRoutes].map((id) => ({ type: 'route' as const, id })),
      ...[...selectedEvents].map((id) => ({ type: 'event' as const, id })),
    ];
    if (items.length > 0) onSelect(items);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>From Collections</h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={styles.tabBar}>
          {TABS.map((tab) => {
            const count =
              tab.key === 'photos' ? selectedPhotos.size :
              tab.key === 'routes' ? selectedRoutes.size :
              selectedEvents.size;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Icon size={14} />
                {tab.label}
                {count > 0 && <span style={styles.badge}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {activeTab === 'photos' && (
            <>
              {loadingPhotos && <div style={styles.empty}>Loading...</div>}
              {!loadingPhotos && photos.length === 0 && (
                <div style={styles.empty}>No photos in your collection yet.</div>
              )}
              <div style={styles.photoGrid}>
                {photos.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(selectedPhotos, setSelectedPhotos, item.id)}
                    style={{
                      ...styles.photoItem,
                      outline: selectedPhotos.has(item.id) ? '3px solid var(--accent)' : 'none',
                    }}
                  >
                    {item.attachments[0] && (
                      <img src={item.attachments[0].url} alt="" style={styles.photoThumb} />
                    )}
                    {selectedPhotos.has(item.id) && (
                      <div style={styles.checkOverlay}>
                        <Check size={20} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'routes' && (
            <>
              {loadingRoutes && <div style={styles.empty}>Loading...</div>}
              {!loadingRoutes && routes.length === 0 && (
                <div style={styles.empty}>No routes in your collection yet.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {routes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(selectedRoutes, setSelectedRoutes, item.id)}
                    style={{
                      ...styles.listItem,
                      background: selectedRoutes.has(item.id) ? 'var(--hover)' : 'transparent',
                    }}
                  >
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.distanceKm != null && formatDistance(item.distanceKm, units)}
                        {item.elevationGainM != null && ` · ${formatElevation(item.elevationGainM, units)}`}
                      </div>
                    </div>
                    {selectedRoutes.has(item.id) && <Check size={16} color="var(--accent)" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'events' && (
            <>
              {loadingEvents && <div style={styles.empty}>Loading...</div>}
              {!loadingEvents && personalEvents.length === 0 && spaceEvents.length === 0 && (
                <div style={styles.empty}>No events found.</div>
              )}

              {personalEvents.length > 0 && (
                <>
                  <div style={styles.sectionLabel}>My Events</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {personalEvents.map((item) => (
                      <button
                        key={`pe-${item.id}`}
                        onClick={() => toggle(selectedEvents, setSelectedEvents, item.id)}
                        style={{
                          ...styles.listItem,
                          background: selectedEvents.has(item.id) ? 'var(--hover)' : 'transparent',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.eventDate}
                            {item.eventTime && ` at ${item.eventTime}`}
                            {item.location && ` · ${item.location}`}
                          </div>
                        </div>
                        {selectedEvents.has(item.id) && <Check size={16} color="var(--accent)" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {spaceEvents.length > 0 && (
                <>
                  <div style={{ ...styles.sectionLabel, marginTop: personalEvents.length > 0 ? 12 : 0 }}>Space Events</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {spaceEvents.map((item) => (
                      <button
                        key={`se-${item.id}`}
                        onClick={() => toggle(selectedEvents, setSelectedEvents, item.id)}
                        style={{
                          ...styles.listItem,
                          background: selectedEvents.has(item.id) ? 'var(--hover)' : 'transparent',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.eventDate}
                            {item.eventTime && ` at ${item.eventTime}`}
                            {item.location && ` · ${item.location}`}
                          </div>
                        </div>
                        {selectedEvents.has(item.id) && <Check size={16} color="var(--accent)" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            onClick={handleConfirm}
            disabled={totalSelected === 0}
            style={{
              ...styles.confirmBtn,
              opacity: totalSelected === 0 ? 0.5 : 1,
            }}
          >
            Add Selected ({totalSelected})
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 110,
  },
  modal: {
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius)',
    width: '100%',
    maxWidth: 520,
    maxHeight: '75vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem 0.5rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--border)',
    padding: '0 1.25rem',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0.6rem 1rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 10,
    padding: '1px 6px',
    minWidth: 16,
    textAlign: 'center' as const,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
  },
  footer: {
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    padding: '0.5rem 0.75rem 0.25rem',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: 6,
  },
  photoItem: {
    position: 'relative',
    border: 'none',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    background: 'var(--bg-tertiary)',
  },
  photoThumb: {
    width: '100%',
    aspectRatio: '1',
    objectFit: 'cover',
    display: 'block',
  },
  checkOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(88, 101, 242, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '0.5rem 1.25rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--accent)',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
};
