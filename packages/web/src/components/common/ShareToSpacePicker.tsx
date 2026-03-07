import { useState, useEffect } from 'react';
import { X, ChevronRight, MessageSquare, Hash } from 'lucide-react';
import { useSpacesStore } from '../../stores/spaces.js';
import { usePersonalCollectionsStore } from '../../stores/personalCollections.js';
import { useDMStore } from '../../stores/dm.js';
import { useAuthStore } from '../../stores/auth.js';
import { api } from '../../lib/api.js';
import type { Channel, Space, Conversation } from '@crabac/shared';

interface Props {
  contentType: 'gallery' | 'route' | 'event' | 'post';
  itemId: string;
  onClose: () => void;
  onShared: () => void;
  /** Custom share handler — if provided, called instead of default logic */
  onShareToChannel?: (channelId: string, spaceId: string) => Promise<void>;
  /** Custom DM share handler — if provided, called instead of default logic */
  onShareToDM?: (conversationId: string) => Promise<void>;
}

type Tab = 'spaces' | 'dms';

export function ShareToSpacePicker({ contentType, itemId, onClose, onShared, onShareToChannel: customShare, onShareToDM: customDMShare }: Props) {
  const spaces = useSpacesStore((s) => s.spaces);
  const conversations = useDMStore((s) => s.conversations);
  const fetchConversations = useDMStore((s) => s.fetchConversations);
  const sendMessage = useDMStore((s) => s.sendMessage);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('spaces');
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { copyGalleryToChannel, copyRouteToChannel, copyEventToSpace, sharePostToChannel } = usePersonalCollectionsStore();

  const channelType = contentType === 'gallery' ? 'media_gallery' : contentType === 'route' ? 'route_library' : 'text';

  useEffect(() => {
    if (tab === 'dms' && conversations.length === 0) {
      fetchConversations();
    }
  }, [tab]);

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
      if (customShare) {
        await customShare(channelId, selectedSpace.id);
      } else if (contentType === 'gallery') {
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

  const handleShareToDM = async (conversationId: string) => {
    setSharing(true);
    setError('');
    try {
      if (customDMShare) {
        await customDMShare(conversationId);
      } else if (contentType === 'post') {
        // Share post to DM — use the API to get the embed content
        await api(`/users/me/posts/${itemId}/share-to-dm`, {
          method: 'POST',
          body: JSON.stringify({ conversationId }),
        });
      } else if (contentType === 'event') {
        // Event sharing to DM — use the API
        await api(`/users/me/collections/events/${itemId}/share-to-dm`, {
          method: 'POST',
          body: JSON.stringify({ conversationId }),
        });
      } else if (contentType === 'gallery') {
        await api(`/users/me/collections/galleries/${itemId}/share-to-dm`, {
          method: 'POST',
          body: JSON.stringify({ conversationId }),
        });
      } else if (contentType === 'route') {
        await api(`/users/me/collections/routes/${itemId}/share-to-dm`, {
          method: 'POST',
          body: JSON.stringify({ conversationId }),
        });
      }
      setSuccess(true);
      setTimeout(() => onShared(), 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to share');
    }
    setSharing(false);
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const others = conv.participants.filter((p) => p.id !== user?.id);
    if (others.length === 0) return 'Saved Messages';
    return others.map((p) => p.displayName || p.username).join(', ');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>
            {success ? 'Shared!' : selectedSpace ? `Share to ${selectedSpace.name}` : 'Share'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {/* Tab bar */}
        {!success && !selectedSpace && (
          <div style={styles.tabBar}>
            <button
              onClick={() => setTab('spaces')}
              style={{ ...styles.tab, ...(tab === 'spaces' ? styles.tabActive : {}) }}
            >
              <Hash size={14} /> Spaces
            </button>
            <button
              onClick={() => setTab('dms')}
              style={{ ...styles.tab, ...(tab === 'dms' ? styles.tabActive : {}) }}
            >
              <MessageSquare size={14} /> DMs
            </button>
          </div>
        )}

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--success, #43b581)' }}>
              Successfully shared!
            </div>
          ) : tab === 'dms' ? (
            // DM conversations list
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conversations.length === 0 && (
                <div style={{ color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
                  No conversations
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleShareToDM(conv.id)}
                  style={styles.listItem}
                  disabled={sharing}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ConversationAvatar conv={conv} userId={user?.id} />
                    <span style={{ fontWeight: 600 }}>{getConversationName(conv)}</span>
                  </div>
                </button>
              ))}
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

function ConversationAvatar({ conv, userId }: { conv: Conversation; userId?: string }) {
  const others = conv.participants.filter((p) => p.id !== userId);
  const first = others[0];
  if (!first) return null;

  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: first.baseColor || 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0,
      overflow: 'hidden',
    }}>
      {first.avatarUrl ? (
        <img src={first.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (first.displayName || first.username).charAt(0).toUpperCase()
      )}
      {others.length > 1 && (
        <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '0.55rem', background: 'var(--bg-secondary)', borderRadius: 6, padding: '0 3px' }}>
          +{others.length - 1}
        </span>
      )}
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
    zIndex: 210,
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
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0.6rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottomColor: 'var(--accent)',
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
