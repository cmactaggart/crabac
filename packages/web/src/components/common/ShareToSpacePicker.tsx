import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { useSpacesStore } from '../../stores/spaces.js';
import { usePersonalCollectionsStore } from '../../stores/personalCollections.js';
import { api } from '../../lib/api.js';
import type { Channel, Space } from '@crabac/shared';

interface Props {
  contentType: 'gallery' | 'route' | 'event' | 'post';
  itemId: string;
  onClose: () => void;
  onShared: () => void;
}

export function ShareToSpacePicker({ contentType, itemId, onClose, onShared }: Props) {
  const spaces = useSpacesStore((s) => s.spaces);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { copyGalleryToChannel, copyRouteToChannel, copyEventToSpace, sharePostToChannel } = usePersonalCollectionsStore();

  const channelType = contentType === 'gallery' ? 'media_gallery' : contentType === 'route' ? 'route_library' : 'text';

  useEffect(() => {
    if (selectedSpace) {
      api<Channel[]>(`/spaces/${selectedSpace.id}/channels`)
        .then((chs) => setChannels(chs.filter((c) => c.type === channelType)))
        .catch(() => setChannels([]));
    }
  }, [selectedSpace, channelType]);

  const handleShareToChannel = async (channelId: string) => {
    if (!selectedSpace) return;
    setSharing(true);
    setError('');
    try {
      if (contentType === 'gallery') {
        await copyGalleryToChannel(itemId, channelId);
      } else if (contentType === 'route') {
        await copyRouteToChannel(itemId, channelId);
      } else if (contentType === 'post') {
        await sharePostToChannel(itemId, channelId);
      } else if (contentType === 'event') {
        await copyEventToSpace(itemId, selectedSpace.id, channelId);
      }
      setSuccess(true);
      setTimeout(() => onShared(), 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to share');
    }
    setSharing(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {success ? 'Shared!' : selectedSpace ? `Share to ${selectedSpace.name}` : 'Share to Space'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--success, #43b581)' }}>
              Successfully shared to space!
            </div>
          ) : !selectedSpace ? (
            // Space list
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {spaces.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
                  No spaces available
                </div>
              )}
              {spaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => setSelectedSpace(space)}
                  style={styles.listItem}
                  disabled={sharing}
                >
                  <span style={{ fontWeight: 600 }}>{space.name}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            // Channel list within space
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => { setSelectedSpace(null); setChannels([]); }}
                style={{ ...styles.listItem, color: 'var(--text-muted)', fontSize: '0.8rem' }}
              >
                Back to spaces
              </button>
              {channels.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>
                  No {contentType === 'gallery' ? 'gallery' : contentType === 'route' ? 'route library' : 'text'} channels found
                </div>
              )}
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleShareToChannel(ch.id)}
                  style={styles.listItem}
                  disabled={sharing}
                >
                  <span># {ch.name}</span>
                </button>
              ))}
            </div>
          )}
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
    maxWidth: 400,
    maxHeight: '60vh',
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
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  error: {
    background: 'rgba(237, 66, 69, 0.15)',
    color: 'var(--danger)',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius)',
    fontSize: '0.8rem',
    marginBottom: 8,
  },
};
