import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../../lib/api.js';
import { usePreferencesStore } from '../../stores/preferences.js';
import { formatDistance, formatElevation } from '../../lib/units.js';
import type { PersonalGalleryItem, PersonalRouteItem, PersonalEvent } from '@crabac/shared';

interface Props {
  type: 'gallery' | 'routes' | 'events';
  onSelect: (itemIds: string[]) => void;
  onClose: () => void;
  multiSelect?: boolean;
}

export function PersonalCollectionPicker({ type, onSelect, onClose, multiSelect = true }: Props) {
  const units = usePreferencesStore((s) => s.preferences.distanceUnits);
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoint = type === 'events'
      ? '/users/me/collections/events?limit=50'
      : `/users/me/collections/${type}?limit=50`;

    api<any[]>(endpoint)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [type]);

  const toggleItem = (id: string) => {
    if (multiSelect) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      onSelect([id]);
    }
  };

  const handleConfirm = () => {
    if (selected.size > 0) {
      onSelect([...selected]);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {type === 'gallery' ? 'My Photos' : type === 'routes' ? 'My Routes' : 'My Events'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {loading && <div style={styles.empty}>Loading...</div>}
          {!loading && items.length === 0 && (
            <div style={styles.empty}>
              No {type === 'gallery' ? 'photos' : type} in your personal collection yet.
            </div>
          )}

          {type === 'gallery' && (
            <div style={styles.photoGrid}>
              {(items as PersonalGalleryItem[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    ...styles.photoItem,
                    outline: selected.has(item.id) ? '3px solid var(--accent)' : 'none',
                  }}
                >
                  {item.attachments[0] && (
                    <img src={item.attachments[0].url} alt="" style={styles.photoThumb} />
                  )}
                  {selected.has(item.id) && (
                    <div style={styles.checkOverlay}>
                      <Check size={20} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {type === 'routes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(items as PersonalRouteItem[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    ...styles.listItem,
                    background: selected.has(item.id) ? 'var(--hover)' : 'transparent',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.distanceKm != null && formatDistance(item.distanceKm, units)}
                      {item.elevationGainM != null && ` · ${formatElevation(item.elevationGainM, units)}`}
                    </div>
                  </div>
                  {selected.has(item.id) && <Check size={16} color="var(--accent)" />}
                </button>
              ))}
            </div>
          )}

          {type === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(items as PersonalEvent[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  style={{
                    ...styles.listItem,
                    background: selected.has(item.id) ? 'var(--hover)' : 'transparent',
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
                  {selected.has(item.id) && <Check size={16} color="var(--accent)" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {multiSelect && (
          <div style={styles.footer}>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              style={{
                ...styles.confirmBtn,
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              Add Selected ({selected.size})
            </button>
          </div>
        )}
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
    maxWidth: 480,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
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
