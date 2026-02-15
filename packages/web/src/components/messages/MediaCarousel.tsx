import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Attachment } from '@crabac/shared';

interface Props {
  attachments: Attachment[];
  startIndex: number;
  onClose: () => void;
}

export function MediaCarousel({ attachments, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const count = attachments.length;
  const att = attachments[index];

  const goNext = useCallback(() => {
    setIndex((i) => (i < count - 1 ? i + 1 : i));
  }, [count]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, goNext, goPrev]);

  // Touch swipe support
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

  const openInNewTab = () => {
    window.open(att.url, '_blank');
  };

  if (!att) return null;
  const isVideo = att.mimeType.startsWith('video/');

  return (
    <div
      style={carouselStyles.overlay}
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button style={carouselStyles.closeBtn} onClick={onClose}>
        <X size={24} />
      </button>

      {/* Previous arrow */}
      {index > 0 && (
        <button
          style={{ ...carouselStyles.navBtn, left: 16 }}
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Media content */}
      <div style={carouselStyles.content} onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            key={att.id}
            src={att.url}
            controls
            autoPlay
            style={carouselStyles.media}
            onClick={openInNewTab}
          />
        ) : (
          <img
            key={att.id}
            src={att.url}
            alt={att.originalName}
            style={carouselStyles.media}
            onClick={openInNewTab}
          />
        )}
        <div style={carouselStyles.hint}>Click to open in new tab</div>
      </div>

      {/* Next arrow */}
      {index < count - 1 && (
        <button
          style={{ ...carouselStyles.navBtn, right: 16 }}
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Counter */}
      {count > 1 && (
        <div style={carouselStyles.counter}>
          {index + 1} / {count}
        </div>
      )}
    </div>
  );
}

const carouselStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.9)',
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    maxWidth: '90vw',
    maxHeight: '80vh',
  },
  media: {
    maxWidth: '90vw',
    maxHeight: '80vh',
    objectFit: 'contain',
    borderRadius: 4,
    cursor: 'pointer',
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.75rem',
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
