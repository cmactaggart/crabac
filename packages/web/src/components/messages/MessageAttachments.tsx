import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { Attachment, GpxTrackMetadata } from '@crabac/shared';
import { GpxPreviewCard } from './GpxPreviewCard.js';
import { MediaGrid } from './MediaGrid.js';
import { MediaCarousel } from './MediaCarousel.js';

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [carouselData, setCarouselData] = useState<{ attachments: Attachment[]; startIndex: number } | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const gpxAtts = attachments.filter((att) => (att as any).metadata?.gpx);
  const mediaAtts = attachments.filter((att) =>
    !(att as any).metadata?.gpx && (att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/'))
  );
  const fileAtts = attachments.filter((att) =>
    !(att as any).metadata?.gpx && !att.mimeType.startsWith('image/') && !att.mimeType.startsWith('video/')
  );

  return (
    <>
      <div style={styles.attachments}>
        {gpxAtts.map((att) => (
          <GpxPreviewCard key={att.id} attachment={att} gpx={(att as any).metadata!.gpx as GpxTrackMetadata} />
        ))}
        {mediaAtts.length > 0 && (
          <MediaGrid
            mediaAttachments={mediaAtts}
            onMediaClick={(index) => setCarouselData({ attachments: mediaAtts, startIndex: index })}
          />
        )}
        {fileAtts.map((att) => (
          <a key={att.id} href={att.url} download={att.originalName} style={styles.attachmentFile}>
            <FileText size={16} /> {att.originalName}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({(att.size / 1024).toFixed(1)} KB)
            </span>
          </a>
        ))}
      </div>
      {carouselData && (
        <MediaCarousel
          attachments={carouselData.attachments}
          startIndex={carouselData.startIndex}
          onClose={() => setCarouselData(null)}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  attachments: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 48,
    marginTop: 6,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  attachmentFile: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--accent)',
    fontSize: '0.85rem',
    textDecoration: 'none',
  },
};
