import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { GalleryItem } from '@crabac/shared';

interface Props {
  item: GalleryItem;
  initialIndex?: number;
  canDelete: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export function GalleryItemDetail({ item, initialIndex = 0, canDelete, onDelete, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = item.attachments.length;
  const att = item.attachments[index];

  const goNext = useCallback(() => {
    setIndex((i) => (i < count - 1 ? i + 1 : i));
  }, [count]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

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

  const timeAgo = formatTimeAgo(item.createdAt);

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button style={styles.closeBtn} onClick={onClose}>
        <X size={24} />
      </button>

      {index > 0 && (
        <button
          style={{ ...styles.navBtn, left: 16 }}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <div style={styles.centerColumn} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mediaWrap}>
          {isVideo ? (
            <video
              key={att.id}
              src={att.url}
              controls
              autoPlay
              style={styles.media}
            />
          ) : (
            <img
              key={att.id}
              src={att.url}
              alt={item.caption || att.originalName}
              style={styles.media}
            />
          )}
        </div>

        <div style={styles.infoPanel}>
          {item.caption && (
            <p style={styles.caption}>{item.caption}</p>
          )}
          <div style={styles.meta}>
            <span style={styles.author}>
              Uploaded by <strong>{item.author?.displayName || 'Unknown'}</strong>
            </span>
            <span style={styles.date}>{timeAgo}</span>
          </div>
          {canDelete && (
            <div style={styles.actions}>
              {confirmDelete ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--danger, #ed4245)' }}>Delete this item?</span>
                  <button onClick={onDelete} style={styles.confirmBtn}>Yes, delete</button>
                  <button onClick={() => setConfirmDelete(false)} style={styles.cancelDeleteBtn}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} style={styles.deleteBtn}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {index < count - 1 && (
        <button
          style={{ ...styles.navBtn, right: 16 }}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {count > 1 && (
        <div style={styles.counter}>
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.92)',
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
    color: 'white',
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
    color: 'white',
    borderRadius: '50%',
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  mediaWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: '70vh',
  },
  media: {
    maxWidth: '85vw',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: 6,
  },
  infoPanel: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  caption: {
    color: '#fff',
    fontSize: '0.95rem',
    margin: 0,
    lineHeight: 1.4,
  },
  meta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  author: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8rem',
  },
  date: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.75rem',
  },
  actions: {
    marginTop: 4,
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    background: 'rgba(237, 66, 69, 0.2)',
    border: '1px solid rgba(237, 66, 69, 0.4)',
    color: '#ed4245',
    borderRadius: 'var(--radius, 6px)',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  confirmBtn: {
    padding: '4px 10px',
    background: '#ed4245',
    border: 'none',
    color: '#fff',
    borderRadius: 'var(--radius, 6px)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  cancelDeleteBtn: {
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    borderRadius: 'var(--radius, 6px)',
    cursor: 'pointer',
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
