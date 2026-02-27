import type { NewsletterBlock } from '@crabac/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  blocks: NewsletterBlock[];
}

export function BlockRenderer({ blocks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} />
      ))}
    </div>
  );
}

function RenderBlock({ block }: { block: NewsletterBlock }) {
  switch (block.type) {
    case 'text':
      return (
        <div style={{ fontSize: '1rem', lineHeight: 1.8, color: 'var(--text-primary)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
        </div>
      );

    case 'image':
      return (
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img src={block.url} alt={block.alt || ''} style={{ maxWidth: '100%', borderRadius: 8, height: 'auto' }} />
          {block.caption && <figcaption style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>{block.caption}</figcaption>}
        </figure>
      );

    case 'image_gallery':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(block.images.length, 3)}, 1fr)`, gap: 8 }}>
          {block.images.map((img, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <img src={img.url} alt={img.alt || ''} style={{ width: '100%', borderRadius: 6, height: 'auto', objectFit: 'cover' }} />
              {img.caption && <figcaption style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );

    case 'quote':
      return (
        <blockquote style={{ margin: 0, padding: '12px 20px', borderLeft: '4px solid var(--accent)', background: 'var(--bg-secondary)', borderRadius: '0 var(--radius) var(--radius) 0' }}>
          <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.6 }}>{block.content}</p>
          {block.attribution && <footer style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>— {block.attribution}</footer>}
        </blockquote>
      );

    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />;

    case 'embed':
      return (
        <a href={block.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--accent)', textDecoration: 'none', fontSize: '0.95rem' }}>
          {block.title || block.url}
        </a>
      );

    case 'section_heading':
      return <h2 style={{ margin: '8px 0 0', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>{block.content}</h2>;

    default:
      return null;
  }
}
