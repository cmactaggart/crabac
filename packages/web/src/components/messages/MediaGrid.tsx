import { Play } from 'lucide-react';
import type { Attachment } from '@crabac/shared';

interface Props {
  mediaAttachments: Attachment[];
  onMediaClick: (index: number) => void;
}

export function MediaGrid({ mediaAttachments, onMediaClick }: Props) {
  const count = mediaAttachments.length;
  if (count === 0) return null;

  // Single item — large inline
  if (count === 1) {
    const att = mediaAttachments[0];
    const isVideo = att.mimeType.startsWith('video/');
    return (
      <div style={gridStyles.container}>
        <div
          style={{ ...gridStyles.singleItem, cursor: 'pointer' }}
          onClick={() => onMediaClick(0)}
        >
          {isVideo ? (
            <div style={{ position: 'relative' }}>
              <video src={att.url} style={gridStyles.singleMedia} preload="metadata" />
              <div style={gridStyles.playOverlay}><Play size={28} fill="white" /></div>
            </div>
          ) : (
            <img src={att.url} alt={att.originalName} style={gridStyles.singleMedia} />
          )}
        </div>
      </div>
    );
  }

  // Determine grid layout
  let columns: number;
  let items = mediaAttachments;
  let overflowCount = 0;
  const maxVisible = 9;

  if (count === 2) columns = 2;
  else if (count <= 4) columns = 2;
  else columns = 3;

  if (count > maxVisible) {
    items = mediaAttachments.slice(0, maxVisible);
    overflowCount = count - maxVisible;
  }

  // For 3 items: first spans 2 columns
  const firstSpans = count === 3;

  return (
    <div style={gridStyles.container}>
      <div style={{
        ...gridStyles.grid,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}>
        {items.map((att, i) => {
          const isVideo = att.mimeType.startsWith('video/');
          const isOverflowCell = overflowCount > 0 && i === maxVisible - 1;
          const span = firstSpans && i === 0;

          return (
            <div
              key={att.id}
              style={{
                ...gridStyles.cell,
                gridColumn: span ? '1 / -1' : undefined,
                height: span ? 170 : 130,
                cursor: 'pointer',
              }}
              onClick={() => onMediaClick(i)}
            >
              {isVideo ? (
                <>
                  <video src={att.url} style={gridStyles.cellMedia} preload="metadata" />
                  <div style={gridStyles.playIcon}><Play size={18} fill="white" /></div>
                </>
              ) : (
                <img src={att.url} alt={att.originalName} style={gridStyles.cellMedia} />
              )}
              {isOverflowCell && (
                <div style={gridStyles.overflowOverlay}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>+{overflowCount}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const gridStyles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 400,
  },
  singleItem: {
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    position: 'relative',
  },
  singleMedia: {
    maxWidth: 400,
    maxHeight: 300,
    borderRadius: 'var(--radius)',
    display: 'block',
    objectFit: 'cover',
  },
  grid: {
    display: 'grid',
    gap: 3,
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
  },
  cell: {
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--bg-tertiary)',
  },
  cellMedia: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
  },
  playIcon: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    background: 'rgba(0,0,0,0.6)',
    borderRadius: '50%',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
};
