import { useState, useEffect, useCallback, useRef } from 'react';
import { ImagePlus, Grid3x3, Layers, Image } from 'lucide-react';
import { getSocket } from '../../lib/socket.js';
import { api } from '../../lib/api.js';
import { Permissions, hasPermission, combinePermissions } from '@crabac/shared';
import type { Channel, GalleryItem, GalleryAttachment, Role } from '@crabac/shared';
import { useAuthStore } from '../../stores/auth.js';
import { useSpacesStore } from '../../stores/spaces.js';
import { GalleryItemDetail } from './GalleryItemDetail.js';
import { GalleryUploadModal } from './GalleryUploadModal.js';

type ViewMode = 'grouped' | 'all';

interface Props {
  channelId: string;
  channel: Channel | null;
  spaceId: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function GalleryChannelView({ channelId, channel, spaceId, showBackButton, onBack }: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const scrollRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const spaces = useSpacesStore((s) => s.spaces);
  const members = useSpacesStore((s) => s.members);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    api<Role[]>(`/spaces/${spaceId}/roles`).then(setRoles).catch(() => {});
  }, [spaceId]);

  const userPerms = (() => {
    if (!user) return 0n;
    const space = spaces.find((s) => s.id === spaceId);
    if (space?.ownerId === user.id) return combinePermissions(...Object.values(Permissions));
    const member = members.find((m) => m.userId === user.id);
    if (!member?.roles?.length) {
      const defaultRole = roles.find((r: any) => r.isDefault);
      return defaultRole ? BigInt(defaultRole.permissions) : 0n;
    }
    return combinePermissions(
      ...member.roles.map((r) => {
        const full = roles.find((fr: any) => fr.id === r.id);
        return full ? BigInt(full.permissions) : 0n;
      }),
    );
  })();

  const canUpload = hasPermission(userPerms, Permissions.SEND_MESSAGES) && hasPermission(userPerms, Permissions.ATTACH_FILES);
  const canManage = hasPermission(userPerms, Permissions.MANAGE_MESSAGES);

  const fetchItems = useCallback(async (before?: string) => {
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (before) params.set('before', before);
      const data = await api<GalleryItem[]>(`/channels/${channelId}/gallery?${params}`);
      if (before) {
        setItems((prev) => [...prev, ...data]);
      } else {
        setItems(data);
      }
      setHasMore(data.length >= 30);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setHasMore(true);
    fetchItems();
  }, [channelId, fetchItems]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('channel:join', { channelId });

    const onItemCreated = (item: GalleryItem) => {
      setItems((prev) => [item, ...prev]);
    };
    const onItemDeleted = ({ itemId }: { itemId: string }) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedItem((sel) => sel?.id === itemId ? null : sel);
    };

    socket.on('gallery:item_created', onItemCreated);
    socket.on('gallery:item_deleted', onItemDeleted);

    return () => {
      socket.emit('channel:leave', { channelId });
      socket.off('gallery:item_created', onItemCreated);
      socket.off('gallery:item_deleted', onItemDeleted);
    };
  }, [channelId]);

  const handleLoadMore = () => {
    if (!hasMore || loading || items.length === 0) return;
    fetchItems(items[items.length - 1].id);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      handleLoadMore();
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await api(`/channels/${channelId}/gallery/${itemId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedItem(null);
    } catch {
      // ignore
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    // Refetch to get the latest items
    setLoading(true);
    fetchItems();
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {showBackButton && onBack && (
          <button onClick={onBack} style={styles.backBtn}>Back</button>
        )}
        <div style={styles.headerInfo}>
          <Grid3x3 size={20} style={{ color: 'var(--text-muted)' }} />
          <h3 style={styles.channelName}>{channel?.name || 'Gallery'}</h3>
          {channel?.topic && (
            <span style={styles.topic}>{channel.topic}</span>
          )}
        </div>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('grouped')}
            style={{
              ...styles.toggleBtn,
              background: viewMode === 'grouped' ? 'var(--hover)' : 'transparent',
              color: viewMode === 'grouped' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            title="Grouped by upload"
          >
            <Layers size={15} />
          </button>
          <button
            onClick={() => setViewMode('all')}
            style={{
              ...styles.toggleBtn,
              background: viewMode === 'all' ? 'var(--hover)' : 'transparent',
              color: viewMode === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            title="All photos"
          >
            <Image size={15} />
          </button>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(true)} style={styles.uploadBtn}>
            <ImagePlus size={16} />
            Add Media
          </button>
        )}
      </div>

      <div style={styles.content} ref={scrollRef} onScroll={handleScroll}>
        {loading && items.length === 0 ? (
          <div style={styles.placeholder}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={styles.placeholder}>
            <Grid3x3 size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>
              No media yet. {canUpload ? 'Click "Add Media" to upload.' : ''}
            </p>
          </div>
        ) : viewMode === 'grouped' ? (
          <div style={styles.grid}>
            {items.map((item) => {
              const cover = item.attachments[0];
              if (!cover) return null;
              const isVideo = cover.mimeType.startsWith('video/');
              return (
                <button
                  key={item.id}
                  style={styles.cell}
                  onClick={() => { setSelectedItem(item); setSelectedAttachmentIndex(0); }}
                >
                  {isVideo ? (
                    <video
                      src={cover.url}
                      style={styles.thumbnail}
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={cover.url}
                      alt={item.caption || ''}
                      style={styles.thumbnail}
                      loading="lazy"
                    />
                  )}
                  {item.attachments.length > 1 && (
                    <div style={styles.countBadge}>
                      {item.attachments.length}
                    </div>
                  )}
                  {item.caption && (
                    <div style={styles.captionOverlay}>
                      {item.caption.length > 60 ? item.caption.slice(0, 60) + '...' : item.caption}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={styles.grid}>
            {items.flatMap((item) =>
              item.attachments.map((att, attIdx) => {
                const isVideo = att.mimeType.startsWith('video/');
                return (
                  <button
                    key={att.id}
                    style={styles.cell}
                    onClick={() => { setSelectedItem(item); setSelectedAttachmentIndex(attIdx); }}
                  >
                    {isVideo ? (
                      <video
                        src={att.url}
                        style={styles.thumbnail}
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={att.url}
                        alt={item.caption || ''}
                        style={styles.thumbnail}
                        loading="lazy"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedItem && (
        <GalleryItemDetail
          item={selectedItem}
          initialIndex={selectedAttachmentIndex}
          canDelete={
            selectedItem.authorId === user?.id || canManage
          }
          onDelete={() => handleDelete(selectedItem.id)}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {showUpload && (
        <GalleryUploadModal
          channelId={channelId}
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius)',
    fontSize: '0.85rem',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  channelName: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  topic: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  viewToggle: {
    display: 'flex',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius)',
    padding: 2,
    gap: 1,
    flexShrink: 0,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'background 0.15s, color 0.15s',
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    background: 'var(--accent)',
    border: 'none',
    color: 'white',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 8,
  },
  cell: {
    position: 'relative',
    aspectRatio: '1',
    border: 'none',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    background: 'var(--bg-tertiary)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 8,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 8px 6px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
    color: '#fff',
    fontSize: '0.75rem',
    lineHeight: '1.3',
  },
};
