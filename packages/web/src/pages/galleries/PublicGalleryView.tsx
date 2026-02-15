import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Layers, Image } from 'lucide-react';
import { boardApi } from '../../lib/boardApi.js';

type ViewMode = 'grouped' | 'all';

interface GalleryAttachment {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  position: number;
}

interface GalleryItem {
  id: string;
  caption: string | null;
  createdAt: string;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  attachments: GalleryAttachment[];
}

export function PublicGalleryView() {
  const { spaceSlug, channelName } = useParams();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (before?: string) => {
    if (!spaceSlug || !channelName) return;
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (before) params.set('before', before);
      const data = await boardApi<GalleryItem[]>(
        `/${spaceSlug}/${channelName}/gallery?${params}`,
      );
      if (before) {
        setItems((prev) => [...prev, ...data]);
      } else {
        setItems(data);
      }
      setHasMore(data.length >= 30);
    } catch (err: any) {
      setError(err.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [spaceSlug, channelName]);

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setHasMore(true);
    fetchItems();
  }, [fetchItems]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasMore || loading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      if (items.length > 0) {
        fetchItems(items[items.length - 1].id);
      }
    }
  };

  const openLightbox = (item: GalleryItem, attachmentIndex = 0) => {
    setLightboxItem(item);
    setLightboxIndex(attachmentIndex);
  };

  if (loading && items.length === 0) return <div style={styles.status}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div>
      <div style={styles.topBar}>
        <div style={styles.breadcrumb}>
          <Link to={`/gallery/${spaceSlug}`} style={styles.breadcrumbLink}>Galleries</Link>
          <span style={{ color: '#999' }}>/</span>
          <span style={styles.breadcrumbCurrent}>{channelName}</span>
        </div>
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('grouped')}
            style={{
              ...styles.toggleBtn,
              background: viewMode === 'grouped' ? '#e5e7eb' : 'transparent',
              color: viewMode === 'grouped' ? '#111' : '#999',
            }}
            title="Grouped by upload"
          >
            <Layers size={15} />
          </button>
          <button
            onClick={() => setViewMode('all')}
            style={{
              ...styles.toggleBtn,
              background: viewMode === 'all' ? '#e5e7eb' : 'transparent',
              color: viewMode === 'all' ? '#111' : '#999',
            }}
            title="All photos"
          >
            <Image size={15} />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={styles.empty}>This gallery is empty</div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={styles.gridWrap}
        >
          {viewMode === 'grouped' ? (
            <div style={styles.grid}>
              {items.map((item) => {
                const cover = item.attachments[0];
                if (!cover) return null;
                const isVideo = cover.mimeType.startsWith('video/');
                return (
                  <button
                    key={item.id}
                    style={styles.cell}
                    onClick={() => openLightbox(item)}
                  >
                    {isVideo ? (
                      <video src={cover.url} style={styles.thumb} muted preload="metadata" />
                    ) : (
                      <img src={cover.url} alt={item.caption || ''} style={styles.thumb} loading="lazy" />
                    )}
                    {item.attachments.length > 1 && (
                      <div style={styles.badge}>{item.attachments.length}</div>
                    )}
                    {item.caption && (
                      <div style={styles.captionOverlay}>
                        {item.caption.length > 50 ? item.caption.slice(0, 50) + '...' : item.caption}
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
                      onClick={() => openLightbox(item, attIdx)}
                    >
                      {isVideo ? (
                        <video src={att.url} style={styles.thumb} muted preload="metadata" />
                      ) : (
                        <img src={att.url} alt={item.caption || ''} style={styles.thumb} loading="lazy" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxItem(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  item,
  index,
  onIndexChange,
  onClose,
}: {
  item: GalleryItem;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = item.attachments.length;
  const att = item.attachments[index];
  const touchStartX = useRef<number | null>(null);

  const goNext = useCallback(() => onIndexChange(Math.min(index + 1, count - 1)), [index, count, onIndexChange]);
  const goPrev = useCallback(() => onIndexChange(Math.max(index - 1, 0)), [index, onIndexChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  if (!att) return null;
  const isVideo = att.mimeType.startsWith('video/');

  return (
    <div
      style={lbStyles.overlay}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button style={lbStyles.closeBtn} onClick={onClose}><X size={24} /></button>

      {index > 0 && (
        <button style={{ ...lbStyles.navBtn, left: 16 }} onClick={(e) => { e.stopPropagation(); goPrev(); }}>
          <ChevronLeft size={28} />
        </button>
      )}

      <div style={lbStyles.center} onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video key={att.id} src={att.url} controls autoPlay style={lbStyles.media} />
        ) : (
          <img key={att.id} src={att.url} alt={item.caption || ''} style={lbStyles.media} />
        )}

        <div style={lbStyles.info}>
          {item.caption && <p style={lbStyles.caption}>{item.caption}</p>}
          <div style={lbStyles.meta}>
            <span>By <strong>{item.author?.displayName || 'Unknown'}</strong></span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {index < count - 1 && (
        <button style={{ ...lbStyles.navBtn, right: 16 }} onClick={(e) => { e.stopPropagation(); goNext(); }}>
          <ChevronRight size={28} />
        </button>
      )}

      {count > 1 && (
        <div style={lbStyles.counter}>{index + 1} / {count}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  status: { textAlign: 'center', padding: 40, color: '#999' },
  error: { textAlign: 'center', padding: 40, color: '#c53030' },
  empty: { textAlign: 'center', padding: 40, color: '#999', fontSize: '0.9rem' },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  viewToggle: {
    display: 'flex',
    background: '#f3f4f6',
    borderRadius: 6,
    padding: 2,
    gap: 1,
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 5,
    cursor: 'pointer',
    padding: '5px 9px',
    transition: 'background 0.15s, color 0.15s',
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.85rem',
  },
  breadcrumbLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
  },
  breadcrumbCurrent: {
    color: '#333',
    fontWeight: 600,
  },
  gridWrap: {
    maxHeight: 'calc(100vh - 180px)',
    overflowY: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 10,
  },
  cell: {
    position: 'relative',
    aspectRatio: '1',
    border: 'none',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    background: '#e5e7eb',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  badge: {
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
    padding: '14px 8px 6px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
    color: '#fff',
    fontSize: '0.72rem',
    lineHeight: 1.3,
  },
};

const lbStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    borderRadius: '50%',
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  media: {
    maxWidth: '85vw',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: 6,
  },
  info: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  caption: {
    color: '#fff',
    fontSize: '0.9rem',
    margin: 0,
    lineHeight: 1.4,
  },
  meta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.8rem',
  },
  counter: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9rem',
    fontWeight: 600,
    background: 'rgba(0,0,0,0.5)',
    padding: '4px 14px',
    borderRadius: 16,
  },
};
